import {Canvas, useFrame, useThree} from '@react-three/fiber';
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
import type {Group, Mesh} from 'three';
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

/**
 * Scroll progress hook — returns 0-1 based on scroll position
 * relative to the hero section height.
 */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      // Explode over 1.5x viewport height of scrolling
      const p = Math.min(1, Math.max(0, scrollY / (viewportHeight * 1.5)));
      setProgress(p);
    };
    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

/**
 * Drone skeleton model loaded from GLB.
 * Flies in on mount, then responds to scroll for exploded view.
 */
function DroneModel({scrollProgress}: {scrollProgress: number}) {
  const groupRef = useRef<Group>(null);
  const [flyInComplete, setFlyInComplete] = useState(false);
  const flyInProgress = useRef(0);

  // Try loading the real model, fall back to placeholder
  let model: ReturnType<typeof useGLTF> | null = null;
  try {
    model = useGLTF('/models/opendrone3.glb');
  } catch {
    model = null;
  }

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Fly-in animation (first 2 seconds)
    if (!flyInComplete) {
      flyInProgress.current = Math.min(1, flyInProgress.current + delta * 0.8);
      const ease = 1 - Math.pow(1 - flyInProgress.current, 3); // easeOutCubic

      groupRef.current.position.z = THREE.MathUtils.lerp(8, 0, ease);
      groupRef.current.position.y = THREE.MathUtils.lerp(3, 0, ease);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(-Math.PI, 0, ease);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.3, 1, ease));

      if (flyInProgress.current >= 1) setFlyInComplete(true);
      return;
    }

    // Gentle idle rotation when not scrolling
    const idleRotation = state.clock.elapsedTime * 0.15;
    const idleFloat = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;

    // Scroll-driven rotation (tilt forward as it explodes)
    const scrollRotX = scrollProgress * 0.3;
    const scrollRotY = scrollProgress * Math.PI * 0.5;

    groupRef.current.rotation.x = scrollRotX;
    groupRef.current.rotation.y = idleRotation + scrollRotY;
    groupRef.current.position.y = idleFloat;
  });

  return (
    <group ref={groupRef} position={[0, 3, 8]} scale={0.3}>
      {model ? (
        <primitive object={model.scene.clone()} />
      ) : (
        <PlaceholderDrone />
      )}
    </group>
  );
}

/**
 * Exploded stack components — FC and ESC boards that separate on scroll.
 * These are the clickable product links.
 */
function ExplodedStack({
  scrollProgress,
  onClickFC,
  onClickESC,
}: {
  scrollProgress: number;
  onClickFC: () => void;
  onClickESC: () => void;
}) {
  const fcRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const [hoveredFC, setHoveredFC] = useState(false);
  const [hoveredESC, setHoveredESC] = useState(false);

  useFrame(() => {
    if (!fcRef.current || !escRef.current) return;

    // Only show and animate after scroll starts
    const explodeAmount = Math.max(0, (scrollProgress - 0.3) / 0.7); // starts at 30% scroll
    const ease = 1 - Math.pow(1 - explodeAmount, 2);

    // FC rises up, ESC drops down
    fcRef.current.position.y = ease * 0.8;
    escRef.current.position.y = ease * -0.8;

    // Slight separation on X for visual clarity
    fcRef.current.position.x = ease * 0.15;
    escRef.current.position.x = ease * -0.15;

    // Opacity / visibility
    const opacity = Math.min(1, explodeAmount * 2);
    fcRef.current.visible = explodeAmount > 0.05;
    escRef.current.visible = explodeAmount > 0.05;

    // Scale up slightly when hovered
    const fcScale = hoveredFC ? 1.08 : 1;
    const escScale = hoveredESC ? 1.08 : 1;
    fcRef.current.scale.setScalar(fcScale);
    escRef.current.scale.setScalar(escScale);
  });

  const boardWidth = 0.6;
  const boardDepth = 0.6;
  const boardHeight = 0.06;

  return (
    <>
      {/* FC Board */}
      <group
        ref={fcRef}
        visible={false}
        onClick={onClickFC}
        onPointerOver={() => {
          setHoveredFC(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredFC(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh>
          <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
          <meshStandardMaterial
            color={hoveredFC ? '#347a44' : '#1f4d2c'}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Gold pads */}
        <mesh position={[0, boardHeight / 2 + 0.001, 0]}>
          <boxGeometry args={[boardWidth * 0.7, 0.002, boardDepth * 0.7]} />
          <meshStandardMaterial color="#b8922e" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Chip */}
        <mesh position={[0, boardHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[0.12, 0.03, 0.12]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* ESC Board */}
      <group
        ref={escRef}
        visible={false}
        onClick={onClickESC}
        onPointerOver={() => {
          setHoveredESC(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoveredESC(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh>
          <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
          <meshStandardMaterial
            color={hoveredESC ? '#347a44' : '#1f4d2c'}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Gold traces */}
        <mesh position={[0, boardHeight / 2 + 0.001, 0]}>
          <boxGeometry args={[boardWidth * 0.8, 0.002, boardDepth * 0.8]} />
          <meshStandardMaterial color="#b8922e" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* MOSFETs */}
        {[-0.15, 0, 0.15].map((z, i) =>
          [-0.15, 0.15].map((x, j) => (
            <mesh key={`${i}-${j}`} position={[x, boardHeight / 2 + 0.015, z]}>
              <boxGeometry args={[0.06, 0.025, 0.06]} />
              <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
            </mesh>
          )),
        )}
      </group>
    </>
  );
}

/** Fallback placeholder drone geometry */
function PlaceholderDrone() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.15, 1.2]} />
        <meshStandardMaterial color="#1f4d2c" metalness={0.8} roughness={0.2} />
      </mesh>
      {[
        [0.9, 0, 0.9],
        [-0.9, 0, 0.9],
        [0.9, 0, -0.9],
        [-0.9, 0, -0.9],
      ].map((pos, i) => (
        <group key={i}>
          <mesh position={[pos[0] * 0.5, 0, pos[2] * 0.5]}>
            <boxGeometry args={[1, 0.08, 0.08]} />
            <meshStandardMaterial color="#262626" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[pos[0], 0.1, pos[2]]}>
            <cylinderGeometry args={[0.12, 0.12, 0.2, 16]} />
            <meshStandardMaterial color="#404040" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Scene({
  scrollProgress,
  onClickFC,
  onClickESC,
}: {
  scrollProgress: number;
  onClickFC: () => void;
  onClickESC: () => void;
}) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} color="#b8922e" />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#1f4d2c" />
      <pointLight position={[0, -2, 0]} intensity={0.2} color="#b8922e" />
      <spotLight
        position={[-3, 3, -3]}
        intensity={0.6}
        color="#1e40af"
        angle={0.6}
      />

      <DroneModel scrollProgress={scrollProgress} />
      <ExplodedStack
        scrollProgress={scrollProgress}
        onClickFC={onClickFC}
        onClickESC={onClickESC}
      />

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
      <div className="w-32 h-32 border border-[var(--color-border)] rounded-full flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-[var(--color-gold)] rounded-full animate-spin" />
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

  const handleClickFC = useCallback(() => {
    window.location.href = '/collections/all';
  }, []);

  const handleClickESC = useCallback(() => {
    window.location.href = '/collections/all';
  }, []);

  if (!mounted) {
    return <HeroFallback />;
  }

  return (
    <div className="absolute inset-0">
      <SceneErrorBoundary fallback={<HeroFallback />}>
        <Suspense fallback={<HeroFallback />}>
          <Canvas
            camera={{position: [3, 1.5, 3], fov: 45}}
            style={{background: 'transparent'}}
            gl={{antialias: true, alpha: true}}
          >
            <Scene
              scrollProgress={scrollProgress}
              onClickFC={handleClickFC}
              onClickESC={handleClickESC}
            />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
