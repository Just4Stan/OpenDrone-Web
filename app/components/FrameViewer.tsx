import {Canvas, useFrame, invalidate} from '@react-three/fiber';
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export type FrameViewerProps = {
  /** Public path to the GLB, e.g. /models/frame.glb */
  src: string;
  /** Optional "inspect" deep-dive link (e.g. the public OnShape document). */
  inspectUrl?: string;
};

/**
 * Exploded-assembly viewer for the carbon frame — the CAD analogue of
 * {@link BoardArt}. Where the board art reveals the copper / mask / silk
 * *layers* of a flat PCB, the frame is a 3D assembly, so the equivalent
 * gesture is to pull the parts apart: top plate lifts, bottom plates drop,
 * arms fan out — driven by SCROLL position through the section.
 *
 * Parts render as vector edge outlines (a blueprint look), not solid fills.
 *
 * Performance: the canvas runs `frameloop="demand"` and never invalidates
 * itself — frames are only drawn on scroll, drag, or load. No auto-rotation,
 * so the GPU goes fully idle when the user stops interacting; off-screen the
 * whole canvas unmounts.
 *
 * The frame is designed in OnShape; its glTF export keeps each component as a
 * named node ("top", "base"/"base.001", "arm"/"arm.001"…), which is what lets
 * us group and explode them. Asset hand-exported for now; an automated
 * scripts/export-frame-cad.mjs is the planned analogue of export-board-art.
 */

// Part groups, in callout order. `match` classifies a node by name prefix;
// `badge` is the numeral shown on the 3D tag and in the teardown list.
const GROUPS = [
  {key: 'top', badge: '①', match: (n: string) => n.startsWith('top')},
  {key: 'arm', badge: '②', match: (n: string) => n.startsWith('arm')},
  {key: 'base', badge: '③', match: (n: string) => n.startsWith('base')},
] as const;

// Explode travel as a fraction of the assembly's largest dimension.
const PLATE_TRAVEL = 0.34;
const ARM_TRAVEL = 0.6;

type Part = {
  obj: THREE.Object3D;
  groupIndex: number;
  base: THREE.Vector3;
  explode: THREE.Vector3;
};

function classify(name: string): number {
  const lower = name.toLowerCase();
  return GROUPS.findIndex((g) => g.match(lower));
}

function FrameModel({
  src,
  progressRef,
  badgeRefs,
}: {
  src: string;
  progressRef: React.RefObject<number>;
  badgeRefs: React.MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Resting orientation — a three-quarter top view. Adjusted only by drag.
  const rot = useRef({x: 0.42, y: -0.5});
  const drag = useRef({active: false, lastX: 0, lastY: 0});
  const parts = useRef<Part[]>([]);
  const badgeAnchors = useRef<Array<THREE.Object3D | null>>([null, null, null]);
  const tmp = useRef(new THREE.Vector3());

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        if (cancelled || !groupRef.current) return;
        const scene = gltf.scene;

        // Build explode vectors in RAW model space, before scaling. The
        // model is symmetric about its origin, so raw coords share a frame
        // with each node's local position.
        scene.updateMatrixWorld(true);
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
          found.push({
            obj: o,
            groupIndex: idx,
            base: o.position.clone(),
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

        const overall = new THREE.Box3().setFromObject(scene);
        const span = overall.getSize(new THREE.Vector3());
        const unit = Math.max(span.x, span.y, span.z) || 1;

        for (const f of found) {
          const centroid = f.explode.clone();
          if (f.groupIndex === 0) {
            f.explode = stackDir.clone().multiplyScalar(unit * PLATE_TRAVEL);
          } else if (f.groupIndex === 2) {
            f.explode = stackDir.clone().multiplyScalar(-unit * PLATE_TRAVEL);
          } else {
            const radial = centroid
              .clone()
              .sub(stackDir.clone().multiplyScalar(centroid.dot(stackDir)));
            if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
            f.explode = radial.normalize().multiplyScalar(unit * ARM_TRAVEL);
          }
        }
        parts.current = found;

        for (let gi = 0; gi < GROUPS.length; gi++) {
          const members = found.filter((f) => f.groupIndex === gi);
          badgeAnchors.current[gi] = members[0]?.obj ?? null;
        }

        // Render parts as vector edge outlines, not solid fills. Collect
        // meshes first (don't mutate the tree mid-traversal), then add an
        // EdgesGeometry line copy beside each mesh and hide the original.
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xc8b27a,
          transparent: true,
          opacity: 0.62,
        });
        const meshes: THREE.Mesh[] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.geometry) meshes.push(m);
        });
        for (const m of meshes) {
          const edges = new THREE.EdgesGeometry(m.geometry, 24);
          const ls = new THREE.LineSegments(edges, lineMat);
          ls.applyMatrix4(m.matrix);
          m.parent?.add(ls);
          m.visible = false;
        }

        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        scene.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        scene.scale.setScalar(2.2 / maxDim);
        groupRef.current.add(scene);
        invalidate();
      },
      undefined,
      (err) => console.error('[FrameViewer] failed to load', src, err),
    );
    return () => {
      cancelled = true;
      parts.current = [];
      badgeAnchors.current = [null, null, null];
      const g = groupRef.current;
      if (!g) return;
      while (g.children.length) {
        const child = g.children[0];
        g.remove(child);
        child.traverse((o: any) => {
          if (o.isMesh || o.isLineSegments) {
            o.geometry?.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m: any) => m?.dispose());
          }
        });
      }
    };
  }, [src]);

  // Runs only when something calls invalidate() (scroll, drag, load) — never
  // self-schedules, so the GPU is idle between interactions.
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const e = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1);
    for (const p of parts.current) {
      p.obj.position.set(
        p.base.x + p.explode.x * e,
        p.base.y + p.explode.y * e,
        p.base.z + p.explode.z * e,
      );
    }
    g.rotation.x = THREE.MathUtils.clamp(rot.current.x, -0.9, 0.9);
    g.rotation.y = rot.current.y;

    const el = state.gl.domElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    for (let gi = 0; gi < badgeAnchors.current.length; gi++) {
      const span = badgeRefs.current[gi];
      const anchor = badgeAnchors.current[gi];
      if (!span) continue;
      if (!anchor || e < 0.04) {
        span.style.opacity = '0';
        continue;
      }
      anchor.getWorldPosition(tmp.current);
      tmp.current.project(state.camera);
      const x = (tmp.current.x * 0.5 + 0.5) * w;
      const y = (-tmp.current.y * 0.5 + 0.5) * h;
      span.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      span.style.opacity = String(e);
    }
  });

  const onDown = (e: any) => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: any) => {
    if (!drag.current.active) return;
    rot.current.y += (e.clientX - drag.current.lastX) * 0.008;
    rot.current.x += (e.clientY - drag.current.lastY) * 0.008;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    invalidate();
  };
  const onUp = (e: any) => {
    drag.current.active = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    />
  );
}

export function FrameViewer({src, inspectUrl}: FrameViewerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const progressRef = useRef(0);
  const badgeRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setOnScreen(e.isIntersecting);
        invalidate();
      },
      {rootMargin: '200px 0px', threshold: 0.01},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  // Scroll-scrub: scrub off the parent chapter's top edge so the frame is
  // assembled and fully framed when it scrolls into view, then eases apart.
  useEffect(() => {
    if (!mounted || !onScreen) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const el = wrapRef.current;
      if (!el) return;
      const section = el.closest('.chapter') ?? el;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = (vh * 0.62 - r.top) / (vh * 0.62);
      const clamped = Math.max(0, Math.min(1, p));
      if (Math.abs(clamped - progressRef.current) > 0.001) {
        progressRef.current = clamped;
        invalidate();
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll, {passive: true});
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [mounted, onScreen]);

  return (
    <div ref={wrapRef} className="frame-viewer" data-loaded={mounted}>
      <div
        className="frame-viewer-canvas"
        aria-label="Interactive exploded 3D model of the carbon frame"
        role="img"
      >
        {mounted && onScreen ? (
          <Canvas
            camera={{position: [0, 0.2, 4.3], fov: 38}}
            style={{background: 'transparent'}}
            frameloop="demand"
            dpr={[1, 1.75]}
            gl={{antialias: true, alpha: true, powerPreference: 'default'}}
            onCreated={() => invalidate()}
          >
            {/* Edge-outline parts are unlit — no lights or shadows needed. */}
            <FrameModel src={src} progressRef={progressRef} badgeRefs={badgeRefs} />
          </Canvas>
        ) : null}
        {/* Numbered part tags, projected onto the model each frame. */}
        <div className="frame-viewer-badges" aria-hidden="true">
          {GROUPS.map((g, i) => (
            <span
              key={g.key}
              className="frame-viewer-badge"
              ref={(node) => {
                badgeRefs.current[i] = node;
              }}
              style={{opacity: 0}}
            >
              {g.badge}
            </span>
          ))}
        </div>
      </div>

      <p className="frame-viewer-hint" aria-hidden="true">
        Scroll to explode · drag to rotate
      </p>

      {inspectUrl ? (
        <a
          className="board-art-inspect"
          href={inspectUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in OnShape ↗
        </a>
      ) : null}
    </div>
  );
}

export default FrameViewer;
