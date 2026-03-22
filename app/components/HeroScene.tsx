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

function DroneModel({
  scrollProgress,
  onClickProduct,
}: {
  scrollProgress: number;
  onClickProduct: () => void;
}) {
  const wrapperRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const fcRef = useRef<Group>(null);

  const rotationRef = useRef(0);
  const dragRotRef = useRef({x: 0, y: 0});
  const isDragging = useRef(false);
  const lastMouse = useRef({x: 0, y: 0});

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('/models/opendrone-full.glb', (gltf) => {
      const scene = gltf.scene;

      // Center the assembly
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center);

      // Sort meshes into frame / ESC / FC groups
      const frameGroup = new THREE.Group();
      const escGroup = new THREE.Group();
      const fcGroup = new THREE.Group();

      // Collect children first (can't modify while iterating)
      const children = [...scene.children];
      children.forEach((child: any) => {
        const name = child.name || '';

        if (name === 'base') {
          // Frame — dark semi-transparent
          if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.color?.set(0x444444);
              if ('metalness' in mat) mat.metalness = 0.6;
              if ('roughness' in mat) mat.roughness = 0.35;
              mat.transparent = true;
              mat.opacity = 0.45;
              mat.depthWrite = false;
            });
          }
          frameGroup.add(child);
        } else if (name.startsWith('4in1ESC')) {
          escGroup.add(child);
        } else {
          // Everything else is FC
          fcGroup.add(child);
        }
      });

      if (frameRef.current) frameRef.current.add(frameGroup);
      if (escRef.current) escRef.current.add(escGroup);
      if (fcRef.current) fcRef.current.add(fcGroup);
    });
  }, []);

  // Drag handlers
  const onPointerDown = useCallback((e: any) => {
    isDragging.current = true;
    lastMouse.current = {x: e.clientX, y: e.clientY};
    document.body.style.cursor = 'grabbing';
  }, []);

  useEffect(() => {
    const onPointerUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'auto';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      dragRotRef.current.y += dx * 0.005;
      dragRotRef.current.x = Math.max(-0.5, Math.min(1.0,
        dragRotRef.current.x + dy * 0.005
      ));
      lastMouse.current = {x: e.clientX, y: e.clientY};
    };
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  useFrame((state, delta) => {
    if (!wrapperRef.current) return;

    // Auto-rotation
    if (!isDragging.current) {
      const rotSpeed = THREE.MathUtils.lerp(0.15, 0.03, scrollProgress);
      rotationRef.current += delta * rotSpeed;
    }

    wrapperRef.current.rotation.y = rotationRef.current + dragRotRef.current.y;
    wrapperRef.current.rotation.x =
      THREE.MathUtils.lerp(0.5, 0.15, scrollProgress) + dragRotRef.current.x;
    wrapperRef.current.scale.setScalar(THREE.MathUtils.lerp(12, 14, scrollProgress));

    // Fly-out animation: parts separate as scroll progresses
    const flyOut = Math.max(0, (scrollProgress - 0.3) / 0.7); // starts at 30% scroll
    const ease = 1 - Math.pow(1 - flyOut, 2); // ease-out

    if (frameRef.current) {
      // Frame moves back and fades more
      frameRef.current.position.z = ease * -0.02;
      frameRef.current.traverse((c: any) => {
        if (c.isMesh && c.material?.transparent) {
          c.material.opacity = THREE.MathUtils.lerp(0.45, 0.15, ease);
        }
      });
    }
    if (escRef.current) {
      // ESC slides left
      escRef.current.position.x = ease * -0.04;
      escRef.current.position.z = ease * 0.01;
    }
    if (fcRef.current) {
      // FC slides right
      fcRef.current.position.x = ease * 0.04;
      fcRef.current.position.z = ease * 0.01;
    }
  });

  return (
    <group
      ref={wrapperRef}
      scale={12}
      rotation={[0.5, 0, 0.05]}
      onPointerDown={onPointerDown}
    >
      <group ref={frameRef} />
      <group ref={escRef} />
      <group ref={fcRef} />
    </group>
  );
}

function CameraController({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();
  useFrame(() => {
    const ease = scrollProgress * scrollProgress;
    camera.position.set(
      THREE.MathUtils.lerp(0, 0.2, ease),
      THREE.MathUtils.lerp(1.0, 0.3, ease),
      THREE.MathUtils.lerp(2.0, 0.7, ease),
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Scene({
  scrollProgress,
  onClickProduct,
}: {
  scrollProgress: number;
  onClickProduct: () => void;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#8899bb" />
      <directionalLight position={[0, -2, -5]} intensity={1} color="#347a44" />
      <pointLight position={[0, 3, 0]} intensity={1} color="#ffffff" />
      <CameraController scrollProgress={scrollProgress} />
      <DroneModel scrollProgress={scrollProgress} onClickProduct={onClickProduct} />
    </>
  );
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();

  useEffect(() => { setMounted(true); }, []);

  const handleClickProduct = useCallback(() => {
    window.location.href = '/collections/all';
  }, []);

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
        <Scene scrollProgress={scrollProgress} onClickProduct={handleClickProduct} />
      </Canvas>
    </div>
  );
}
