import {Canvas, useFrame, invalidate} from '@react-three/fiber';
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export type FrameViewerProps = {
  /** Public path to the GLB, e.g. /models/frame.glb */
  src: string;
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
// Fraction of the pinned scroll spent showing the whole assembled frame before
// it starts coming apart. The explode then ramps over the remaining (1 − HOLD).
const HOLD = 0.18;

type Part = {obj: THREE.Object3D; groupIndex: number; base: THREE.Vector3; explode: THREE.Vector3};

function classify(name: string): number {
  const lower = name.toLowerCase();
  return GROUPS.findIndex((g) => g.match(lower));
}

function FrameModel({
  src,
  containerRef,
}: {
  src: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Fixed three-quarter top view; shifted right in its own local x so the
  // model sits off to the right and the left arms fan into the text.
  const rot = {x: 0.42, y: -0.5};
  const offsetX = 1.0;
  const parts = useRef<Part[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        if (cancelled || !groupRef.current) return;
        const scene = gltf.scene;

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
          // Translate the part in the assembly's frame, not the mesh's local
          // frame: some OnShape "occurrence" wrappers carry a 180° flip that
          // would negate the world-space explode direction (collapsing arm
          // pairs onto one corner). The occurrence sits directly under the
          // identity Assembly root, so moving IT applies the explode cleanly.
          const moveNode = o.parent && o.parent !== scene ? o.parent : o;
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
        const axisPoint =
          baseC ?? topC ?? sceneBox.getCenter(new THREE.Vector3());

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
        parts.current = found;

        // Vector edge outlines instead of solid fills. The outline is added as
        // a CHILD of its mesh so it inherits the mesh's transform — and crucially
        // travels with the part when the explode moves the mesh node. The solid
        // surface is suppressed via the material's `visible`, NOT the object's
        // `visible` (which would also hide the child outline, leaving nothing on
        // screen). Hiding the object was the bug: the outline used to be a
        // sibling on the parent "occurrence" node, so it never moved.
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xc8b27a,
          transparent: true,
          opacity: 0.55,
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
        groupRef.current.rotation.set(rot.x, rot.y, 0);
        groupRef.current.position.x = offsetX;
        groupRef.current.add(scene);
        invalidate();
      },
      undefined,
      (err) => console.error('[FrameViewer] failed to load', src, err),
    );
    return () => {
      cancelled = true;
      parts.current = [];
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

  // The frame is PINNED: the viewer sticks to the viewport while the (tall)
  // teardown section scrolls past, and the explode is scrubbed by how far we've
  // scrolled through that section. progress = 0 when the section top hits the
  // viewport top (whole frame shown, pinned), 1 when its bottom reaches the
  // viewport bottom (pin releases into chapter 2). Hold assembled for the first
  // HOLD of the pin, then ramp to EXPLODE_MAX so the parts fly off a stationary
  // frame before chapter 2 arrives.
  useFrame(() => {
    if (!parts.current.length) return;
    let e = 0;
    const el = containerRef.current;
    if (el) {
      const section = (el.closest('.chapter') as HTMLElement | null) ?? el;
      const vh = window.innerHeight || 1;
      const r = section.getBoundingClientRect();
      const pinnable = Math.max(section.offsetHeight - vh, 1);
      const progress = THREE.MathUtils.clamp(-r.top / pinnable, 0, 1);
      e =
        THREE.MathUtils.clamp((progress - HOLD) / (1 - HOLD), 0, 1) *
        EXPLODE_MAX;
    }
    for (const p of parts.current) {
      p.obj.position.set(
        p.base.x + p.explode.x * e,
        p.base.y + p.explode.y * e,
        p.base.z + p.explode.z * e,
      );
    }
  });

  return <group ref={groupRef} />;
}

export function FrameViewer({src}: FrameViewerProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Mount the canvas while the (tall, pinned) teardown section is near the
  // viewport. Observing the section keeps the canvas alive for the full pin —
  // from before it sticks until after it releases into chapter 2. While mounted
  // the canvas runs frameloop="always" so the explode tracks scroll every
  // frame; off-screen it unmounts and costs nothing.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const target = (el.closest('.chapter') as HTMLElement | null) ?? el;
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
          frameloop="always"
          dpr={[1, 1.75]}
          gl={{antialias: true, alpha: true, powerPreference: 'default'}}
        >
          {/* Edge-outline parts are unlit — no lights or shadows needed. */}
          <FrameModel src={src} containerRef={wrapRef} />
        </Canvas>
      ) : null}
    </div>
  );
}

export default FrameViewer;
