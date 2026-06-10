import {Canvas, useFrame, useThree, invalidate} from '@react-three/fiber';
import {EffectComposer, SMAA} from '@react-three/postprocessing';
import {useRef, useState, useEffect, useCallback} from 'react';
import {useNavigate} from 'react-router';
import type {Group} from 'three';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The hero GLBs use EXT_meshopt_compression (the Onshape assemblies are
// decimated to a few MB/size this way). MeshoptDecoder decodes on the main
// thread — unlike DRACOLoader, which spins up a blob: Web Worker that
// Hydrogen's CSP (worker-src) blocks, causing the loader to hang silently.
function getGLTFLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

// Two refs: `target` is the raw scroll position (updated on every scroll event,
// at the browser's coarse/irregular event cadence) and `smooth` is what the
// scene actually reads. <ScrollDamper> eases smooth → target each frame so the
// camera/explode interpolate fluidly between scroll events instead of snapping
// to each one in visible steps.
function useScrollProgress() {
  const targetRef = useRef(0);
  const smoothRef = useRef(0);
  useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => {
      targetRef.current = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      invalidate();
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return {targetRef, smoothRef};
}

// Frame-rate-independent exponential smoothing of the scroll progress, PLUS a
// max-velocity clamp. Runs as the first useFrame in the Canvas so downstream
// consumers (lights, camera, assembly) read the freshly-eased value the same
// frame. Keeps re-invalidating while catching up, then snaps exactly to target
// and goes quiet so the demand loop can idle.
//
// RATE (~1/RATE s time constant) governs the gentle ease for ordinary scrolling.
// MAX_RATE caps how fast the animation can advance in progress-units/second:
// when you fling the page hard, the raw scroll target leaps to the end, but the
// scene is not allowed to traverse the whole sequence in two frames — it glides
// at a watchable speed instead of teleporting. Normal slow scrolling never hits
// the cap (its per-frame step is well under it), so it stays directly coupled.
const SCROLL_RATE = 14;
const SCROLL_MAX_VEL = 1.3; // full 0→1 sweep can't play faster than ~0.77s
function ScrollDamper({
  targetRef,
  smoothRef,
}: {
  targetRef: React.RefObject<number>;
  smoothRef: React.RefObject<number>;
}) {
  useFrame((_, dt) => {
    const target = targetRef.current;
    const diff = target - smoothRef.current;
    if (Math.abs(diff) < 0.0002) {
      if (smoothRef.current !== target) {
        smoothRef.current = target;
        invalidate();
      }
      return;
    }
    // Clamp dt so a long stall (tab refocus, GC pause) can't snap the value.
    const cdt = Math.min(dt, 0.1);
    let step = diff * (1 - Math.exp(-cdt * SCROLL_RATE));
    // Velocity cap — bounds the per-frame jump so a momentum fling plays the
    // animation at a controlled rate rather than skipping through it.
    const maxStep = SCROLL_MAX_VEL * cdt;
    if (step > maxStep) step = maxStep;
    else if (step < -maxStep) step = -maxStep;
    smoothRef.current += step;
    invalidate();
  });
  return null;
}

function loadModel(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    getGLTFLoader().load(
      url,
      (gltf) => resolve(gltf.scene),
      (event) => {
        // Content-Length may be missing for cached responses or when the
        // server doesn't set it — `lengthComputable` is the canonical
        // signal. Caller treats unknown totals as a synthetic 0..1 ramp.
        if (event.lengthComputable) onProgress?.(event.loaded, event.total);
        else onProgress?.(event.loaded, 0);
      },
      reject,
    );
  });
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Module-level reusable Color instances — saves two allocations per
// useFrame tick (which at 120Hz is ~14k allocs/min into the GC).
const GOLD_TINT = new THREE.Color(0xb8922e);
const BLACK = new THREE.Color(0x000000);

/**
 * KiCad/Blender GLB exports typically produce a fresh material instance
 * per mesh, even when many meshes share identical colour/map/PBR settings.
 * `mergeByMaterialRef` buckets by uuid so each of those duplicates becomes
 * its own draw call. Walk the scene first and collapse materials with
 * matching visual fingerprints into a single shared instance — buckets
 * then collapse with them, dropping the draw-call count substantially.
 */
function dedupeMaterialsByFingerprint(scene: THREE.Group) {
  const pool = new Map<string, THREE.Material>();
  const fp = (m: any) => {
    const c = m.color?.getHexString?.() ?? '_';
    const e = m.emissive?.getHexString?.() ?? '_';
    const map = m.map?.uuid ?? '_';
    const norm = m.normalMap?.uuid ?? '_';
    const meta = (m.metalness ?? 0).toFixed(3);
    const rough = (m.roughness ?? 0).toFixed(3);
    const opa = (m.opacity ?? 1).toFixed(3);
    return `${m.type}|${c}|${e}|${map}|${norm}|${meta}|${rough}|${m.transparent ? 1 : 0}|${opa}|${m.side}`;
  };
  const swap = (m: THREE.Material | null | undefined) => {
    if (!m) return m;
    const key = fp(m);
    const existing = pool.get(key);
    if (existing && existing !== m) {
      m.dispose?.();
      return existing;
    }
    pool.set(key, m);
    return m;
  };
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => swap(m)!).filter(Boolean) as THREE.Material[];
    } else {
      const next = swap(mesh.material);
      if (next) mesh.material = next;
    }
  });
}

/**
 * GLB exports from PCB tooling often ship as MeshBasicMaterial (unlit) so
 * the boards look the same under any lighting — bright, flat, no shading.
 * Replace any non-PBR material with a MeshStandardMaterial that preserves
 * the colour/map but actually responds to scene lights.
 */
function upgradeNonPBRMaterials(scene: THREE.Group) {
  const replaced = new Map<string, THREE.MeshStandardMaterial>();
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const swap = (m: THREE.Material | null | undefined) => {
      if (!m) return m;
      const any = m as any;
      if (any.isMeshStandardMaterial || any.isMeshPhysicalMaterial) return m;
      const existing = replaced.get(m.uuid);
      if (existing) return existing;
      const upgraded = new THREE.MeshStandardMaterial({
        color: any.color?.clone?.() ?? new THREE.Color(0xffffff),
        map: any.map ?? null,
        normalMap: any.normalMap ?? null,
        roughness: 0.78,
        metalness: 0.0,
        transparent: !!any.transparent,
        opacity: any.opacity ?? 1,
        side: any.side ?? THREE.FrontSide,
      });
      replaced.set(m.uuid, upgraded);
      return upgraded;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material = mats.map((m) => swap(m)).filter(Boolean) as THREE.Material[];
    } else {
      const next = swap(mesh.material);
      if (next) mesh.material = next;
    }
  });
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
      // No material samples UVs (frame is a flat colour; boards are untextured),
      // but mergeGeometries needs every primitive in a bucket to share the same
      // attribute set — give the UV-less ones zeroed coords.
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

// A fully-processed airframe ready to drop into the scene: the three merged
// groups and their material lists (for hover/opacity animation).
type BuiltModel = {
  frame: THREE.Group;
  esc: THREE.Group;
  fc: THREE.Group;
  frameMats: THREE.Material[];
  escMats: THREE.Material[];
  fcMats: THREE.Material[];
};

function disposeBuiltModel(m: BuiltModel) {
  for (const g of [m.frame, m.esc, m.fc]) {
    g.parent?.remove(g);
    g.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat: any) => mat?.dispose());
      }
    });
  }
}

function DroneAssembly({
  scrollRef,
  onReady,
  onProgress,
  labelRefs,
  loadDelayMs,
  size: airframeSize,
  onNavigate,
}: {
  scrollRef: React.RefObject<number>;
  onReady?: () => void;
  onProgress?: (progress: number) => void;
  labelRefs?: LabelRefs;
  /** Client-side navigate, threaded from HeroScene (outside the r3f Canvas,
   *  where Router context is available). Used by the part hotspots so a click
   *  is an instant SPA transition into the prefetched PDP rather than a full
   *  document reload. */
  onNavigate?: (url: string) => void;
  /** Delay the network fetch + parse + post-processing of the GLBs by this
   *  many ms so the homepage's CSS wireframe animation gets a clean main
   *  thread for its first frames. Cached visits already see ms-scale loads
   *  so the delay there is invisible. */
  loadDelayMs?: number;
  /** Which airframe to show — '5' (5-inch) or '3' (3-inch). Each maps to a
   *  size-specific GLB trio (frame{N}/fc{N}/esc{N}). Changing it reloads. */
  size: '5' | '3';
}) {
  const {camera, gl, scene, size} = useThree();
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
  const focusedRef = useRef(true);
  const frameMats = useRef<any[]>([]);
  const escMats = useRef<any[]>([]);
  const fcMats = useRef<any[]>([]);
  const hoverState = useRef({frame: 0, esc: 0, fc: 0});
  const hoverTarget = useRef({frame: 0, esc: 0, fc: 0});
  // Per-size processed models, kept alive across toggles so switching back is
  // instant (no re-fetch / re-decode / re-merge). The inactive size is built
  // lazily on idle AFTER the active one is shown, so it never slows first load.
  const modelCacheRef = useRef<Map<'5' | '3', BuiltModel>>(new Map());
  // Cross-slide transition progress for the most recent swap (0→1). Starts at 1
  // (settled) so the very first model doesn't animate in. On a toggle the new
  // assembly slides in from the right while the previous one slides out to the
  // left in `outWrapperRef`.
  const transitionRef = useRef(1);
  const hasDisplayedRef = useRef(false);
  const outWrapperRef = useRef<Group>(null);
  const prevModelRef = useRef<BuiltModel | null>(null); // currently displayed
  const outgoingRef = useRef<BuiltModel | null>(null); // sliding out (in outWrapper)
  const outBaseXRef = useRef(0);
  const outBaseScaleRef = useRef(7);
  // Flipped false on unmount so a background preload that finishes afterwards
  // disposes its model instead of leaking it into a torn-down cache.
  const aliveRef = useRef(true);
  // Light vs dark site theme (the `light` class on <html>). The frame is
  // transparent in both, but on the light page it needs to be a touch darker +
  // more solid so it reads instead of the pale page bleeding through.
  const lightRef = useRef(false);
  useEffect(() => {
    const read = () => {
      lightRef.current = document.documentElement.classList.contains('light');
      invalidate();
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
    return () => obs.disconnect();
  }, []);

  // Detach the outgoing model's groups from the slide-out wrapper (they return
  // to the cache for reuse — never disposed here).
  const finishOutgoing = useCallback(() => {
    const og = outgoingRef.current;
    if (og && outWrapperRef.current) {
      for (const g of [og.frame, og.esc, og.fc]) outWrapperRef.current.remove(g);
    }
    outgoingRef.current = null;
  }, []);


  useEffect(() => {
    let cancelled = false;

    const yieldToMain = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));

    // Load + fully process one size's GLB trio into a BuiltModel. It never
    // touches the scene/refs, so the result can be cached and dropped in later,
    // or built ahead of time for the inactive size. Returns null if cancelled
    // or on error (freeing any partial GPU resources first).
    async function buildModel(
      sz: '5' | '3',
      opts: {
        onProg?: (p: number) => void;
        delayMs?: number;
        shouldCancel: () => boolean;
      },
    ): Promise<BuiltModel | null> {
      const {onProg, delayMs = 0, shouldCancel} = opts;
      const packs: Array<{group: THREE.Group}> = [];
      const bail = (): null => {
        for (const p of packs)
          p.group.traverse((o: any) => {
            if (o.isMesh) {
              o.geometry?.dispose();
              (Array.isArray(o.material) ? o.material : [o.material]).forEach(
                (m: any) => m?.dispose(),
              );
            }
          });
        return null;
      };
      try {
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
          if (shouldCancel()) return null;
        }

        const loaded = [0, 0, 0];
        const total = [0, 0, 0];
        const reportProgress = () => {
          if (!onProg) return;
          let l = 0, t = 0, known = 0;
          for (let i = 0; i < 3; i++)
            if (total[i] > 0) { l += loaded[i]; t += total[i]; known += 1; }
          onProg(known === 0 ? -1 : Math.min(1, l / t));
        };
        const [frameScene, escScene, fcScene] = await Promise.all([
          loadModel(`/models/frame${sz}.glb`, (l, t) => { loaded[0] = l; total[0] = t; reportProgress(); }),
          loadModel(`/models/esc${sz}.glb`, (l, t) => { loaded[1] = l; total[1] = t; reportProgress(); }),
          loadModel(`/models/fc${sz}.glb`, (l, t) => { loaded[2] = l; total[2] = t; reportProgress(); }),
        ]);
        if (shouldCancel()) return null;

        // Raw Onshape geometry (metres). Fit to a ~0.124-unit frame with ONE
        // uniform scale across the trio — display only; proportions/positions
        // stay exactly as exported.
        const FIT_FRAME_SIZE = 0.124;
        const fbox = new THREE.Box3().setFromObject(frameScene);
        const fsize = fbox.getSize(new THREE.Vector3());
        const fit = FIT_FRAME_SIZE / Math.max(fsize.x, fsize.y, fsize.z, 1e-6);
        for (const s of [frameScene, escScene, fcScene]) s.scale.setScalar(fit);
        frameScene.updateMatrixWorld(true); escScene.updateMatrixWorld(true); fcScene.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(frameScene);
        const c = box.getCenter(new THREE.Vector3());
        frameScene.position.sub(c); escScene.position.sub(c); fcScene.position.sub(c);
        frameScene.updateMatrixWorld(true); escScene.updateMatrixWorld(true); fcScene.updateMatrixWorld(true);

        await yieldToMain(); if (shouldCancel()) return null;
        upgradeNonPBRMaterials(escScene);
        await yieldToMain(); if (shouldCancel()) return null;
        upgradeNonPBRMaterials(fcScene);
        await yieldToMain(); if (shouldCancel()) return null;
        dedupeMaterialsByFingerprint(escScene);
        await yieldToMain(); if (shouldCancel()) return null;
        dedupeMaterialsByFingerprint(fcScene);
        await yieldToMain(); if (shouldCancel()) return null;

        // Plain dark frame material — flat carbon colour, no woven texture.
        // Stays partly transparent so the boards read through it; the colour is
        // animated per-frame (see frameMats in useFrame).
        const frameMat = new THREE.MeshStandardMaterial({
          // Matte, near-non-metallic so the warm key light doesn't bloom the
          // frame into a tan/grey plastic look — it should read as dark carbon.
          color: 0xf2f2f2, metalness: 0.0, roughness: 0.82,
          transparent: true, opacity: 0.62, depthWrite: true,
          // polygonOffset pushes the transparent frame's depth back so the
          // near-coplanar plates/boards don't z-fight (keeps see-through frame).
          polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
        });
        const framePack = mergeGroupByBucket(
          frameScene,
          () => 'body',
          () => frameMat,
        );
        packs.push(framePack);
        await yieldToMain(); if (shouldCancel()) return bail();

        // ESC + FC: keep original materials, merge meshes sharing a material.
        const mergeByMaterialRef = (scene: THREE.Group) => {
          const materialsByKey = new Map<string, THREE.Material>();
          return mergeGroupByBucket(
            scene,
            (mesh) => {
              const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
              if (!mat) return 'default';
              const key = mat.uuid;
              if (!materialsByKey.has(key)) materialsByKey.set(key, mat);
              return key;
            },
            (key) => materialsByKey.get(key) || new THREE.MeshStandardMaterial({color: 0x999999}),
          );
        };
        const escPack = mergeByMaterialRef(escScene);
        packs.push(escPack);
        await yieldToMain(); if (shouldCancel()) return bail();
        const fcPack = mergeByMaterialRef(fcScene);
        packs.push(fcPack);
        await yieldToMain(); if (shouldCancel()) return bail();

        const frameMatsArr: THREE.Material[] = [frameMat];
        const escMatsArr = Array.from(
          new Set(escPack.group.children.map((m) => (m as THREE.Mesh).material)),
        ).filter(Boolean) as THREE.Material[];
        const fcMatsArr = Array.from(
          new Set(fcPack.group.children.map((m) => (m as THREE.Mesh).material)),
        ).filter(Boolean) as THREE.Material[];
        for (const m of [...escMatsArr, ...fcMatsArr]) {
          if (!m) continue;
          // Force-zero board emissive so they only show the spotlight, not self-lit.
          if ('emissive' in m) {
            (m as any).emissive.setHex(0x000000);
            (m as any).emissiveIntensity = 0;
          }
          // Onshape exports every board material DOUBLE-SIDED. PCBs are solid,
          // so the inside/back faces never should show — and double-siding makes
          // near-coplanar pad/board faces flicker through one another as the
          // model rotates. Render front-only: correct for a solid and it removes
          // the back-face z-fighting that drove the gold-pad shimmer.
          (m as any).side = THREE.FrontSide;
          (m as any).needsUpdate = true;
        }
        const setShadowFlags = (g: THREE.Group, cast: boolean, receive: boolean) => {
          g.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = cast;
            mesh.receiveShadow = receive;
          });
        };
        // Frame: receives only (it's transparent, so it never casts cleanly).
        setShadowFlags(framePack.group, false, true);
        // Boards: OUT of shadows entirely. They used to self-shadow (cast+receive),
        // which on the down-scaled 5" board produced crawling shadow-acne across
        // the fine pad geometry — a fixed world-space bias + fixed shadow-map
        // texel size can't resolve features that small, so the depth comparison
        // flips per-texel as the view rotates. Dropping board self-shadow kills
        // it (and is a small perf win); the look is unchanged at hero distance.
        setShadowFlags(escPack.group, false, false);
        setShadowFlags(fcPack.group, false, false);

        return {
          frame: framePack.group, esc: escPack.group, fc: fcPack.group,
          frameMats: frameMatsArr, escMats: escMatsArr, fcMats: fcMatsArr,
        };
      } catch (err) {
        console.error('Failed to load drone models:', err);
        return bail();
      }
    }

    // Drop a built model into the scene. On a toggle, hand the previous trio to
    // the slide-out wrapper (cached, NOT disposed) so it can exit left while the
    // new one slides in from the right. Models are never disposed here.
    const display = (model: BuiltModel) => {
      const prev = prevModelRef.current;
      const isToggle = hasDisplayedRef.current && !!prev && prev !== model;

      if (isToggle && outWrapperRef.current && wrapperRef.current) {
        finishOutgoing(); // clear any still-in-flight slide-out first
        // Reparent the previous trio into the slide-out wrapper, frozen at the
        // main wrapper's current transform, then it just translates left.
        outWrapperRef.current.add(prev.frame, prev.esc, prev.fc);
        outWrapperRef.current.position.copy(wrapperRef.current.position);
        outWrapperRef.current.quaternion.copy(wrapperRef.current.quaternion);
        outWrapperRef.current.scale.copy(wrapperRef.current.scale);
        outBaseXRef.current = wrapperRef.current.position.x;
        outBaseScaleRef.current = wrapperRef.current.scale.x;
        outgoingRef.current = prev;
      }

      // Main wrapper now holds only the incoming trio.
      for (const ref of [frameRef, escRef, fcRef]) {
        while (ref.current && ref.current.children.length) {
          ref.current.remove(ref.current.children[0]);
        }
      }
      for (const g of [model.frame, model.esc, model.fc]) g.parent?.remove(g);
      frameRef.current?.add(model.frame);
      escRef.current?.add(model.esc);
      fcRef.current?.add(model.fc);
      frameMats.current = model.frameMats;
      escMats.current = model.escMats;
      fcMats.current = model.fcMats;
      if (isToggle) transitionRef.current = 0;
      hasDisplayedRef.current = true;
      prevModelRef.current = model;
      // Force shader compilation NOW rather than lazily during the scroll.
      // three.js builds a GLSL program per material × light × shadow variant on
      // first render; doing that mid-animation is what made the scene choppy
      // until it "warmed up", and made the first scroll right after a size
      // toggle lag hard. gl.compile walks the scene and builds them all up
      // front — on initial load we're behind the splash, so the cost is hidden.
      try { gl.compile(scene, camera); } catch { /* compile is best-effort */ }
      invalidate();
    };

    void (async () => {
      let model: BuiltModel | null | undefined = modelCacheRef.current.get(airframeSize);
      if (!model) {
        model = await buildModel(airframeSize, {
          onProg: onProgress,
          delayMs: loadDelayMs ?? 0,
          shouldCancel: () => cancelled,
        });
        if (!model) {
          onReady?.(); // release the splash even on failure / cancel
          return;
        }
        modelCacheRef.current.set(airframeSize, model);
      }
      if (cancelled) return;
      display(model);
      onReady?.();

      // Build the OTHER size lazily, only once the thread is idle — scheduled
      // AFTER the active model is shown so it never delays the initial load.
      const other: '5' | '3' = airframeSize === '5' ? '3' : '5';
      if (!modelCacheRef.current.has(other)) {
        const preload = () => {
          if (!aliveRef.current || modelCacheRef.current.has(other)) return;
          void buildModel(other, {shouldCancel: () => !aliveRef.current}).then((m) => {
            if (!m) return;
            if (!aliveRef.current) { disposeBuiltModel(m); return; }
            // Warm the other size's shaders offscreen too, so the eventual
            // 3↔5 toggle (and the scroll right after it) is smooth instead of
            // stalling on a first-render compile. Briefly parent it into the
            // (idle) slide-out wrapper, compile, then detach — gl.compile only
            // builds programs, it never draws, so nothing flashes on screen.
            const holder = outWrapperRef.current;
            if (holder) {
              holder.add(m.frame, m.esc, m.fc);
              try { gl.compile(scene, camera); } catch { /* best-effort */ }
              for (const g of [m.frame, m.esc, m.fc]) holder.remove(g);
            }
            modelCacheRef.current.set(other, m);
          });
        };
        const ric = (window as any).requestIdleCallback;
        if (typeof ric === 'function') ric(preload, {timeout: 5000});
        else setTimeout(preload, 1500);
      }
    })();

    return () => {
      // Cancel only the in-flight build for THIS size change. Displayed models
      // stay in the cache (and on screen) — they're disposed on unmount below.
      cancelled = true;
    };
  }, [airframeSize]);

  // Dispose every cached model (both sizes) on unmount, and stop any in-flight
  // background preload from repopulating the cache afterwards.
  useEffect(() => {
    const cache = modelCacheRef.current;
    return () => {
      aliveRef.current = false;
      for (const m of cache.values()) disposeBuiltModel(m);
      cache.clear();
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

  // Pause the perpetual auto-rotate when the window loses focus. The Canvas-level
  // visibilitychange handler only catches a fully hidden tab (switched away /
  // minimised); it does NOT fire when the tab stays "visible" but the window is
  // unfocused — another app on top, a second monitor, another window in front.
  // In that gap RAF keeps running at full rate and the showcase rotation pegs the
  // GPU for nothing. Gate the auto-rotate's invalidate() on focus so the
  // frameloop="demand" loop halts to zero cost while blurred, and kick one frame
  // on refocus to resume. We don't unmount on blur — that would replay the load.
  useEffect(() => {
    focusedRef.current = document.hasFocus();
    const onFocus = () => { focusedRef.current = true; invalidate(); };
    const onBlur = () => { focusedRef.current = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
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

    // Auto-rotate — only while the window is focused. Blurred, it freezes so the
    // demand loop can stop re-arming (see the invalidate gate at the bottom).
    if (!dragging.current && focusedRef.current) {
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

    // Rest lift — at the top of the hero (pre-scroll) the assembly otherwise
    // sits low in frame; raise it so the stack reads centered. Eases back to 0
    // as the explode begins so the side-by-side layout stays vertically centred.
    const restLift = 1 - smoothstep(0, 0.3, p);
    wrapperRef.current.position.y = restLift * 0.07;

    // Cross-slide — on a size toggle the incoming assembly slides in from the
    // right while the outgoing one (frozen in outWrapperRef) slides out to the
    // left. To keep it from feeling dizzying both assemblies also pull back
    // (zoom out) toward the middle of the swap, and the horizontal motion uses
    // an ease-in-out so it starts and stops gently. Applied on top of the
    // scroll transforms (absolute each frame), so x/scale just reset when idle.
    const SLIDE = 1.3;
    const TRANS_DUR = 0.85;
    if (transitionRef.current < 1) {
      transitionRef.current = Math.min(1, transitionRef.current + dt / TRANS_DUR);
      const t = transitionRef.current;
      // easeInOutCubic — gentle acceleration then deceleration.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Zoom-out dip — peaks (~0.82×) mid-swap, settles to 1 at both ends.
      const zoom = 1 - 0.18 * Math.sin(Math.PI * t);
      wrapperRef.current.position.x = SLIDE * (1 - e);
      wrapperRef.current.scale.multiplyScalar(zoom);
      if (outgoingRef.current && outWrapperRef.current) {
        outWrapperRef.current.position.x = outBaseXRef.current - SLIDE * e;
        outWrapperRef.current.scale.setScalar(outBaseScaleRef.current * zoom);
      }
      if (transitionRef.current >= 1) {
        wrapperRef.current.position.x = 0;
        finishOutgoing();
      }
      invalidate();
    } else {
      wrapperRef.current.position.x = 0;
    }

    // Frame — becomes more solid during fly-out
    frameRef.current.position.set(
      0,
      THREE.MathUtils.lerp(0, 0.012, flyOut),
      THREE.MathUtils.lerp(0, 0.025, flyOut),
    );
    // Frame stays semi-transparent in BOTH themes so the boards show through.
    // Dark mode uses a much darker carbon grey (and more transparency) so it
    // reads as a true black frame against the dark page; light mode stays a
    // mid grey, a touch more solid so the pale page doesn't wash it out.
    const b = lightRef.current
      ? THREE.MathUtils.lerp(0x6e, 0x96, flyOut)
      : THREE.MathUtils.lerp(0x14, 0x22, flyOut);
    for (const mat of frameMats.current) {
      if (!mat?.transparent) continue;
      mat.opacity = lightRef.current
        ? (flyOut < 0.5 ? THREE.MathUtils.lerp(0.72, 0.9, frameOpacity) : 0.9)
        : (flyOut < 0.5 ? THREE.MathUtils.lerp(0.4, 0.58, frameOpacity) : 0.58);
      mat.color.setRGB(b / 255, b / 255, b / 255);
    }
    frameRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 0.45, flyOut));

    // Spread the side-boards wider on wider viewports. The multiplier
    // grows with aspect — ultrawide gets the most spread, near-square
    // stays tight so cards don't run off the edges.
    const aspect = size.width / Math.max(1, size.height);
    const spreadMul = THREE.MathUtils.clamp(0.55 + (aspect - 1.3) * 0.55, 0.85, 1.5);
    const spread = 0.05 * spreadMul;

    // FC — slides left (closer to center)
    fcRef.current.position.set(
      THREE.MathUtils.lerp(0, -spread, flyOut),
      THREE.MathUtils.lerp(0, 0.008, flyOut),
      THREE.MathUtils.lerp(0, 0.04, flyOut),
    );

    // ESC — slides right (closer to center)
    escRef.current.position.set(
      THREE.MathUtils.lerp(0, spread, flyOut),
      THREE.MathUtils.lerp(0, 0.008, flyOut),
      THREE.MathUtils.lerp(0, 0.04, flyOut),
    );

    // Hover effect — gold emissive lift on the hovered board. Replaces a
    // per-board PointLight wash that previously cost a real light bind +
    // per-fragment shading across every surface it touched.
    let glowAnimating = false;
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
      const intensity = hoverState.current[key];
      const mats = key === 'frame' ? frameMats : key === 'esc' ? escMats : fcMats;
      for (const m of mats.current) {
        if (!m || !('emissive' in m)) continue;
        (m as any).emissive.copy(BLACK).lerp(GOLD_TINT, intensity * 0.18);
        (m as any).emissiveIntensity = intensity * 0.85;
      }
    }

    // Project model world positions to screen coords and update the
    // label overlay divs imperatively — keeps labels glued under each
    // board as the assembly rotates/moves, without triggering React
    // re-renders every frame.
    //
    // Only while the labels are actually on screen. They fade in at p≈0.72
    // (linearstep(0.72, 0.84) in the route), so below ~0.66 this whole block —
    // a forced full-subtree updateMatrixWorld plus 3× Box3.setFromObject, all
    // on the main thread — was running every frame through the explode for
    // labels nobody can see. That was a big chunk of the fast-scroll jank.
    if (labelRefs && p >= 0.66) {
      wrapperRef.current.updateMatrixWorld(true);
      const project = (
        target: React.RefObject<HTMLDivElement | null>,
        group: Group | null,
      ) => {
        const el = target.current;
        if (!el || !group) return;
        bbox.setFromObject(group);
        if (bbox.isEmpty()) {
          el.style.opacity = '0';
          return;
        }
        bbox.getCenter(bboxVec);
        tmpVec.set(bboxVec.x, bbox.min.y, bboxVec.z).project(camera);
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
    // Auto-rotate keeps the loop alive only while focused — a blurred window
    // (still "visible", so visibilitychange never fired) otherwise burns the GPU
    // at full rate on a rotation no one is watching.
    const isAutoRotating = rotSlow < 0.99 && focusedRef.current;
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
      // Client-side nav into the prefetched PDP — instant. Falls back to a
      // hard load only if no navigate was threaded in.
      if (onNavigate) onNavigate(url);
      else window.location.href = url;
    }
  }, [isInteractive, onNavigate]);

  const hover = useCallback((key: 'frame' | 'esc' | 'fc', value: boolean) => {
    if (!isInteractive()) return;
    hoverTarget.current[key] = value ? 1 : 0;
    document.body.style.cursor = value ? 'pointer' : '';
    invalidate();
  }, [isInteractive]);

  return (
    <>
      <group ref={wrapperRef} scale={7} rotation={[0.6, 0, 0.05]} onPointerDown={onDown}>
        <group
          ref={frameRef}
          onPointerOver={() => hover('frame', true)}
          onPointerOut={() => hover('frame', false)}
          onClick={() => handleClick('/products/openframe')}
        />
        <group
          ref={escRef}
          onPointerOver={() => hover('esc', true)}
          onPointerOut={() => hover('esc', false)}
          onClick={() => handleClick('/products/openesc')}
        />
        <group
          ref={fcRef}
          onPointerOver={() => hover('fc', true)}
          onPointerOut={() => hover('fc', false)}
          onClick={() => handleClick('/products/openfc-lite')}
        />
      </group>
      {/* Holds the previous assembly while it slides out on a size toggle. */}
      <group ref={outWrapperRef} />
    </>
  );
}

type PerfSample = {
  fps: number;
  renderMs: number;
  // Sticky over a 3s window so a fast scroll's damage survives long enough to
  // screenshot AFTER you stop moving.
  worstMs: number; // slowest single frame in the window
  jank: number; // # frames slower than 20ms (a dropped frame at 120/60Hz)
  drawCalls: number; // true total per frame (autoReset off; counts composer passes)
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  width: number;
  height: number;
};

const PERF_WINDOW_MS = 3000;
const PERF_JANK_MS = 20;

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
  // Ring of recent frame timings {t, dt} for the sticky worst/jank window.
  const ring = useRef<Array<{t: number; dt: number}>>([]);
  // Real per-frame draw totals — three resets info per gl.render() call, and
  // EffectComposer renders several passes per frame, so the default counter
  // only ever shows the last (SMAA) pass = 1. Turn autoReset off and reset once
  // per frame ourselves so calls/triangles accumulate across all passes.
  const lastDraw = useRef(0);
  const lastTris = useRef(0);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);

  useFrame(() => {
    // At the top of the frame, info holds the PREVIOUS frame's full render
    // (all composer passes, since autoReset is off). Capture, then reset so
    // this frame accumulates cleanly.
    lastDraw.current = gl.info.render.calls;
    lastTris.current = gl.info.render.triangles;
    gl.info.reset();

    const now = performance.now();
    if (prevFrameT.current) {
      const dt = now - prevFrameT.current;
      intervalAccum.current += dt;
      ring.current.push({t: now, dt});
    }
    prevFrameT.current = now;
    frames.current += 1;

    if (now - lastT.current >= 500) {
      const elapsed = now - lastT.current;
      const avgInterval =
        frames.current > 1 ? intervalAccum.current / (frames.current - 1) : 0;
      // Prune ring to the sticky window, then derive worst/jank from it.
      const cutoff = now - PERF_WINDOW_MS;
      ring.current = ring.current.filter((e) => e.t >= cutoff);
      let worst = 0;
      let jank = 0;
      for (const e of ring.current) {
        if (e.dt > worst) worst = e.dt;
        if (e.dt > PERF_JANK_MS) jank += 1;
      }
      onSample({
        fps: Math.round((frames.current * 1000) / elapsed),
        renderMs: +avgInterval.toFixed(2),
        worstMs: +worst.toFixed(1),
        jank,
        drawCalls: lastDraw.current,
        triangles: lastTris.current,
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

/**
 * Hemi ramps down with scroll to preserve the harsh top-down gradient
 * in the rotating hero state (0.72 top sky color vs 0.18 ground in hemi
 * creates a strong vertical lift across the stacked boards) while
 * dropping it at the end so the directional key dominates and its cast
 * shadows read clearly. Key and rim stay constant — that earlier
 * dimming was what caused the dark→light→dark feel.
 */
function SceneLights({scrollRef}: {scrollRef: React.RefObject<number>}) {
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  useFrame(() => {
    if (!hemiRef.current) return;
    const t = 1 - smoothstep(0.5, 0.85, scrollRef.current);
    hemiRef.current.intensity = THREE.MathUtils.lerp(0.3, 0.72, t);
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} args={['#cfdaeb', '#1a1d22', 0.72]} />
      {/* Warm key light. No longer casts — nothing in the scene was set to
          receive a real cast shadow (boards are out of shadows, frame only
          "received" with no casters), so shadow rendering was pure overhead. */}
      <spotLight
        position={[0, 2.4, 0.9]}
        angle={0.58}
        penumbra={0.7}
        decay={1.6}
        distance={7}
        intensity={32}
        color="#ffe8cc"
      />
      {/* Cool fill / rim from behind-left. Was a second spotLight — converted
          to a directionalLight: it casts no shadow and only needs to wash the
          dark side, so the per-fragment cone+distance attenuation a spotLight
          pays for was wasted. A directional is a plain dot-product, noticeably
          cheaper at this fill rate. Aim is position → origin (default target).
          Intensity retuned for the directional model (no decay/distance). */}
      <directionalLight
        position={[-1.4, 0.35, -0.7]}
        intensity={0.8}
        color="#7891b6"
      />
    </>
  );
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
  onProgress,
  labelRefs,
  loadDelayMs,
  size = '5',
}: {
  onReady?: () => void;
  onProgress?: (progress: number) => void;
  labelRefs?: LabelRefs;
  loadDelayMs?: number;
  size?: '5' | '3';
} = {}) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(true);
  const [perf, setPerf] = useState<PerfSample | null>(null);
  const navigate = useNavigate();
  const {targetRef, smoothRef} = useScrollProgress();
  useEffect(() => { setMounted(true); }, []);

  // Pause the WebGL canvas entirely when the tab is hidden or the hero
  // has scrolled well off-screen. Unmounting the Canvas releases the GPU
  // context; React re-mounts it instantly when the hero returns to view.
  useEffect(() => {
    const update = () => {
      const visible = document.visibilityState === 'visible';
      const heroOnScreen =
        window.scrollY < window.innerHeight * 2; // matches HERO_SPACER_VH
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
        // near/far kept tight around the drone (~0.7–1.5 units away, ~1 unit
        // across). The three.js default far of 2000 wastes almost all depth
        // precision on empty space, which makes near-coplanar surfaces — the
        // gold FC pads on the board — z-fight when you rotate the model. A
        // 200:1 range fixes it. (Worst on 5": its tighter fit-scale puts the
        // pad/board gap right at the precision limit.)
        camera={{position: [0, 0.15, 0.7], fov: 40, near: 0.1, far: 20}}
        style={{background: 'transparent'}}
        // No `shadows` — nothing in the scene sets castShadow (frame + boards
        // are all cast=false), so the shadow map was rendering empty every
        // frame: a render-target bind/clear + extra depth-material programs for
        // zero visible shadow. Dropping it is a free per-frame win.
        frameloop="demand"
        // Cap pixel ratio at 1.25. Fragment (fill) cost scales with dpr², and
        // this scene is fill-bound once the boards explode to fill the screen
        // (full-screen PBR × 3 lights). 1.25² vs 1.5² is ~30% fewer shaded
        // pixels every frame — the biggest single lever short of swapping the
        // PBR materials for matcaps. Barely perceptible at hero distance.
        dpr={[1, 1.25]}
        gl={{
          // MSAA off — replaced by an SMAA postprocess pass below. MSAA
          // at DPR 1.5 on Retina was rasterising 4 samples × 2.25× the
          // pixel count; SMAA is a fixed per-pixel cost decoupled from
          // scene complexity and looks ≈ 4×MSAA for this material set.
          antialias: false,
          alpha: true,
          // 'default' lets macOS pick an efficient GPU schedule.
          // 'high-performance' previously forced the GPU into its
          // always-on max-perf mode even for a slow showcase rotation,
          // burning power without any visual benefit.
          powerPreference: 'default',
        }}
        onCreated={({camera, gl}) => {
          camera.lookAt(0, 0, 0);
          // Tighten the depth range HERE — r3f bakes the `camera` prop's
          // near/far at creation and doesn't reliably re-apply them, so set
          // them on the live camera. The drone sits ~0.7–1.5 units away and is
          // ~1 unit across; a 200:1 range (vs the default 20000:1) restores the
          // depth precision the near-coplanar FC gold pads need to stop z-fighting.
          const cam = camera as THREE.PerspectiveCamera;
          cam.near = 0.1;
          cam.far = 20;
          cam.updateProjectionMatrix();
          // Exposure pulled down so the spotlight key doesn't push the
          // pastel-green PCB albedo into pure white.
          gl.toneMappingExposure = 0.78;
          invalidate();
        }}
      >
        {/* First useFrame in the tree — eases smoothRef toward the raw scroll
            target so every consumer below reads the damped value this frame. */}
        <ScrollDamper targetRef={targetRef} smoothRef={smoothRef} />
        <SceneLights scrollRef={smoothRef} />
        <CameraRig scrollRef={smoothRef} />
        <DroneAssembly
          scrollRef={smoothRef}
          onReady={onReady}
          onProgress={onProgress}
          labelRefs={labelRefs}
          loadDelayMs={loadDelayMs}
          size={size}
          onNavigate={(url) => void navigate(url)}
        />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <SMAA />
        </EffectComposer>
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
          {`FPS        ${perf.fps}
FRAME MS   ${perf.renderMs}
WORST 3s   ${perf.worstMs}ms
JANK 3s    ${perf.jank} frames >${PERF_JANK_MS}ms
DRAW       ${perf.drawCalls}
TRIS       ${perf.triangles}
GEOMS      ${perf.geometries}
TEX        ${perf.textures}
PROGS      ${perf.programs}
DPR        ${perf.dpr}
SIZE       ${perf.width}x${perf.height}`}
        </div>
      ) : null}
    </div>
  );
}
