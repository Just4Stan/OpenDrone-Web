import {Canvas, useFrame} from '@react-three/fiber';
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
      console.log('Full drone loaded, centered');
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
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
  });

  return <group ref={groupRef} scale={12} rotation={[0.6, 0, 0.1]} />;
}

function Scene({scrollProgress}: {scrollProgress: number}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={2} color="#ffffff" />
      <directionalLight position={[-4, 3, -3]} intensity={0.8} color="#8899bb" />
      <directionalLight position={[0, -2, -5]} intensity={1} color="#347a44" />
      <pointLight position={[0, 3, 0]} intensity={1} color="#ffffff" />
      <DroneModel scrollProgress={scrollProgress} />
    </>
  );
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

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
