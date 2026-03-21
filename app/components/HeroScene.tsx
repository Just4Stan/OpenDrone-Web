import {Canvas, useFrame} from '@react-three/fiber';
import {useGLTF, OrbitControls} from '@react-three/drei';
import {
  Component,
  Suspense,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import type {ErrorInfo, ReactNode} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';

class SceneErrorBoundary extends Component<
  {children: ReactNode; fallback: ReactNode},
  {hasError: boolean}
> {
  constructor(props: {children: ReactNode; fallback: ReactNode}) {
    super(props);
    this.state = {hasError: false};
  }
  static getDerivedStateFromError() {
    return {hasError: true};
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D scene failed to load:', error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / (viewportHeight * 1.5)));
      setProgress(p);
    };
    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

/**
 * The real OpenDrone model loaded from GLB.
 */
function DroneGLTF({scrollProgress}: {scrollProgress: number}) {
  const groupRef = useRef<Group>(null);
  const {scene} = useGLTF('/models/opendrone3.glb');
  const [flyInComplete, setFlyInComplete] = useState(false);
  const flyInProgress = useRef(0);

  useEffect(() => {
    // Fix materials — Onshape exports dark/default materials
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1a1a1a'),
          metalness: 0.85,
          roughness: 0.15,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (!flyInComplete) {
      flyInProgress.current = Math.min(1, flyInProgress.current + delta * 0.6);
      const ease = 1 - Math.pow(1 - flyInProgress.current, 3);

      groupRef.current.position.z = THREE.MathUtils.lerp(5, 0, ease);
      groupRef.current.position.y = THREE.MathUtils.lerp(2, 0, ease);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(0.5, 0, ease);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(5, 15, ease));

      if (flyInProgress.current >= 1) setFlyInComplete(true);
      return;
    }

    // Idle
    const idleFloat = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    const idleRotation = state.clock.elapsedTime * 0.1;

    // Scroll-driven tilt
    groupRef.current.rotation.x = scrollProgress * 0.4;
    groupRef.current.rotation.y = idleRotation + scrollProgress * Math.PI * 0.3;
    groupRef.current.position.y = idleFloat - scrollProgress * 0.5;
    groupRef.current.scale.setScalar(15);
  });

  return (
    <group ref={groupRef} scale={5} position={[0, 2, 5]}>
      <primitive object={scene} />
    </group>
  );
}

function Scene({scrollProgress}: {scrollProgress: number}) {
  return (
    <>
      {/* Key light — warm gold from top-right */}
      <directionalLight
        position={[4, 6, 4]}
        intensity={2}
        color="#e0be5a"
      />
      {/* Fill — cool blue from left */}
      <directionalLight
        position={[-4, 2, -2]}
        intensity={0.6}
        color="#4488cc"
      />
      {/* Rim light — accent from behind */}
      <directionalLight
        position={[0, 2, -5]}
        intensity={1.2}
        color="#347a44"
      />
      {/* Ambient */}
      <ambientLight intensity={0.15} />
      {/* Ground bounce */}
      <pointLight position={[0, -3, 0]} intensity={0.3} color="#b8922e" />

      <Suspense fallback={null}>
        <DroneGLTF scrollProgress={scrollProgress} />
      </Suspense>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
      />
    </>
  );
}

function HeroFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-24 h-24 border border-[var(--color-border)] rounded-full flex items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-[var(--color-gold)] rounded-full animate-spin" />
      </div>
    </div>
  );
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <HeroFallback />;

  return (
    <div className="absolute inset-0">
      <SceneErrorBoundary fallback={<HeroFallback />}>
        <Suspense fallback={<HeroFallback />}>
          <Canvas
            camera={{position: [0, 0.5, 3], fov: 50}}
            style={{background: 'transparent'}}
            gl={{antialias: true, alpha: true}}
          >
            <Scene scrollProgress={scrollProgress} />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
