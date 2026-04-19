import {Canvas, useFrame, useThree, invalidate} from '@react-three/fiber';
import {useRef, useState, useEffect, useCallback} from 'react';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function useScrollProgress() {
  const progressRef = useRef(0);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => {
      progressRef.current = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 3)));
      invalidate();
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progressRef;
}

function loadModel(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function createCarbonFiberCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base dark color
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(0, 0, size, size);

  // Weave pattern — alternating light/dark rectangles
  const cell = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = even ? '#333333' : '#202020';
      ctx.fillRect(x * cell, y * cell, cell, cell);
      // Subtle diagonal highlight for weave effect
      if (even) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x * cell, y * cell, cell * 0.5, cell * 0.5);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(x * cell + cell * 0.5, y * cell + cell * 0.5, cell * 0.5, cell * 0.5);
      }
    }
  }

  return canvas;
}

function createRotatedCarbonCanvas(source: HTMLCanvasElement, rotation: number) {
  const size = source.width;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.translate(size / 2, size / 2);
  ctx.rotate(rotation);
  ctx.scale(1.42, 1.42);
  ctx.drawImage(source, -size / 2, -size / 2, size, size);

  return canvas;
}

function createCarbonFiberTextures(canvas: HTMLCanvasElement) {
  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  colorMap.repeat.set(2.8, 2.8);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 8;

  const detailMap = new THREE.CanvasTexture(canvas);
  detailMap.wrapS = detailMap.wrapT = THREE.RepeatWrapping;
  detailMap.repeat.copy(colorMap.repeat);
  detailMap.anisotropy = 8;

  return {colorMap, detailMap};
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Collapses a THREE.Group full of small meshes into one merged mesh per
 * bucket key. The GLB exports coming out of our CAD tool have 1200+
 * individual meshes which becomes 1200+ draw calls per frame. Merging
 * them into a handful of buckets (one per material variant) drops draw
 * calls to single digits and is the single biggest GPU win for this
 * scene.
 *
 * `bucketFn` returns a string key per mesh; all meshes with the same key
 * are merged into one BufferGeometry and wrapped in a single Mesh with
 * the material returned by `materialFn`.
 */
function mergeGroupByBucket(
  source: THREE.Group,
  bucketFn: (mesh: THREE.Mesh) => string,
  materialFn: (key: string) => THREE.Material,
): {group: THREE.Group; meshes: Record<string, THREE.Mesh>} {
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  source.updateMatrixWorld(true);
  source.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const key = bucketFn(mesh);
    const geom = mesh.geometry.clone();
    // Bake mesh world transform into the cloned geometry so the merged
    // result sits where the originals did.
    geom.applyMatrix4(mesh.matrixWorld);
    // mergeGeometries is strict about matching attributes; strip anything
    // non-standard before bucketing.
    const allowed = new Set(['position', 'normal', 'uv']);
    for (const name of Object.keys(geom.attributes)) {
      if (!allowed.has(name)) geom.deleteAttribute(name);
    }
    if (!geom.attributes.normal) geom.computeVertexNormals();
    if (!geom.attributes.uv) {
      const count = geom.attributes.position.count;
      geom.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(count * 2), 2),
      );
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(geom);
  });

  const group = new THREE.Group();
  const meshes: Record<string, THREE.Mesh> = {};
  for (const [key, geoms] of buckets.entries()) {
    const merged = mergeGeometries(geoms, false);
    // dispose source clones regardless of merge success
    geoms.forEach((g) => g.dispose());
    if (!merged) continue;
    const material = materialFn(key);
    const mesh = new THREE.Mesh(merged, material);
    mesh.frustumCulled = true;
    group.add(mesh);
    meshes[key] = mesh;
  }

  // Dispose the source scene's original geometries and materials — we've
  // replaced them with the merged version.
  source.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => m && (m as THREE.Material).dispose?.());
  });

  return {group, meshes};
}

export type LabelRefs = {
  fc: React.RefObject<HTMLDivElement | null>;
  frame: React.RefObject<HTMLDivElement | null>;
  esc: React.RefObject<HTMLDivElement | null>;
};

function DroneAssembly({
  scrollRef,
  onReady,
  labelRefs,
}: {
  scrollRef: React.RefObject<number>;
  onReady?: () => void;
  labelRefs?: LabelRefs;
}) {
  const {camera, size} = useThree();
  const tmpVec = useRef(new THREE.Vector3()).current;
  const bboxVec = useRef(new THREE.Vector3()).current;
  const bbox = useRef(new THREE.Box3()).current;
  const wrapperRef = useRef<Group>(null);
  const frameRef = useRef<Group>(null);
  const escRef = useRef<Group>(null);
  const fcRef = useRef<Group>(null);

  const rotRef = useRef(0);
  const dragRef = useRef({x: 0, y: 0});
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const lastPtr = useRef({x: 0, y: 0});
  const dampedP = useRef(0);
  const frameMats = useRef<any[]>([]);
  const escMats = useRef<any[]>([]);
  const fcMats = useRef<any[]>([]);
  const hoverState = useRef({frame: 0, esc: 0, fc: 0});
  const hoverTarget = useRef({frame: 0, esc: 0, fc: 0});
  const frameLightRef = useRef<THREE.PointLight>(null);
  const escLightRef = useRef<THREE.PointLight>(null);
  const fcLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    let cancelled = false;

    let carbonMaps:
      | {
          colorMap: THREE.CanvasTexture;
          detailMap: THREE.CanvasTexture;
          armColorMap: THREE.CanvasTexture;
          armDetailMap: THREE.CanvasTexture;
        }
      | null = null;

    // Groups that survive merging — we dispose the source scenes but
    // keep these so the effect cleanup can drop them from the refs.
    const mergedGroups: THREE.Group[] = [];

    Promise.all([
      loadModel('/models/frame.glb'),
      loadModel('/models/esc.glb'),
      loadModel('/models/fc.glb'),
    ]).then(([frameScene, escScene, fcScene]) => {
      if (cancelled) return;

      const box = new THREE.Box3().setFromObject(frameScene);
      const c = box.getCenter(new THREE.Vector3());
      frameScene.position.sub(c);
      escScene.position.sub(c);
      fcScene.position.sub(c);
      // Bake the recentering transform into the mesh world matrices so
      // the merge helper picks it up.
      frameScene.updateMatrixWorld(true);
      escScene.updateMatrixWorld(true);
      fcScene.updateMatrixWorld(true);

      const baseCanvas = createCarbonFiberCanvas();
      const armCanvas = createRotatedCarbonCanvas(baseCanvas, Math.PI / 4);
      const baseMaps = createCarbonFiberTextures(baseCanvas);
      const armMaps = createCarbonFiberTextures(armCanvas);
      carbonMaps = {
        ...baseMaps,
        armColorMap: armMaps.colorMap,
        armDetailMap: armMaps.detailMap,
      };
      const {colorMap, detailMap, armColorMap, armDetailMap} = carbonMaps;

      // Build two frame materials — arm (rotated carbon) and body
      // (straight carbon). Every frame mesh ends up in exactly one of
      // these two buckets, so the entire frame renders in 2 draw calls.
      const makeFrameMaterial = (arm: boolean) => {
        const m = new THREE.MeshStandardMaterial({
          color: 0xf2f2f2,
          metalness: 0.16,
          roughness: 0.58,
          map: arm ? armColorMap : colorMap,
          roughnessMap: arm ? armDetailMap : detailMap,
          bumpMap: arm ? armDetailMap : detailMap,
          bumpScale: 0.01,
          transparent: true,
          opacity: 0.62,
          // depthWrite stays true to avoid the per-frame z-sort flicker
          // ("shimmering fire" look) when rotating the transparent frame.
          depthWrite: true,
        });
        return m;
      };
      const frameBodyMat = makeFrameMaterial(false);
      const frameArmMat = makeFrameMaterial(true);

      const framePack = mergeGroupByBucket(
        frameScene,
        (mesh) => (/^arm/i.test(mesh.name ?? '') ? 'arm' : 'body'),
        (key) => (key === 'arm' ? frameArmMat : frameBodyMat),
      );

      // ESC + FC: keep the original materials but merge meshes that
      // share the same material reference. This drops hundreds of draw
      // calls without changing the visual.
      const mergeByMaterialRef = (scene: THREE.Group) => {
        const materialsByKey = new Map<string, THREE.Material>();
        return mergeGroupByBucket(
          scene,
          (mesh) => {
            const mat = Array.isArray(mesh.material)
              ? mesh.material[0]
              : mesh.material;
            if (!mat) return 'default';
            const key = mat.uuid;
            if (!materialsByKey.has(key)) materialsByKey.set(key, mat);
            return key;
          },
          (key) =>
            materialsByKey.get(key) ||
            new THREE.MeshStandardMaterial({color: 0x999999}),
        );
      };

      const escPack = mergeByMaterialRef(escScene);
      const fcPack = mergeByMaterialRef(fcScene);

      frameMats.current = [frameBodyMat, frameArmMat];
      escMats.current = Array.from(
        new Set(escPack.group.children.map((m) => (m as THREE.Mesh).material)),
      ).filter(Boolean) as THREE.Material[];
      fcMats.current = Array.from(
        new Set(fcPack.group.children.map((m) => (m as THREE.Mesh).material)),
      ).filter(Boolean) as THREE.Material[];

      mergedGroups.push(framePack.group, escPack.group, fcPack.group);

      frameRef.current?.add(framePack.group);
      escRef.current?.add(escPack.group);
      fcRef.current?.add(fcPack.group);
      invalidate();
      onReady?.();
    }).catch((err) => {
      console.error('Failed to load drone models:', err);
      // Surface completion even on failure so the splash can release.
      onReady?.();
    });

    return () => {
      cancelled = true;
      carbonMaps?.colorMap.dispose();
      carbonMaps?.detailMap.dispose();
      carbonMaps?.armColorMap.dispose();
      carbonMaps?.armDetailMap.dispose();
      // Clean up models from groups on unmount
      [frameRef, escRef, fcRef].forEach((ref) => {
        if (!ref.current) return;
        while (ref.current.children.length) {
          const child = ref.current.children[0];
          ref.current.remove(child);
          child.traverse((obj: any) => {
            if (obj.isMesh) {
              obj.geometry?.dispose();
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((m: any) => m?.dispose());
            }
          });
        }
      });
      mergedGroups.length = 0;
    };
  }, []);

  const onDown = useCallback((e: any) => {
    dragging.current = true;
    dragMoved.current = false;
    lastPtr.current = {x: e.clientX, y: e.clientY};
  }, []);

  useEffect(() => {
    const onUp = () => {
      dragging.current = false;
      invalidate();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPtr.current.x;
      const dy = e.clientY - lastPtr.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
      dragRef.current.y += dx * 0.004;
      dragRef.current.x += dy * 0.004;
      lastPtr.current = {x: e.clientX, y: e.clientY};
      invalidate();
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

    const prevP = dampedP.current;
    const p = scrollRef.current;
    dampedP.current = p;

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

    // Always decay drag after release — absorb into rotRef to avoid unwinding
    if (!dragging.current) {
      const decayRate = Math.min(1, 3 * dt);
      const absorbY = dragRef.current.y * decayRate * dragInf;
      const absorbX = dragRef.current.x * decayRate;
      rotRef.current += absorbY;
      dragRef.current.y -= absorbY / (dragInf || 1);
      dragRef.current.x -= absorbX;
      // Snap to zero when close enough
      if (Math.abs(dragRef.current.y) < 0.0005) dragRef.current.y = 0;
      if (Math.abs(dragRef.current.x) < 0.0005) dragRef.current.x = 0;
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
    for (const mat of frameMats.current) {
      if (!mat?.transparent) continue;
      mat.opacity = flyOut < 0.5 ? THREE.MathUtils.lerp(0.62, 0.9, frameOpacity) : 0.9;
      const brightness = THREE.MathUtils.lerp(0x8a, 0xb8, flyOut);
      mat.color.setRGB(brightness / 255, brightness / 255, brightness / 255);
    }
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

    // Hover effect — subtle gold tint + brightness boost on object, backglow via point light
    const goldTint = new THREE.Color(0xb8922e);
    const black = new THREE.Color(0x000000);
    let glowAnimating = false;
    const lights = {frame: frameLightRef, esc: escLightRef, fc: fcLightRef};
    // Default glow when stacked, fades out during flyout, hover-only after
    const defaultGlow = 1 - flyOut; // 1 when stacked, 0 after flyout
    // Clear hover when scrolled back before interactive threshold
    if (p < 0.65) {
      hoverTarget.current.frame = 0;
      hoverTarget.current.esc = 0;
      hoverTarget.current.fc = 0;
      document.body.style.cursor = '';
    }
    for (const key of ['frame', 'esc', 'fc'] as const) {
      const target = hoverTarget.current[key];
      const prev = hoverState.current[key];
      hoverState.current[key] += (target - prev) * Math.min(1, 8 * dt);
      if (Math.abs(hoverState.current[key] - target) > 0.01) glowAnimating = true;
      const baseGlow = key === 'frame' ? 0 : defaultGlow;
      const intensity = Math.max(baseGlow, hoverState.current[key]);
      // Subtle gold emissive tint on the object
      const mats = key === 'frame' ? frameMats : key === 'esc' ? escMats : fcMats;
      for (const m of mats.current) {
        if (!m || !('emissive' in m)) continue;
        (m as any).emissive.copy(black).lerp(goldTint, intensity * 0.1);
        (m as any).emissiveIntensity = 1 + intensity * 0.5;
      }
      // Backglow point light
      const light = lights[key].current;
      if (light) light.intensity = intensity * 2.5;
    }
    // Note: defaultGlow is a pure function of scroll progress; it does
    // not "animate" on its own, so we do NOT force glowAnimating=true
    // when it's non-zero.

    // Project model world positions to screen coords and update the
    // label overlay divs imperatively — keeps labels glued under each
    // board as the assembly rotates/moves, without triggering React
    // re-renders every frame.
    if (labelRefs) {
      wrapperRef.current.updateMatrixWorld(true);
      const project = (
        target: React.RefObject<HTMLDivElement | null>,
        group: Group | null,
      ) => {
        const el = target.current;
        if (!el || !group) return;
        // Use each model's actual bounding-box center in world space so
        // the label sits under the visible geometry, not under the
        // potentially-off origin the GLB was exported with.
        bbox.setFromObject(group);
        if (bbox.isEmpty()) {
          el.style.opacity = '0';
          return;
        }
        bbox.getCenter(bboxVec);
        tmpVec.set(bboxVec.x, bbox.min.y, bboxVec.z).project(camera);
        // Hide labels that are behind the camera or off-screen.
        if (tmpVec.z > 1) {
          el.style.opacity = '0';
          return;
        }
        const x = (tmpVec.x * 0.5 + 0.5) * size.width;
        const y = (-tmpVec.y * 0.5 + 0.5) * size.height;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, 0)`;
        el.style.opacity = '';
      };
      project(labelRefs.fc, fcRef.current);
      project(labelRefs.frame, frameRef.current);
      project(labelRefs.esc, escRef.current);
    }

    // Keep rendering whenever anything is moving. Now that draw calls
    // are in the single digits the scene is cheap enough to let the
    // browser's RAF drive it at display rate.
    const scrollChanged = Math.abs(p - prevP) > 0.0001;
    const isAutoRotating = rotSlow < 0.99;
    const hasDragMomentum =
      Math.abs(dragRef.current.x) > 0.0005 ||
      Math.abs(dragRef.current.y) > 0.0005;
    if (
      scrollChanged ||
      dragging.current ||
      hasDragMomentum ||
      glowAnimating ||
      isAutoRotating
    ) {
      invalidate();
    }
  });

  const isInteractive = useCallback(() => scrollRef.current >= 0.65, [scrollRef]);

  const handleClick = useCallback((url: string) => {
    if (!dragMoved.current && isInteractive()) {
      window.location.href = url;
    }
  }, [isInteractive]);

  const hover = useCallback((key: 'frame' | 'esc' | 'fc', value: boolean) => {
    if (!isInteractive()) return;
    hoverTarget.current[key] = value ? 1 : 0;
    document.body.style.cursor = value ? 'pointer' : '';
    invalidate();
  }, [isInteractive]);

  return (
    <group ref={wrapperRef} scale={7} rotation={[0.45, 0, 0.05]} onPointerDown={onDown}>
      <group
        ref={frameRef}
        onPointerOver={() => hover('frame', true)}
        onPointerOut={() => hover('frame', false)}
        onClick={() => handleClick('/products/openframe')}
      >
        <pointLight ref={frameLightRef} color={0xb8922e} intensity={0} distance={0.3} position={[0, -0.03, 0]} />
      </group>
      <group
        ref={escRef}
        onPointerOver={() => hover('esc', true)}
        onPointerOut={() => hover('esc', false)}
        onClick={() => handleClick('/products/openesc')}
      >
        <pointLight ref={escLightRef} color={0xb8922e} intensity={0} distance={0.3} position={[0, -0.03, 0]} />
      </group>
      <group
        ref={fcRef}
        onPointerOver={() => hover('fc', true)}
        onPointerOut={() => hover('fc', false)}
        onClick={() => handleClick('/products/openfc')}
      >
        <pointLight ref={fcLightRef} color={0xb8922e} intensity={0} distance={0.3} position={[0, -0.03, 0]} />
      </group>
    </group>
  );
}

type PerfSample = {
  fps: number;
  renderMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  width: number;
  height: number;
};

function PerfProbe({
  onSample,
}: {
  onSample: (s: PerfSample) => void;
}) {
  const {gl, size, viewport} = useThree();
  const frames = useRef(0);
  const lastT = useRef(performance.now());
  const intervalAccum = useRef(0);
  const prevFrameT = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (prevFrameT.current) {
      intervalAccum.current += now - prevFrameT.current;
    }
    prevFrameT.current = now;
    frames.current += 1;

    if (now - lastT.current >= 500) {
      const elapsed = now - lastT.current;
      const avgInterval =
        frames.current > 1 ? intervalAccum.current / (frames.current - 1) : 0;
      onSample({
        fps: Math.round((frames.current * 1000) / elapsed),
        // Average interval between consecutive useFrame calls in ms —
        // inverse of fps. Not a "render cost" measurement; use Chrome
        // DevTools Performance panel for that.
        renderMs: +avgInterval.toFixed(2),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        dpr: viewport.dpr,
        width: Math.round(size.width),
        height: Math.round(size.height),
      });
      frames.current = 0;
      intervalAccum.current = 0;
      lastT.current = now;
    }
  });
  return null;
}

function CameraRig({scrollRef}: {scrollRef: React.RefObject<number>}) {
  const {camera} = useThree();

  useFrame(() => {
    const p = scrollRef.current;

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

const PERF_HUD = false;

export function HeroScene({
  onReady,
  labelRefs,
}: {onReady?: () => void; labelRefs?: LabelRefs} = {}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(true);
  const [perf, setPerf] = useState<PerfSample | null>(null);
  const scrollRef = useScrollProgress();
  useEffect(() => { setMounted(true); }, []);

  // Pause the WebGL canvas entirely when the tab is hidden or the hero
  // has scrolled well off-screen. Unmounting the Canvas releases the GPU
  // context; React re-mounts it instantly when the hero returns to view.
  useEffect(() => {
    const update = () => {
      const visible = document.visibilityState === 'visible';
      const heroOnScreen =
        window.scrollY < window.innerHeight * 8; // matches HERO_SPACER_VH
      setActive(visible && heroOnScreen);
    };
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('scroll', update, {passive: true});
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('scroll', update);
    };
  }, []);

  if (!mounted) return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-16 h-16 border border-[var(--color-border)] rounded-full flex items-center justify-center">
        <div className="w-8 h-8 border-t border-[var(--color-gold)] rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!active) {
    return (
      <div
        className="absolute inset-0"
        role="img"
        aria-label="3D interactive drone assembly viewer (paused)"
      />
    );
  }

  return (
    <div className="absolute inset-0" role="img" aria-label="3D interactive drone assembly viewer">
      <Canvas
        camera={{position: [0, 0.15, 0.7], fov: 40}}
        style={{background: 'transparent'}}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({camera, gl}) => {
          camera.lookAt(0, 0, 0);
          gl.toneMappingExposure = 0.95;
          invalidate();
        }}
      >
        <ambientLight intensity={0.22} />
        <hemisphereLight args={['#d9e2f2', '#0d120f', 0.8]} />
        <directionalLight position={[3.5, 4.5, 6]} intensity={2.0} color="#fffaf0" />
        <directionalLight position={[-5, 2.5, 1.5]} intensity={0.5} color="#b7c6de" />
        <CameraRig scrollRef={scrollRef} />
        <DroneAssembly scrollRef={scrollRef} onReady={onReady} labelRefs={labelRefs} />
        {PERF_HUD ? <PerfProbe onSample={setPerf} /> : null}
      </Canvas>
      {PERF_HUD && perf ? (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 16,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(184,146,46,0.4)',
            borderRadius: 6,
            color: '#e5e5e5',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1.5,
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'pre',
          }}
        >
          {`FPS       ${perf.fps}
FRAME MS  ${perf.renderMs}
DRAW      ${perf.drawCalls}
TRIS      ${perf.triangles}
GEOMS     ${perf.geometries}
TEX       ${perf.textures}
PROGS     ${perf.programs}
DPR       ${perf.dpr}
SIZE      ${perf.width}x${perf.height}`}
        </div>
      ) : null}
    </div>
  );
}
