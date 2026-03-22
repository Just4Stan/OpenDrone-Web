import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useRef, useState, useEffect, useCallback} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => {
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
  const dampedP = useRef(0);

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

      frameScene.traverse((child: any) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m: any) => {
          if (!m) return;
          m.color?.set(0x555555);
          if ('metalness' in m) m.metalness = 0.5;
          if ('roughness' in m) m.roughness = 0.3;
          m.transparent = true;
          m.opacity = 0.35;
          m.depthWrite = false;
        });
      });

      frameRef.current?.add(frameScene);
      escRef.current?.add(escScene);
      fcRef.current?.add(fcScene);
    });
  }, []);

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

    // Damped scroll for silky smooth transitions
    const damp = 1 - Math.pow(0.0005, dt);
    dampedP.current += (scrollProgress - dampedP.current) * damp;
    const p = dampedP.current;

    // Animation curves
    // Phase 1 (0-0.35): zoom out from stack to reveal full drone
    // Phase 2 (0.35-0.7): parts fly out to side-by-side
    const zoomOut = smoothstep(0, 0.35, p);
    const flyOut = smoothstep(0.3, 0.65, p);
    const flatten = smoothstep(0.2, 0.55, p);
    const rotSlow = smoothstep(0, 0.5, p);
    const frameOpacity = smoothstep(0.3, 0.55, p);
    const dragInf = 1 - flyOut * 0.9;

    // Auto-rotate
    if (!dragging.current) {
      rotRef.current += dt * THREE.MathUtils.lerp(0.12, 0.0, rotSlow);
    }

    // Rotation
    const autoRot = rotRef.current + dragRef.current.y * dragInf;
    const targetY = Math.round(autoRot / (Math.PI * 2)) * (Math.PI * 2);
    wrapperRef.current.rotation.y = THREE.MathUtils.lerp(autoRot, targetY, flyOut * flyOut);
    wrapperRef.current.rotation.x = THREE.MathUtils.lerp(
      0.45 + dragRef.current.x * dragInf, 0, flatten
    );
    wrapperRef.current.rotation.z = THREE.MathUtils.lerp(0.05, 0, flatten);

    // Scale — small enough to fit all 3 on screen
    wrapperRef.current.scale.setScalar(THREE.MathUtils.lerp(7, 8, flyOut));

    // Frame — becomes more solid during fly-out
    frameRef.current.position.set(
      0,
      THREE.MathUtils.lerp(0, 0.012, flyOut),
      THREE.MathUtils.lerp(0, 0.025, flyOut),
    );
    frameRef.current.traverse((c: any) => {
      if (c.isMesh && c.material?.transparent) {
        let opacity;
        if (flyOut < 0.5) {
          opacity = THREE.MathUtils.lerp(0.35, 0.7, frameOpacity);
        } else {
          opacity = THREE.MathUtils.lerp(0.7, 0.5, (flyOut - 0.5) * 2);
        }
        c.material.opacity = opacity;
      }
    });
    frameRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.45, flyOut));

    // FC — slides left (closer to center)
    fcRef.current.position.set(
      THREE.MathUtils.lerp(0, -0.05, flyOut),
      THREE.MathUtils.lerp(0, 0.008, flyOut),
      THREE.MathUtils.lerp(0, 0.04, flyOut),
    );

    // ESC — slides right (closer to center)
    escRef.current.position.set(
      THREE.MathUtils.lerp(0, 0.05, flyOut),
      THREE.MathUtils.lerp(0, 0.008, flyOut),
      THREE.MathUtils.lerp(0, 0.04, flyOut),
    );
  });

  return (
    <group ref={wrapperRef} scale={7} rotation={[0.45, 0, 0.05]} onPointerDown={onDown}>
      <group ref={frameRef} />
      <group ref={escRef} />
      <group ref={fcRef} />
    </group>
  );
}

function CameraRig({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();
  const dampedP = useRef(0);

  useFrame((_, dt) => {
    const damp = 1 - Math.pow(0.0005, dt);
    dampedP.current += (scrollProgress - dampedP.current) * damp;
    const p = dampedP.current;

    // Phase 1: zoom out from tight stack view
    // Phase 2: pull back to show all 3 side by side
    const zoomOut = smoothstep(0, 0.35, p);
    const pullBack = smoothstep(0.3, 0.65, p);

    camera.position.set(
      0,
      THREE.MathUtils.lerp(0.15, 0.35, zoomOut) + THREE.MathUtils.lerp(0, -0.05, pullBack),
      THREE.MathUtils.lerp(0.7, 1.2, zoomOut) + THREE.MathUtils.lerp(0, 0.3, pullBack),
    );
    camera.lookAt(0, THREE.MathUtils.lerp(0, 0.03, pullBack), 0);
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
        camera={{position: [0, 0.15, 0.7], fov: 40}}
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
