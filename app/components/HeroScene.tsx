import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useRef, useState, useEffect, useCallback} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      // Use 2x viewport for the full animation range
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 2)));
      setProgress(p);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function loadModel(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function DroneAssembly({scrollProgress}: {scrollProgress: number}) {
  const wrapperRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const fcRef = useRef<Group>(null);

  // Animation state
  const rotRef = useRef(0);
  const dragRef = useRef({x: 0, y: 0});
  const dragging = useRef(false);
  const lastPtr = useRef({x: 0, y: 0});
  const centerOffset = useRef(new THREE.Vector3());

  useEffect(() => {
    Promise.all([
      loadModel('/models/frame.glb'),
      loadModel('/models/esc.glb'),
      loadModel('/models/fc.glb'),
    ]).then(([frameScene, escScene, fcScene]) => {
      // Center on frame bbox
      const box = new THREE.Box3().setFromObject(frameScene);
      const c = box.getCenter(new THREE.Vector3());
      centerOffset.current.copy(c);

      frameScene.position.sub(c);
      escScene.position.sub(c);
      fcScene.position.sub(c);

      // Frame: dark, semi-transparent
      frameScene.traverse((child: any) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m: any) => {
          if (!m) return;
          m.color?.set(0x555555);
          if ('metalness' in m) m.metalness = 0.5;
          if ('roughness' in m) m.roughness = 0.3;
          m.transparent = true;
          m.opacity = 0.45;
          m.depthWrite = false;
        });
      });

      frameRef.current?.add(frameScene);
      escRef.current?.add(escScene);
      fcRef.current?.add(fcScene);
    });
  }, []);

  // Pointer drag
  const onDown = useCallback((e: any) => {
    dragging.current = true;
    lastPtr.current = {x: e.clientX, y: e.clientY};
  }, []);

  useEffect(() => {
    const onUp = () => { dragging.current = false; };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragRef.current.y += (e.clientX - lastPtr.current.x) * 0.004;
      dragRef.current.x = Math.max(-0.4, Math.min(0.8,
        dragRef.current.x + (e.clientY - lastPtr.current.y) * 0.004
      ));
      lastPtr.current = {x: e.clientX, y: e.clientY};
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  useFrame((_, dt) => {
    if (!wrapperRef.current || !frameRef.current || !escRef.current || !fcRef.current) return;

    const p = scrollProgress; // 0 = top, 1 = fully scrolled

    // Phase 1 (0 → 0.4): assembled drone rotating, camera zooms in
    // Phase 2 (0.4 → 0.8): parts fly out, rotate to face-on
    // Phase 3 (0.8 → 1.0): settle into final positions

    const phase1 = Math.min(1, p / 0.4);                              // 0→1 over scroll 0→0.4
    const phase2 = Math.max(0, Math.min(1, (p - 0.4) / 0.4));         // 0→1 over scroll 0.4→0.8
    const phase3 = Math.max(0, Math.min(1, (p - 0.8) / 0.2));         // 0→1 over scroll 0.8→1.0
    const flyOut = phase2;
    const settle = phase3;

    // Ease functions
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const flyEase = easeInOut(flyOut);
    const settleEase = easeOut(settle);

    // --- Wrapper rotation ---
    // Auto-rotate (slows during fly-out, stops at end)
    if (!dragging.current) {
      const speed = THREE.MathUtils.lerp(0.12, 0, easeOut(p));
      rotRef.current += dt * speed;
    }

    // During fly-out, the drag influence fades
    const dragInfluence = 1 - flyEase * 0.8;

    // Y rotation: auto-rotate fades to fixed position facing camera
    const autoRot = rotRef.current + dragRef.current.y * dragInfluence;
    // At full fly-out, snap to nearest clean angle (face-on)
    const targetY = Math.round(autoRot / (Math.PI * 2)) * (Math.PI * 2);
    wrapperRef.current.rotation.y = THREE.MathUtils.lerp(autoRot, targetY, flyEase * flyEase);

    // X tilt: angled view → flat face-on
    wrapperRef.current.rotation.x = THREE.MathUtils.lerp(
      0.45 + dragRef.current.x * dragInfluence,
      0,
      flyEase
    );
    wrapperRef.current.rotation.z = THREE.MathUtils.lerp(0.05, 0, flyEase);

    // Scale
    const scale = THREE.MathUtils.lerp(12, 10, flyEase);
    wrapperRef.current.scale.setScalar(scale);

    // --- Final layout: Frame center, FC left, ESC right ---
    // All face-on, evenly spaced, in upper portion of viewport
    // wrapper scale is ~12, so 0.1 in model space = 1.2 in world space

    // --- Frame (center) ---
    // During transition: becomes MORE visible, then fades at the end
    frameRef.current.position.set(
      0,
      THREE.MathUtils.lerp(0, 0.02, flyEase),
      THREE.MathUtils.lerp(0, 0.03, flyEase),
    );
    frameRef.current.traverse((c: any) => {
      if (c.isMesh && c.material?.transparent) {
        // Opacity: 0.45 → peaks at 0.7 during mid-transition → settles at 0.3
        let targetOpacity;
        if (flyEase < 0.5) {
          targetOpacity = THREE.MathUtils.lerp(0.45, 0.7, flyEase * 2);
        } else {
          targetOpacity = THREE.MathUtils.lerp(0.7, 0.3, (flyEase - 0.5) * 2);
        }
        c.material.opacity = targetOpacity;
      }
    });
    frameRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.65, flyEase));

    // --- FC (slides left, moves up) ---
    fcRef.current.position.set(
      THREE.MathUtils.lerp(0, -0.08, flyEase),
      THREE.MathUtils.lerp(0, 0.015, flyEase),
      THREE.MathUtils.lerp(0, 0.05, flyEase),
    );

    // --- ESC (slides right, moves up) ---
    escRef.current.position.set(
      THREE.MathUtils.lerp(0, 0.08, flyEase),
      THREE.MathUtils.lerp(0, 0.015, flyEase),
      THREE.MathUtils.lerp(0, 0.05, flyEase),
    );
  });

  return (
    <group ref={wrapperRef} scale={12} rotation={[0.45, 0, 0.05]} onPointerDown={onDown}>
      <group ref={frameRef} />
      <group ref={escRef} />
      <group ref={fcRef} />
    </group>
  );
}

function CameraRig({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();

  useFrame(() => {
    const p = scrollProgress;

    // Phase 1: pull back slightly for overview
    // Phase 2: move to front-on view as parts separate
    const phase2 = Math.max(0, Math.min(1, (p - 0.4) / 0.6));
    const ease = 1 - Math.pow(1 - phase2, 2);

    // Camera: starts high/angled, ends front-on looking slightly down
    camera.position.set(
      0,
      THREE.MathUtils.lerp(0.8, 0.4, ease),
      THREE.MathUtils.lerp(1.8, 2.2, ease),
    );
    camera.lookAt(0, THREE.MathUtils.lerp(0, 0.05, ease), 0);
  });

  return null;
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-16 h-16 border border-[var(--color-border)] rounded-full flex items-center justify-center">
        <div className="w-8 h-8 border-t border-[var(--color-gold)] rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{position: [0, 0.8, 1.8], fov: 40}}
        style={{background: 'transparent'}}
        gl={{antialias: true, alpha: true}}
        onCreated={({camera}) => { camera.lookAt(0, 0, 0); }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
        <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#8899bb" />
        <directionalLight position={[0, -2, -5]} intensity={1} color="#347a44" />
        <pointLight position={[0, 3, 0]} intensity={1} color="#ffffff" />
        <CameraRig scrollProgress={scrollProgress} />
        <DroneAssembly scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
