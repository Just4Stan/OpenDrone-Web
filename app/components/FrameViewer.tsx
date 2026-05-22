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
 * Interactive exploded-assembly viewer for the carbon frame — the CAD
 * analogue of {@link BoardArt}. Where the board art reveals the copper /
 * mask / silk / edge *layers* of a flat PCB, the frame is a 3D assembly,
 * so the equivalent "show me the structure" gesture is to pull the parts
 * apart: top plate lifts, bottom plates drop, arms slide out radially.
 *
 * The frame is designed in OnShape. Its glTF export keeps each component as
 * a named node ("top", "base"/"base.001", "arm"/"arm.001"…), which is what
 * lets us group and explode them here. The explosion is computed in three.js
 * (OnShape's own exploded-view state doesn't survive the translation API),
 * so it works against any GLB whose parts follow that naming.
 *
 * Asset is hand-exported from OnShape for now; an automated
 * scripts/export-frame-cad.mjs (OnShape translations API + per-config GLB)
 * is the planned analogue of scripts/export-board-art.mjs.
 */

// Part groups, in callout order. `match` classifies a node by name prefix;
// `badge` is the numeral shown both on the 3D tag and in the teardown list.
const GROUPS = [
  {key: 'top', badge: '①', match: (n: string) => n.startsWith('top')},
  {key: 'arm', badge: '②', match: (n: string) => n.startsWith('arm')},
  {key: 'base', badge: '③', match: (n: string) => n.startsWith('base')},
] as const;

type Part = {
  obj: THREE.Object3D;
  groupIndex: number;
  base: THREE.Vector3; // resting position (raw model units)
  explode: THREE.Vector3; // offset added at full explosion
};

function classify(name: string): number {
  const lower = name.toLowerCase();
  return GROUPS.findIndex((g) => g.match(lower));
}

function FrameModel({
  src,
  spinningRef,
  explodeTargetRef,
  badgeRefs,
}: {
  src: string;
  spinningRef: React.RefObject<boolean>;
  explodeTargetRef: React.RefObject<number>;
  badgeRefs: React.MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rot = useRef({x: 0.32, y: 0.6});
  const drag = useRef({active: false, lastX: 0, lastY: 0, velY: 0, velX: 0});
  // Current eased explosion amount (0 assembled → 1 exploded).
  const explode = useRef(0);
  const parts = useRef<Part[]>([]);
  // One representative part per group, for anchoring the numbered badge.
  const badgeAnchors = useRef<Array<THREE.Object3D | null>>([null, null, null]);
  const [loaded, setLoaded] = useState(false);
  const tmp = useRef(new THREE.Vector3());

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => {
        if (cancelled || !groupRef.current) return;
        const scene = gltf.scene;

        // --- Build explode vectors in RAW model space, before any scaling.
        // The model is modelled symmetric about its origin, so raw coords
        // share a frame with each node's local position — offsets we store
        // now stay consistent once the scene is uniformly scaled below.
        scene.updateMatrixWorld(true);
        const found: Part[] = [];
        // Walk the assembly's direct part nodes (the "occurrence of …"
        // wrappers, or the meshes themselves) and bucket by name.
        scene.traverse((o) => {
          const idx = classify(o.name);
          if (idx === -1) return;
          // Skip if an ancestor already matched (avoid double-moving a mesh
          // inside an already-classified occurrence wrapper).
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
            explode: box.getCenter(new THREE.Vector3()), // centroid for now
          });
        });

        // Stack axis = direction from the bottom (base) centroid to the top
        // plate centroid. Falls back to +Y if a group is missing.
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

        // Turn each stored centroid into an actual explode offset.
        for (const f of found) {
          const centroid = f.explode.clone();
          if (f.groupIndex === 0) {
            // Top plate: lift along the stack axis.
            f.explode = stackDir.clone().multiplyScalar(unit * 0.38);
          } else if (f.groupIndex === 2) {
            // Bottom plate(s): drop along the stack axis, stagger extras
            // so two stacked plates don't overlap.
            f.explode = stackDir.clone().multiplyScalar(-unit * 0.38);
          } else {
            // Arms: push radially outward in the plane normal to the stack.
            const radial = centroid
              .clone()
              .sub(stackDir.clone().multiplyScalar(centroid.dot(stackDir)));
            if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
            f.explode = radial.normalize().multiplyScalar(unit * 0.42);
          }
        }
        parts.current = found;

        // Pick a badge anchor per group (closest part to that group's
        // centroid, so the tag sits on a representative piece).
        for (let gi = 0; gi < GROUPS.length; gi++) {
          const members = found.filter((f) => f.groupIndex === gi);
          badgeAnchors.current[gi] = members[0]?.obj ?? null;
        }

        // --- Now frame + style the scene like the old solid viewer.
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        scene.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        scene.scale.setScalar(2.2 / maxDim);
        const carbon = new THREE.MeshStandardMaterial({
          color: 0x17191d,
          metalness: 0.38,
          roughness: 0.46,
        });
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.material = carbon;
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        groupRef.current.add(scene);
        setLoaded(true);
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
          if (o.isMesh) {
            o.geometry?.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m: any) => m?.dispose());
          }
        });
      }
    };
  }, [src]);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    // Ease the explosion toward its target.
    const target = explodeTargetRef.current ?? 0;
    explode.current += (target - explode.current) * Math.min(1, dt * 3.2);
    if (Math.abs(target - explode.current) < 0.001) explode.current = target;
    for (const p of parts.current) {
      p.obj.position.set(
        p.base.x + p.explode.x * explode.current,
        p.base.y + p.explode.y * explode.current,
        p.base.z + p.explode.z * explode.current,
      );
    }

    if (drag.current.active) {
      // rotation driven imperatively by pointer move
    } else {
      rot.current.y += dt * 0.3 + drag.current.velY;
      rot.current.x += drag.current.velX;
      drag.current.velY *= 0.9;
      drag.current.velX *= 0.9;
      rot.current.x += (0.32 - rot.current.x) * Math.min(1, dt * 1.5);
    }
    g.rotation.y = rot.current.y;
    g.rotation.x = THREE.MathUtils.clamp(rot.current.x, -0.9, 0.9);

    // Project each badge anchor to screen space and drive its DOM tag.
    const el = state.gl.domElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    for (let gi = 0; gi < badgeAnchors.current.length; gi++) {
      const span = badgeRefs.current[gi];
      const anchor = badgeAnchors.current[gi];
      if (!span) continue;
      if (!anchor || explode.current < 0.02) {
        span.style.opacity = '0';
        continue;
      }
      anchor.getWorldPosition(tmp.current);
      tmp.current.project(state.camera);
      const x = (tmp.current.x * 0.5 + 0.5) * w;
      const y = (-tmp.current.y * 0.5 + 0.5) * h;
      span.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      span.style.opacity = String(explode.current);
    }

    const animating =
      Math.abs(target - explode.current) > 0.001 ||
      Math.abs(drag.current.velY) > 0.0005 ||
      Math.abs(drag.current.velX) > 0.0005;
    if (loaded && (spinningRef.current || animating)) invalidate();
  });

  const onDown = (e: any) => {
    drag.current.active = true;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    invalidate();
  };
  const onMove = (e: any) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    rot.current.y += dx * 0.008;
    rot.current.x += dy * 0.008;
    drag.current.velY = dx * 0.008;
    drag.current.velX = dy * 0.008;
    invalidate();
  };
  const onUp = (e: any) => {
    drag.current.active = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    invalidate();
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
  const [exploded, setExploded] = useState(true);
  const spinningRef = useRef(false);
  spinningRef.current = onScreen;
  // 1 = exploded, 0 = assembled; respects prefers-reduced-motion (no auto
  // animation, just snaps to the current toggle state).
  const explodeTargetRef = useRef(0);
  explodeTargetRef.current = exploded ? 1 : 0;
  const badgeRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null]);

  useEffect(() => setMounted(true), []);

  // Trigger the explode the first time the viewer scrolls into view —
  // mirrors BoardArt's scroll-revealed layer animation.
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

  return (
    <div ref={wrapRef} className="frame-viewer" data-loaded={mounted}>
      <div
        className="frame-viewer-canvas"
        aria-label="Interactive exploded 3D model of the carbon frame"
        role="img"
      >
        {mounted && onScreen ? (
          <Canvas
            camera={{position: [0, 0.4, 4.6], fov: 38}}
            style={{background: 'transparent'}}
            shadows="soft"
            frameloop="demand"
            dpr={[1, 1.5]}
            gl={{antialias: true, alpha: true, powerPreference: 'default'}}
            onCreated={({gl}) => {
              gl.toneMappingExposure = 0.95;
              invalidate();
            }}
          >
            <hemisphereLight args={['#cfdaeb', '#15171b', 0.55]} />
            <directionalLight
              position={[2.5, 4, 3]}
              intensity={2.6}
              color="#ffe8cc"
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight position={[-3, 1, -2]} intensity={0.7} color="#7891b6" />
            <FrameModel
              src={src}
              spinningRef={spinningRef}
              explodeTargetRef={explodeTargetRef}
              badgeRefs={badgeRefs}
            />
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

      <div className="frame-viewer-controls">
        <div className="board-art-toggle" role="group" aria-label="Frame view">
          <button
            type="button"
            className={exploded ? 'is-active' : undefined}
            aria-pressed={exploded}
            onClick={() => {
              setExploded(true);
              invalidate();
            }}
          >
            Exploded
          </button>
          <button
            type="button"
            className={!exploded ? 'is-active' : undefined}
            aria-pressed={!exploded}
            onClick={() => {
              setExploded(false);
              invalidate();
            }}
          >
            Assembled
          </button>
        </div>
        <p className="frame-viewer-hint" aria-hidden="true">Drag to rotate</p>
      </div>

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
