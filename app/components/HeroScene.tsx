import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {useRef, useState, useEffect} from 'react';
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

function DroneModel({scrollProgress}: {scrollProgress: number}) {
  const groupRef = useRef<Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('/models/opendrone-full.glb', (gltf) => {
      const scene = gltf.scene;
      // Center the whole assembly
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center);
      // Darken frame parts — Onshape exports with light/default materials
      scene.traverse((child: any) => {
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (!mat || !mat.color) return;
            const r = mat.color.r, g = mat.color.g, b = mat.color.b;
            const brightness = (r + g + b) / 3;
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);
            // Grey/white (low saturation, bright) → dark carbon fiber
            // Skip colored materials (PCB green, gold pads, component colors)
            if (brightness > 0.35 && saturation < 0.15) {
              mat.color.set(0x1a1a1a);
              if ('metalness' in mat) mat.metalness = 0.8;
              if ('roughness' in mat) mat.roughness = 0.25;
            }
          });
        }
      });
      setModel(scene);
    });
  }, []);

  useEffect(() => {
    if (!groupRef.current || !model) return;
    groupRef.current.add(model);
    return () => { groupRef.current?.remove(model); };
  }, [model]);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Rotation slows as user scrolls in
    const rotSpeed = THREE.MathUtils.lerp(0.15, 0.02, scrollProgress);
    groupRef.current.rotation.y = state.clock.elapsedTime * rotSpeed;
    // Tilt flattens as we zoom to stack
    groupRef.current.rotation.x = THREE.MathUtils.lerp(0.6, 0.3, scrollProgress);
  });

  return <group ref={groupRef} scale={12} rotation={[0.6, 0, 0.1]} />;
}

function CameraController({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();

  useFrame(() => {
    // Scroll zooms camera toward the center stack
    const startPos = {x: 0, y: 1.2, z: 2};
    const endPos = {x: 0.3, y: 0.4, z: 0.8}; // close-up on stack

    const ease = scrollProgress * scrollProgress; // ease-in
    camera.position.set(
      THREE.MathUtils.lerp(startPos.x, endPos.x, ease),
      THREE.MathUtils.lerp(startPos.y, endPos.y, ease),
      THREE.MathUtils.lerp(startPos.z, endPos.z, ease),
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function Scene({scrollProgress}: {scrollProgress: number}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#8899bb" />
      <directionalLight position={[0, -2, -5]} intensity={1} color="#347a44" />
      <pointLight position={[0, 3, 0]} intensity={1} color="#ffffff" />
      <CameraController scrollProgress={scrollProgress} />
      <DroneModel scrollProgress={scrollProgress} />
    </>
  );
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
        camera={{position: [0, 1.2, 2], fov: 40}}
        style={{background: 'transparent'}}
        gl={{antialias: true, alpha: true}}
        onCreated={({camera}) => { camera.lookAt(0, 0, 0); }}
      >
        <Scene scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
