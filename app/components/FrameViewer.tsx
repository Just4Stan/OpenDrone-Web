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

// Explode travel as a fraction of the assembly's largest dimension.
const PLATE_TRAVEL = 0.4;
const ARM_TRAVEL = 0.78;

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

        const sz = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
        const unit = Math.max(sz.x, sz.y, sz.z) || 1;

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

        // Vector edge outlines instead of solid fills.
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
          ls.applyMatrix4(m.matrix);
          m.parent?.add(ls);
          m.visible = false;
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

  // Recompute the explode amount from the section's viewport position each
  // rendered frame (frames are scheduled by the scroll listener via
  // invalidate()). e = 0 when the section's centre is at the viewport bottom,
  // 1 once it has scrolled to the top — so it animates across the whole pass.
  useFrame(() => {
    if (!parts.current.length) return;
    let e = 0;
    const el = containerRef.current;
    if (el) {
      const section = (el.closest('.chapter') as HTMLElement | null) ?? el;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2;
      e = THREE.MathUtils.clamp(1 - center / vh, 0, 1);
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

  // Mount the canvas only while the teardown section is near the viewport
  // (observe the chapter, not the tall over-bleeding backdrop). While mounted
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
