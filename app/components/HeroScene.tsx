import {Canvas, useFrame} from '@react-three/fiber';
import {
  Float,
  MeshDistortMaterial,
  Environment,
  OrbitControls,
} from '@react-three/drei';
import {Suspense, useRef, useState, useEffect} from 'react';
import type {Mesh, Group} from 'three';

/**
 * Placeholder drone-like geometry.
 * Replace with actual GLTF model later via useGLTF.
 */
function DronePlaceholder() {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
  });

  return (
    <group ref={groupRef}>
      {/* Center body — flight controller */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.15, 1.2]} />
        <meshStandardMaterial color="#f97316" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Arms */}
      {[
        [0.9, 0, 0.9],
        [-0.9, 0, 0.9],
        [0.9, 0, -0.9],
        [-0.9, 0, -0.9],
      ].map((pos, i) => (
        <group key={i}>
          {/* Arm beam */}
          <mesh position={[pos[0] * 0.5, 0, pos[2] * 0.5]}>
            <boxGeometry args={[
              Math.abs(pos[0]) > 0 ? 1 : 0.08,
              0.08,
              Math.abs(pos[2]) > 0 ? 1 : 0.08,
            ]} />
            <meshStandardMaterial color="#262626" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Motor */}
          <mesh position={[pos[0], 0.1, pos[2]]}>
            <cylinderGeometry args={[0.12, 0.12, 0.2, 16]} />
            <meshStandardMaterial color="#404040" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Propeller disc */}
          <Propeller position={[pos[0], 0.22, pos[2]]} direction={i % 2 === 0 ? 1 : -1} />
        </group>
      ))}

      {/* PCB detail lines on body */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.8, 0.01, 0.8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Propeller({position, direction}: {position: number[]; direction: number}) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 15 * direction;
  });

  return (
    <mesh ref={ref} position={position as [number, number, number]}>
      <torusGeometry args={[0.3, 0.01, 4, 32]} />
      <meshStandardMaterial
        color="#f97316"
        transparent
        opacity={0.3}
        metalness={0.5}
        roughness={0.5}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} color="#f97316" />
      <directionalLight position={[-5, 3, -5]} intensity={0.5} color="#3b82f6" />
      <pointLight position={[0, -2, 0]} intensity={0.3} color="#f97316" />
      <DronePlaceholder />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 3}
      />
      <Environment preset="night" />
    </>
  );
}

function HeroFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-32 h-32 border border-[var(--color-border)] rounded-full flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    </div>
  );
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HeroFallback />;
  }

  return (
    <div className="absolute inset-0">
      <Suspense fallback={<HeroFallback />}>
        <Canvas
          camera={{position: [3, 2, 3], fov: 45}}
          style={{background: 'transparent'}}
          gl={{antialias: true, alpha: true}}
        >
          <Scene />
        </Canvas>
      </Suspense>
    </div>
  );
}
