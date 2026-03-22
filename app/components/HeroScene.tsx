import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useRef, useState, useEffect, useCallback} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      // 4x viewport for the full extended hero
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 3)));
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

// Smooth step — no hard edges
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function DroneAssembly({scrollProgress}: {scrollProgress: number}) {
  const wrapperRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const fcRef = useRef<Group>(null);

  const rotRef = useRef(0);
  const dragRef = useRef({x: 0, y: 0});
  const dragging = useRef(false);
  const lastPtr = useRef({x: 0, y: 0});

  useEffect(() => {
    Promise.all([
      loadModel('/models/frame.glb'),
      loadModel('/models/esc.glb'),
      loadModel('/models/fc.glb'),
    ]).then(([frameScene, escScene, fcScene]) => {
      const box = new THREE.Box3().setFromObject(frameScene);
      const c = box.getCenter(new THREE.Vector3());

      frameScene.position.sub(c);
      escScene.position.sub(c);
      fcScene.position.sub(c);

      // Frame: dark carbon look
      frameScene.traverse((child: any) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m: any) => {
          if (!m) return;
          m.color?.set(0x555555);
          if ('metalness' in m) m.metalness = 0.5;
          if ('roughness' in m) m.roughness = 0.3;
          m.transparent = true;
          m.opacity = 0.4;
          m.depthWrite = false;
        });
      });

      frameRef.current?.add(frameScene);
      escRef.current?.add(escScene);
      fcRef.current?.add(fcScene);
    });
  }, []);

  // Drag
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

    const p = scrollProgress;

    // Continuous smooth curves — something always moving
    const flyOut = smoothstep(0.15, 0.5, p);    // parts separate
    const flatten = smoothstep(0.08, 0.4, p);   // rotation flattens (earlier)
    const rotSlow = smoothstep(0, 0.5, p);      // rotation slows
    const frameOpacity = smoothstep(0.15, 0.45, p); // frame becomes solid

    // Drag influence fades
    const dragInf = 1 - flyOut * 0.9;

    // Auto-rotate (always something moving — slows but never fully stops until flyOut=1)
    if (!dragging.current) {
      const speed = THREE.MathUtils.lerp(0.12, 0.0, rotSlow);
      rotRef.current += dt * speed;
    }

    // Wrapper rotation — smoothly flattens to face-on
    const autoRot = rotRef.current + dragRef.current.y * dragInf;
    const targetY = Math.round(autoRot / (Math.PI * 2)) * (Math.PI * 2);
    wrapperRef.current.rotation.y = THREE.MathUtils.lerp(autoRot, targetY, flyOut * flyOut);
    wrapperRef.current.rotation.x = THREE.MathUtils.lerp(
      0.45 + dragRef.current.x * dragInf, 0, flatten
    );
    wrapperRef.current.rotation.z = THREE.MathUtils.lerp(0.05, 0, flatten);

    // Scale
    wrapperRef.current.scale.setScalar(THREE.MathUtils.lerp(12, 13, flyOut));

    // --- Frame (center) — goes from transparent to more solid ---
    frameRef.current.position.set(
      0,
      THREE.MathUtils.lerp(0, 0.015, flyOut),
      THREE.MathUtils.lerp(0, 0.03, flyOut),
    );
    frameRef.current.traverse((c: any) => {
      if (c.isMesh && c.material?.transparent) {
        // 0.4 → 0.75 (solid during display)
        c.material.opacity = THREE.MathUtils.lerp(0.4, 0.75, frameOpacity);
      }
    });
    frameRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.65, flyOut));

    // --- FC (left) ---
    fcRef.current.position.set(
      THREE.MathUtils.lerp(0, -0.055, flyOut),
      THREE.MathUtils.lerp(0, 0.012, flyOut),
      THREE.MathUtils.lerp(0, 0.05, flyOut),
    );

    // --- ESC (right) ---
    escRef.current.position.set(
      THREE.MathUtils.lerp(0, 0.055, flyOut),
      THREE.MathUtils.lerp(0, 0.012, flyOut),
      THREE.MathUtils.lerp(0, 0.05, flyOut),
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
    const camMove = smoothstep(0.1, 0.6, p);

    camera.position.set(
      0,
      THREE.MathUtils.lerp(0.8, 0.35, camMove),
      THREE.MathUtils.lerp(1.8, 2.0, camMove),
    );
    camera.lookAt(0, THREE.MathUtils.lerp(0, 0.08, camMove), 0);
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
