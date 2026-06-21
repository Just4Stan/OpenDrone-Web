import {Canvas, useFrame, invalidate} from '@react-three/fiber';
import {useEffect, useReducer, useRef, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {useIsMobile} from '~/lib/use-media-query';
import {getActiveTheme} from '~/lib/theme';

// Wireframe stroke per theme. Gold-on-near-black reads fine in dark; on light's
// cream page that same gold is nearly invisible, so light uses a dark bronze at
// higher opacity. Applied at build and refreshed live on a theme toggle.
const FRAME_LINE = {
  dark: {color: 0xc8b27a, opacity: 0.55},
  light: {color: 0x5c4611, opacity: 0.92},
} as const;

// Memoise fetched GLB bytes by URL so a model that's been loaded once (e.g. the
// other tier, preloaded in the background) never hits the network again — the
// switch only pays the cheap parse, not the multi-MB download.
THREE.Cache.enabled = true;

export type FrameViewerProps = {
  /** Public path to the active GLB, e.g. /models/frame3.glb */
  src: string;
  /** All frame GLBs across tiers. Preloaded up front so switching the active
   *  `src` is instant (toggle visibility) instead of a fetch + parse. Defaults
   *  to `[src]`. */
  srcs?: string[];
  /** Optional "inspect" deep-dive link (kept for API parity; unused while
   *  the viewer renders as a decorative backdrop). */
  inspectUrl?: string;
};

/**
 * Exploded-assembly backdrop for the carbon frame — the CAD analogue of
 * {@link BoardArt}. The frame is a 3D OnShape assembly, so instead of
 * revealing flat PCB layers it pulls its parts apart as the user scrolls:
 * top plate lifts, bottom plates drop, arms fan out.
 *
 * Purely decorative and NON-interactive: a big over-bleeding layer of gold
 * vector outlines that flows over the neighbouring sections, behind the
 * teardown text. The explode amount is recomputed from the section's
 * viewport position every rendered frame, and a scroll listener invalidates
 * (frameloop="demand") — so it animates smoothly while scrolling and the GPU
 * idles otherwise; off-screen the canvas unmounts entirely.
 *
 * Parts are classified by node name ("top", "base"/"base.001",
 * "arm"/"arm.001"…) from the OnShape glTF export.
 *
 * Tier switching (3" ⇄ 5") is instant: every tier's model is loaded once and
 * kept in the scene; changing `src` just toggles which one is visible. No
 * remount, no refetch.
 */

const GROUPS = [
  {key: 'top', match: (n: string) => n.startsWith('top')},
  {key: 'arm', match: (n: string) => n.startsWith('arm')},
  {key: 'base', match: (n: string) => n.startsWith('base')},
] as const;

// Explode travel as a fraction of the assembly's largest dimension. These set
// the spread at e = 1 (the "fully exploded" hero look as chapter 2 arrives).
const PLATE_TRAVEL = 0.4;
const ARM_TRAVEL = 0.78;
// e keeps growing past 1 as you scroll further, so the parts fly off screen.
// At e = 1 arms are ~at the frame edge; ~e = 2.5–3 takes everything off.
const EXPLODE_MAX = 3;

type Part = {obj: THREE.Object3D; groupIndex: number; base: THREE.Vector3; explode: THREE.Vector3};
type Model = {root: THREE.Object3D; parts: Part[]};

function classify(name: string): number {
  const lower = name.toLowerCase();
  return GROUPS.findIndex((g) => g.match(lower));
}

/**
 * Turn a freshly-loaded glTF scene into a render-ready model: classify the
 * explodable parts, compute their explode vectors, replace solid surfaces with
 * gold edge outlines, and centre + normalise the scene to a fixed size. The
 * scene is mutated in place and returned alongside its part list.
 */
function prepareModel(scene: THREE.Object3D): Part[] {
  scene.updateMatrixWorld(true);
  // glTF wraps the whole frame under a single identity root node (both the
  // OnShape and the OCCT/cascadio STEP exports name it "Assembly 1"). The node
  // we translate must sit DIRECTLY beneath that root, so its position lives in
  // the identity assembly frame and the world-space explode delta applies
  // without a parent rotation/flip twisting it.
  const assemblyRoot =
    scene.children.length === 1 ? scene.children[0] : scene;
  const found: Part[] = [];
  scene.traverse((o) => {
    const idx = classify(o.name);
    if (idx === -1) return;
    let p = o.parent;
    while (p && p !== scene) {
      if (classify(p.name) !== -1) return;
      p = p.parent;
    }
    const box = new THREE.Box3().setFromObject(o);
    if (box.isEmpty()) return;
    // Climb from the classified node up to the assembly root's direct child:
    //  - OnShape: the mesh ("arm") sits inside a per-part "occurrence" wrapper
    //    that carries a 180° flip; moving the occurrence (a child of the root)
    //    applies the explode cleanly instead of negating it.
    //  - cascadio: the mesh is ON the named part node ("Arm"), already a direct
    //    child of the root, so the part node itself is what moves.
    // Moving the SHARED root would collapse every part onto one vector — the
    // "flies up as one piece" bug — so we stop one level below it.
    let moveNode = o;
    while (
      moveNode.parent &&
      moveNode.parent !== assemblyRoot &&
      moveNode.parent !== scene
    ) {
      moveNode = moveNode.parent;
    }
    found.push({
      obj: moveNode,
      groupIndex: idx,
      base: moveNode.position.clone(),
      explode: box.getCenter(new THREE.Vector3()),
    });
  });

  const groupCentroid = (gi: number) => {
    const c = new THREE.Vector3();
    let n = 0;
    for (const f of found)
      if (f.groupIndex === gi) {
        c.add(f.explode);
        n++;
      }
    return n ? c.divideScalar(n) : null;
  };
  const topC = groupCentroid(0);
  const baseC = groupCentroid(2);
  const stackDir =
    topC && baseC
      ? topC.clone().sub(baseC).normalize()
      : new THREE.Vector3(0, 1, 0);

  const sceneBox = new THREE.Box3().setFromObject(scene);
  const sz = sceneBox.getSize(new THREE.Vector3());
  const unit = Math.max(sz.x, sz.y, sz.z) || 1;
  // Fan the arms out from the stack centreline (the plate centres), not
  // the bounding-box centre — the arms are asymmetric, so the bbox centre
  // is skewed and would bias every arm the same way.
  const axisPoint = baseC ?? topC ?? sceneBox.getCenter(new THREE.Vector3());

  for (const f of found) {
    const centroid = f.explode.clone();
    if (f.groupIndex === 0) {
      f.explode = stackDir.clone().multiplyScalar(unit * PLATE_TRAVEL);
    } else if (f.groupIndex === 2) {
      f.explode = stackDir.clone().multiplyScalar(-unit * PLATE_TRAVEL);
    } else {
      const rel = centroid.sub(axisPoint);
      const radial = rel.sub(
        stackDir.clone().multiplyScalar(rel.dot(stackDir)),
      );
      if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
      f.explode = radial.normalize().multiplyScalar(unit * ARM_TRAVEL);
    }
  }

  // Vector edge outlines instead of solid fills. The outline is added as
  // a CHILD of its mesh so it inherits the mesh's transform — and crucially
  // travels with the part when the explode moves the mesh node. The solid
  // surface is suppressed via the material's `visible`, NOT the object's
  // `visible` (which would also hide the child outline, leaving nothing on
  // screen). Hiding the object was the bug: the outline used to be a
  // sibling on the parent "occurrence" node, so it never moved.
  const style = FRAME_LINE[getActiveTheme()];
  const lineMat = new THREE.LineBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: style.opacity,
  });
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) meshes.push(m);
  });
  for (const m of meshes) {
    const ls = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 24), lineMat);
    m.add(ls);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      if (mat) mat.visible = false;
    });
  }

  const box = new THREE.Box3().setFromObject(scene);
  scene.position.sub(box.getCenter(new THREE.Vector3()));
  const size = box.getSize(new THREE.Vector3());
  scene.scale.setScalar(2.2 / (Math.max(size.x, size.y, size.z) || 1));
  return found;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o: any) => {
    if (o.isMesh || o.isLineSegments) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m: any) => m?.dispose());
    }
  });
}

function FrameModel({
  src,
  srcs,
  containerRef,
}: {
  src: string;
  srcs: string[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Fixed three-quarter top view. On desktop it's shifted right in its own local
  // x so the model sits off to the right and the left arms fan into the text.
  // On mobile the viewer is a centred square above the copy, so the offset is
  // dropped and the model scaled up to fill it (otherwise it floats in a corner
  // of a black void — the desktop right-bias has nothing to fan into).
  const isMobile = useIsMobile();
  const rot = {x: 0.42, y: -0.5};
  const offsetX = isMobile ? 0 : 1.0;
  const rigScale = isMobile ? 1.35 : 1;
  // All loaded models, keyed by src. Only the active one is `visible`.
  const models = useRef<Map<string, Model>>(new Map());
  const [, bump] = useReducer((c: number) => c + 1, 0);
  // The chapter following the teardown ("Open for learning"). The explode is
  // scrubbed across the gap between the two chapters' centres, so we need its
  // box too. Resolved lazily and cached (re-resolved if it drops out of DOM).
  const nextChapter = useRef<HTMLElement | null>(null);

  // Load every tier's model once, active one first so it shows ASAP; the rest
  // warm in the background so switching tiers is instant. THREE.Cache keeps the
  // bytes, so re-mounting (scroll away/back) re-parses without re-downloading.
  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    // OnShape exports the frame GLBs with EXT_meshopt_compression (+ mesh
    // quantization), so the loader needs the meshopt decoder or every load
    // throws "setMeshoptDecoder must be called before loading compressed files".
    loader.setMeshoptDecoder(MeshoptDecoder);
    const wanted = srcs.length ? srcs : [src];
    const order = [src, ...wanted.filter((s) => s !== src)];
    for (const s of order) {
      if (models.current.has(s)) continue;
      // Reserve the slot synchronously so a re-render mid-load doesn't queue a
      // duplicate fetch for the same src.
      models.current.set(s, {root: new THREE.Group(), parts: []});
      loader.load(
        s,
        (gltf) => {
          if (cancelled || !groupRef.current) return;
          const scene = gltf.scene;
          const parts = prepareModel(scene);
          scene.visible = s === src;
          models.current.set(s, {root: scene, parts});
          groupRef.current.add(scene);
          invalidate();
          bump();
        },
        undefined,
        (err) => console.error('[FrameViewer] failed to load', s, err),
      );
    }
    return () => {
      cancelled = true;
    };
    // srcs is a stable list for the product; src changes are handled by the
    // visibility effect below, not by reloading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join('|')]);

  // Orient the rig once; rotation/offset apply to every model under it (only
  // one is visible at a time).
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.set(rot.x, rot.y, 0);
    groupRef.current.position.x = offsetX;
    groupRef.current.scale.setScalar(rigScale);
  }, [rot.x, rot.y, offsetX, rigScale]);

  // Instant tier switch: show the requested model, hide the rest. If the model
  // hasn't finished loading yet it simply becomes visible once it lands.
  useEffect(() => {
    for (const [s, m] of models.current) m.root.visible = s === src;
    invalidate();
  }, [src]);

  // Recolour the wireframes live when the visitor toggles light/dark — the
  // baked-at-build gold is invisible on the light cream page. Watches the
  // <html> class (the single source of theme truth) and repaints every loaded
  // model's edge materials.
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const apply = () => {
      const style = FRAME_LINE[getActiveTheme()];
      for (const m of models.current.values()) {
        m.root.traverse((o) => {
          const ls = o as THREE.LineSegments;
          if (!ls.isLineSegments) return;
          const mats = Array.isArray(ls.material) ? ls.material : [ls.material];
          for (const mat of mats) {
            const lm = mat as THREE.LineBasicMaterial;
            lm.color.setHex(style.color);
            lm.opacity = style.opacity;
            lm.needsUpdate = true;
          }
        });
      }
      invalidate();
    };
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  // Dispose everything on unmount (the IntersectionObserver unmounts the whole
  // canvas when the backdrop scrolls out of view).
  useEffect(() => {
    const loaded = models.current;
    const g = groupRef.current;
    return () => {
      for (const {root} of loaded.values()) {
        g?.remove(root);
        disposeObject(root);
      }
      loaded.clear();
    };
  }, []);

  // Drive the demand loop from scroll/resize: each event requests one frame so
  // the explode tracks the scroll position, then the GPU idles to zero once
  // scrolling stops. Without this the demand canvas would render once and the
  // explode would freeze (the old code used frameloop="always", which kept the
  // GPU at full tilt the entire time this backdrop was near the viewport).
  useEffect(() => {
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll);
    invalidate();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Recompute the explode amount from scroll position each rendered frame.
  // The throw spans chapter 1 (teardown) → chapter 2: e = 0 when the teardown
  // chapter's centre sits at the viewport centre (assembled, in view), and
  // e = 1 once the next chapter's centre reaches the viewport centre (fully
  // exploded). Normalised by the centre-to-centre distance, so it's stable
  // regardless of section heights or the gap between them.
  useFrame(() => {
    const active = models.current.get(src);
    if (!active || !active.parts.length) return;
    let e = 0;
    const el = containerRef.current;
    if (el) {
      const section = (el.closest('.chapter') as HTMLElement | null) ?? el;
      let next = nextChapter.current;
      if (!next || !next.isConnected) {
        let n = section.nextElementSibling as HTMLElement | null;
        while (n && !n.classList.contains('chapter'))
          n = n.nextElementSibling as HTMLElement | null;
        nextChapter.current = next = n;
      }
      const vh = window.innerHeight || 1;
      const r1 = section.getBoundingClientRect();
      const c1 = r1.top + r1.height / 2;
      if (next) {
        const r2 = next.getBoundingClientRect();
        const c2 = r2.top + r2.height / 2;
        // Hold the frame assembled (e = 0) through chapter 1 — it only starts
        // coming apart once chapter 2 reaches the viewport centre. (vh/2 − c2)
        // is how far ch.2's centre has risen past the centre; normalise by the
        // ch.1→ch.2 centre distance so e ≈ 1 about one chapter later, then it
        // keeps climbing to EXPLODE_MAX so the parts fly off as you scroll on.
        e = THREE.MathUtils.clamp((vh / 2 - c2) / (c2 - c1 || vh), 0, EXPLODE_MAX);
      } else {
        // No following chapter — fall back to a single-pass scrub.
        e = THREE.MathUtils.clamp(1 - c1 / vh, 0, 1);
      }
    }
    for (const p of active.parts) {
      p.obj.position.set(
        p.base.x + p.explode.x * e,
        p.base.y + p.explode.y * e,
        p.base.z + p.explode.z * e,
      );
    }
  });

  return <group ref={groupRef} />;
}

export function FrameViewer({src, srcs}: FrameViewerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const allSrcs = srcs && srcs.length ? srcs : [src];

  useEffect(() => setMounted(true), []);

  // Mount the canvas while the over-bleeding backdrop is near the viewport.
  // The explode now spans chapter 1 → chapter 2, so observing the teardown
  // chapter alone would unmount the canvas mid-throw once that chapter scrolls
  // up out of view. The backdrop layer (.frame-viewer fills it, -6vh→-70vh)
  // covers both sections, so observing it keeps the canvas alive for exactly
  // as long as it's visible. While mounted the canvas runs frameloop="demand":
  // a scroll/resize listener (see FrameModel) invalidates so the explode tracks
  // scroll, and the GPU idles to zero between scrolls. Off-screen it unmounts.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const target = el;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setOnScreen(e.isIntersecting);
      },
      {rootMargin: '300px 0px', threshold: 0},
    );
    io.observe(target);
    return () => io.disconnect();
  }, [mounted]);

  return (
    <div ref={wrapRef} className="frame-viewer" data-loaded={mounted} aria-hidden="true">
      {mounted && onScreen ? (
        <Canvas
          camera={{position: [0, 0.3, 4.4], fov: 38}}
          style={{background: 'transparent'}}
          frameloop="demand"
          dpr={[1, 1.75]}
          gl={{antialias: true, alpha: true, powerPreference: 'default'}}
        >
          {/* Edge-outline parts are unlit — no lights or shadows needed. */}
          <FrameModel src={src} srcs={allSrcs} containerRef={wrapRef} />
        </Canvas>
      ) : null}
    </div>
  );
}

export default FrameViewer;
