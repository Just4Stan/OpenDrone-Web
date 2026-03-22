import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useRef, useState, useEffect, useCallback} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 1.5)));
      setProgress(p);
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function loadModel(url: string): Promise<THREE.Group> {
  return new Promise((resolve) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene));
  });
}

function DroneModel({scrollProgress}: {scrollProgress: number}) {
  const wrapperRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const fcRef = useRef<Group>(null);
  const rotationRef = useRef(0);
  const dragRotRef = useRef({x: 0, y: 0});
  const isDragging = useRef(false);
  const lastMouse = useRef({x: 0, y: 0});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      loadModel('/models/frame.glb'),
      loadModel('/models/esc.glb'),
      loadModel('/models/fc.glb'),
    ]).then(([frameScene, escScene, fcScene]) => {
      // Center everything based on the frame's bounding box
      const box = new THREE.Box3().setFromObject(frameScene);
      const center = box.getCenter(new THREE.Vector3());

      // Apply same offset to all 3 so they stay aligned
      frameScene.position.sub(center);
      escScene.position.sub(center);
      fcScene.position.sub(center);

      // Style the frame — dark semi-transparent
      frameScene.traverse((child: any) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (!mat) return;
            mat.color?.set(0x444444);
            if ('metalness' in mat) mat.metalness = 0.6;
            if ('roughness' in mat) mat.roughness = 0.35;
            mat.transparent = true;
            mat.opacity = 0.45;
            mat.depthWrite = false;
          });
        }
      });

      if (frameRef.current) frameRef.current.add(frameScene);
      if (escRef.current) escRef.current.add(escScene);
      if (fcRef.current) fcRef.current.add(fcScene);
      setLoaded(true);
    });
  }, []);

  // Drag handlers
  const onPointerDown = useCallback((e: any) => {
    isDragging.current = true;
    lastMouse.current = {x: e.clientX, y: e.clientY};
    document.body.style.cursor = 'grabbing';
  }, []);

  useEffect(() => {
    const onUp = () => { isDragging.current = false; document.body.style.cursor = 'auto'; };
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      dragRotRef.current.y += (e.clientX - lastMouse.current.x) * 0.005;
      dragRotRef.current.x = Math.max(-0.5, Math.min(1.0,
        dragRotRef.current.x + (e.clientY - lastMouse.current.y) * 0.005
      ));
      lastMouse.current = {x: e.clientX, y: e.clientY};
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    return () => { window.removeEventListener('pointerup', onUp); window.removeEventListener('pointermove', onMove); };
  }, []);

  useFrame((_, delta) => {
    if (!wrapperRef.current) return;

    // Auto-rotation
    if (!isDragging.current) {
      rotationRef.current += delta * THREE.MathUtils.lerp(0.15, 0.03, scrollProgress);
    }

    wrapperRef.current.rotation.y = rotationRef.current + dragRotRef.current.y;
    wrapperRef.current.rotation.x = THREE.MathUtils.lerp(0.5, 0.15, scrollProgress) + dragRotRef.current.x;
    wrapperRef.current.scale.setScalar(THREE.MathUtils.lerp(12, 14, scrollProgress));

    // Fly-out: parts separate after 30% scroll
    const t = Math.max(0, (scrollProgress - 0.3) / 0.7);
    const ease = 1 - Math.pow(1 - t, 2);

    if (frameRef.current) {
      frameRef.current.position.z = ease * -0.03;
      frameRef.current.traverse((c: any) => {
        if (c.isMesh && c.material?.transparent) {
          c.material.opacity = THREE.MathUtils.lerp(0.45, 0.1, ease);
        }
      });
    }
    if (escRef.current) {
      escRef.current.position.x = ease * -0.05;
      escRef.current.position.z = ease * 0.015;
    }
    if (fcRef.current) {
      fcRef.current.position.x = ease * 0.05;
      fcRef.current.position.z = ease * 0.015;
    }
  });

  return (
    <group ref={wrapperRef} scale={12} rotation={[0.5, 0, 0.05]} onPointerDown={onPointerDown}>
      <group ref={frameRef} />
      <group ref={escRef} />
      <group ref={fcRef} />
    </group>
  );
}

function CameraController({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();
  useFrame(() => {
    const e = scrollProgress * scrollProgress;
    camera.position.set(
      THREE.MathUtils.lerp(0, 0.15, e),
      THREE.MathUtils.lerp(1.0, 0.3, e),
      THREE.MathUtils.lerp(2.0, 0.7, e),
    );
    camera.lookAt(0, 0, 0);
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
        camera={{position: [0, 1.0, 2.0], fov: 40}}
        style={{background: 'transparent'}}
        gl={{antialias: true, alpha: true}}
        onCreated={({camera}) => { camera.lookAt(0, 0, 0); }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
        <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#8899bb" />
        <directionalLight position={[0, -2, -5]} intensity={1} color="#347a44" />
        <pointLight position={[0, 3, 0]} intensity={1} color="#ffffff" />
        <CameraController scrollProgress={scrollProgress} />
        <DroneModel scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
