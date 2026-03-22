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

interface DroneGroups {
  frame: THREE.Object3D[];
  pcbs: THREE.Object3D[];
}

function classifyMeshes(scene: THREE.Group): DroneGroups {
  const frame: THREE.Object3D[] = [];
  const pcbs: THREE.Object3D[] = [];

  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    let isFrame = false;
    mats.forEach((mat: any) => {
      if (!mat?.color) return;
      const {r, g, b} = mat.color;
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      if (brightness > 0.35 && saturation < 0.15) {
        isFrame = true;
        // Dark semi-transparent frame
        mat.color.set(0x444444);
        if ('metalness' in mat) mat.metalness = 0.6;
        if ('roughness' in mat) mat.roughness = 0.35;
        mat.transparent = true;
        mat.opacity = 0.45;
        mat.depthWrite = false;
      }
    });
    if (isFrame) {
      frame.push(child);
    } else {
      pcbs.push(child);
    }
  });

  return {frame, pcbs};
}

function DroneModel({
  scrollProgress,
  onClickProduct,
}: {
  scrollProgress: number;
  onClickProduct: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const frameGroupRef = useRef<Group>(null);
  const pcbGroupRef = useRef<Group>(null);
  const rotationRef = useRef(0);
  const dragRotRef = useRef({x: 0, y: 0});
  const isDragging = useRef(false);
  const lastMouse = useRef({x: 0, y: 0});

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load('/models/opendrone-full.glb', (gltf) => {
      const scene = gltf.scene;

      // Center
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center);

      // Classify and style meshes
      classifyMeshes(scene);

      // Log node tree for debugging fly-out animation
      const logTree = (obj: THREE.Object3D, depth = 0) => {
        if (depth < 3 && obj.name) {
          console.log(`${'  '.repeat(depth)}${obj.name} (${obj.type}, children: ${obj.children.length})`);
        }
        if (depth < 3) obj.children.forEach(c => logTree(c, depth + 1));
      };
      logTree(scene);

      if (groupRef.current) {
        groupRef.current.add(scene);
      }
    });
  }, []);

  // Drag-to-rotate state
  const dragRotRef = useRef({x: 0, y: 0});
  const isDragging = useRef(false);
  const lastMouse = useRef({x: 0, y: 0});

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
    if (!groupRef.current) return;

    // Auto-rotation slows on scroll, stops on drag
    if (!isDragging.current) {
      const rotSpeed = THREE.MathUtils.lerp(0.15, 0.03, scrollProgress);
      rotationRef.current += delta * rotSpeed;
    }

    // Combine auto-rotation + drag offset
    groupRef.current.rotation.y = rotationRef.current + dragRotRef.current.y;
    groupRef.current.rotation.x =
      THREE.MathUtils.lerp(0.5, 0.15, scrollProgress) + dragRotRef.current.x;

    const s = THREE.MathUtils.lerp(12, 14, scrollProgress);
    groupRef.current.scale.setScalar(s);
  });

  return (
    <group>
      <group
        ref={groupRef}
        scale={12}
        rotation={[0.5, 0, 0.05]}
        onPointerDown={onPointerDown}
      >
        <group ref={frameGroupRef} />
        <group ref={pcbGroupRef} />
      </group>
    </group>
  );
}

function CameraController({scrollProgress}: {scrollProgress: number}) {
  const {camera} = useThree();

  useFrame(() => {
    const ease = scrollProgress * scrollProgress;

    // Wide shot → close-up on center stack
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
      <DroneModel
        scrollProgress={scrollProgress}
        onClickProduct={onClickProduct}
      />
    </>
  );
}

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const scrollProgress = useScrollProgress();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClickProduct = useCallback(() => {
    window.location.href = '/collections/all';
  }, []);

  if (!mounted)
    return (
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
        onCreated={({camera}) => {
          camera.lookAt(0, 0, 0);
        }}
      >
        <Scene
          scrollProgress={scrollProgress}
          onClickProduct={handleClickProduct}
        />
      </Canvas>
    </div>
  );
}
