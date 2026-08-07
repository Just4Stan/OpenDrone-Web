/**
 * Scroll-driven hero built from the Onshape assembly.
 *
 * This is the studio's proven scene core (public/models/od3/_studio.html) minus
 * the tuning panel. It is deliberately vanilla three.js inside a ref container
 * rather than react-three-fiber: the studio version is the one that has been
 * tuned and debugged against the real assembly, and reimplementing it in r3f
 * would mean re-finding all of the same bugs.
 *
 * Tunables come from /models/<model>/studio.json, which is what the studio
 * writes. Structure (which parts form a beat, the teardown choreography) is
 * still in code here; see that file's _status field.
 */
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export type HeroBeat = {id: string; title: string; note: string};

export type HeroDroneSceneProps = {
  /** Folder under /public/models holding drone.glb + studio.json. */
  model?: string;
  /** Fires as the reader moves through the sequence, 0..1. */
  onProgress?: (frac: number) => void;
  /** Fires when the active beat changes, so the copy panel can follow. */
  onBeat?: (beat: HeroBeat, index: number) => void;
  /** The list of beats, once known. */
  onBeats?: (beats: HeroBeat[]) => void;
  /** Fires once the model is on screen. */
  onReady?: () => void;
  /** Set by the parent to hand scroll control over; see the pinning comment. */
  scrollRef?: React.RefObject<number>;
};

/* three.js mangles imported names three ways: it appends _1/_2 to duplicates,
 * turns spaces into underscores, and DELETES [ ] . : / entirely. Onshape also
 * wraps each part in occurrence_of_<name>. Undo all of it before matching, or
 * name-based rules silently miss most of the assembly. */
const tidy = (n?: string | null) =>
  (n ?? '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/^occurrence of /i, '')
    .trim();

/* Onshape writes 8-bit sRGB into baseColorFactor, which glTF defines as linear.
 * Measured on this export: 183 of 183 components are exact n/255. Without this
 * every albedo renders overbright, worst on dark surfaces. */
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

type MatProfile = {
  id: string;
  match: string | null;
  tint: string | null;
  metalness: number;
  roughness: number;
  env: number;
  sat: number;
};
type StudioConfig = {
  model?: string;
  lighting: any;
  spotlight: any;
  sequence: any;
  camera?: any;
  materials: MatProfile[];
  boards: Array<{id: string; title: string; note: string}>;
  boardExclude: string;
  videoModule: string;
  notFrame: string;
  beats: any[];
};

export function HeroDroneScene({
  model = 'od3',
  onProgress,
  onBeat,
  onBeats,
  onReady,
}: HeroDroneSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    const cleanup: Array<() => void> = [];

    (async () => {
      const cfg = (await fetch(`/models/${model}/studio.json`).then((r) => {
        if (!r.ok) throw new Error(`studio.json ${r.status}`);
        return r.json();
      })) as StudioConfig;

      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = cfg.lighting.exposure;
      el.append(renderer.domElement);
      renderer.domElement.style.display = 'block';
      cleanup.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = cfg.lighting.environment;

      const camera = new THREE.PerspectiveCamera(34, 1, 0.002, 60);

      const aim = (l: THREE.DirectionalLight, az: number, elv: number) => {
        const a = THREE.MathUtils.degToRad(az);
        const e = THREE.MathUtils.degToRad(elv);
        l.position.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
        l.target.position.set(0, 0, 0);
      };
      const L = cfg.lighting;
      const hemi = new THREE.HemisphereLight(0x94b8e8, 0x181410, L.ambient);
      const keyL = new THREE.DirectionalLight(L.key.colour, L.key.power);
      const fillL = new THREE.DirectionalLight(L.fill.colour, L.fill.power);
      const rimL = new THREE.DirectionalLight(L.rim.colour, L.rim.power);
      const bncL = new THREE.DirectionalLight(L.bounce.colour, L.bounce.power);
      bncL.position.set(0.05, -0.5, 0.15);
      scene.add(hemi, keyL, keyL.target, fillL, fillL.target, rimL, rimL.target, bncL, bncL.target);
      aim(keyL, L.key.azimuth, L.key.elevation);
      aim(fillL, L.fill.azimuth, L.fill.elevation);
      aim(rimL, L.rim.azimuth, L.rim.elevation);
      const BASE = {
        hemi: hemi.intensity,
        key: keyL.intensity,
        fill: fillL.intensity,
        rim: rimL.intensity,
        bounce: bncL.intensity,
      };

      const S = cfg.spotlight;
      const spotL = new THREE.SpotLight(0xffffff, S.power, 0, 0.5, S.softness, 2);
      scene.add(spotL, spotL.target);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xbcd8ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 64, 1, true), beamMat);
      beam.frustumCulled = false;
      beam.visible = false;
      scene.add(beam);

      // Onshape is Z-up, three is Y-up. `pivot` scales the drone about its own
      // centre so the airframe can recede without dragging the shown part.
      const world = new THREE.Group();
      world.rotation.x = -Math.PI / 2;
      scene.add(world);
      const pivot = new THREE.Group();
      world.add(pivot);
      const rig = new THREE.Group();
      pivot.add(rig);

      /* ------------------------------------------------------- materials */
      const profiles = new Map<string, MatProfile>(cfg.materials.map((m) => [m.id, m]));
      const classMats = new Map<string, THREE.MeshStandardMaterial[]>();
      const nameRules = cfg.materials.filter((m) => m.match);

      function classOf(raw0: string) {
        const raw = (raw0 || '').replace(/_\d+$/, '');
        if (/_PCB\b/i.test(raw)) return 'fr4';
        if (/_pad\b/i.test(raw)) return 'padgold';
        if (/_silkscreen\b/i.test(raw)) return 'silk';
        if (/_soldermask\b/i.test(raw)) return 'mask';
        const n = tidy(raw);
        for (const r of nameRules) if (new RegExp(r.match as string, 'i').test(n)) return r.id;
        return 'smd';
      }
      const hsl = {h: 0, s: 0, l: 0};
      function applyProfile(mat: THREE.MeshStandardMaterial, key: string) {
        const p = profiles.get(key);
        if (!p) return;
        const c = mat.color;
        c.setRGB(s2l(c.r), s2l(c.g), s2l(c.b));
        mat.metalness = p.metalness;
        mat.roughness = p.roughness;
        mat.envMapIntensity = p.env;
        if (p.tint) mat.color.set(p.tint);
        if (p.sat !== 1) {
          mat.color.getHSL(hsl);
          mat.color.setHSL(hsl.h, Math.min(1, hsl.s * p.sat), hsl.l);
        }
        const list = classMats.get(key) ?? [];
        list.push(mat);
        classMats.set(key, list);
      }

      /* ------------------------------------------------------------ load */
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder as any);
      const gltf = await loader.loadAsync(`/models/${model}/${cfg.model ?? 'drone.glb'}`);
      if (disposed) return;   // torn down while the 6 MB model was in flight
      const droneRoot = gltf.scene;
      const cache = new Map<string, THREE.MeshStandardMaterial>();
      droneRoot.traverse((o: any) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        let name = '';
        let n: THREE.Object3D | null = o;
        while (n && n !== droneRoot) {
          if (n.name && !/^mesh/i.test(n.name)) {
            name = n.name;
            break;
          }
          n = n.parent;
        }
        const key = classOf(name || o.name || '');
        const ck = `${o.material.uuid}|${key}`;
        let m = cache.get(ck);
        if (!m) {
          m = o.material.clone();
          applyProfile(m as THREE.MeshStandardMaterial, key);
          cache.set(ck, m as THREE.MeshStandardMaterial);
        }
        o.material = m;
      });
      rig.add(droneRoot);

      const occRoot: THREE.Object3D =
        droneRoot.children.length === 1 ? droneRoot.children[0] : droneRoot;
      const pick = (re: RegExp) => {
        const out: THREE.Object3D[] = [];
        droneRoot.traverse((o) => {
          if (o.name && re.test(tidy(o.name))) out.push(o);
        });
        return out;
      };
      const topLevel = (nodes: THREE.Object3D[]) => {
        const set = new Set(nodes);
        return nodes.filter((n) => {
          for (let p = n.parent; p; p = p.parent) if (set.has(p)) return false;
          return true;
        });
      };

      /* ------------------------------------------- boards merged to 1 group
       * A board is ~1900 occurrences that always move together, so each one
       * costs a draw call for nothing. Bake to one mesh per material. */
      const EXCLUDE = new RegExp(cfg.boardExclude, 'i');
      function boardMembers(prefix: string) {
        const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(pad|silkscreen|soldermask|PCB)`, 'i');
        const frags: THREE.Object3D[] = [];
        droneRoot.traverse((o) => {
          if (o.name && re.test(o.name.replace(/_\d+$/, ''))) frags.push(o);
        });
        if (!frags.length) return [];
        const bb = new THREE.Box3();
        for (const f of frags) bb.expandByObject(f);
        bb.min.x -= 0.0025;
        bb.max.x += 0.0025;
        bb.min.y -= 0.0025;
        bb.max.y += 0.0025;
        bb.min.z -= 0.0015;
        bb.max.z += 0.006;
        const out: THREE.Object3D[] = [];
        for (const c of occRoot.children) {
          if (EXCLUDE.test(tidy(c.name))) continue;
          const centre = new THREE.Box3().setFromObject(c).getCenter(new THREE.Vector3());
          if (bb.containsPoint(centre)) out.push(c);
        }
        return out;
      }
      scene.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(occRoot.matrixWorld).invert();
      const merged = new Map<string, THREE.Group>();
      for (const b of cfg.boards) {
        const members = boardMembers(b.id);
        if (!members.length) {
          console.warn(`[hero] board "${b.id}" matched no substrate fragments`);
          continue;
        }
        const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
        for (const node of members) {
          node.traverse((o: any) => {
            if (!o.isMesh) return;
            const g = o.geometry.clone();
            g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
            for (const k of Object.keys(g.attributes))
              if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
            if (!g.getAttribute('normal')) g.computeVertexNormals();
            const arr = byMat.get(o.material) ?? [];
            arr.push(g);
            byMat.set(o.material, arr);
          });
        }
        const group = new THREE.Group();
        group.name = `BOARD_${b.id}`;
        for (const [mat, geos] of byMat) {
          const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
          if (!g) continue;
          const mesh = new THREE.Mesh(g, mat);
          mesh.frustumCulled = false;
          group.add(mesh);
        }
        occRoot.add(group);
        for (const node of members) node.removeFromParent();
        merged.set(b.id, group);
      }

      /* --------------------------------------------------------- geometry */
      const box = new THREE.Box3().setFromObject(rig);
      const droneCentre = box.getCenter(new THREE.Vector3());
      const droneRadius = box.getBoundingSphere(new THREE.Sphere()).radius;
      const centreLocal = pivot.worldToLocal(droneCentre.clone());
      pivot.position.copy(centreLocal);
      rig.position.copy(centreLocal.clone().negate());

      // Props spin on the motor axis. A tri-blade's bbox centre is ~7 mm off its
      // hub, so the pivot is placed on the motor's own axis instead. The spinner
      // is a child of the pivot so a beat moving the pivot cannot cancel the spin.
      const propPivots: THREE.Group[] = [];
      {
        scene.updateMatrixWorld(true);
        const motors: THREE.Vector3[] = [];
        for (const b of topLevel(pick(/^Admi/i))) {
          const c = new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3());
          const hit = motors.find((m) => Math.hypot(m.x - c.x, m.z - c.z) < 0.015);
          if (!hit) motors.push(c);
        }
        const propNodes = occRoot.children.filter((c) =>
          /^occurrence[_ ]of[_ ][0-9]+(_[0-9]+)?$/i.test(c.name || ''),
        );
        for (const p of propNodes) {
          const pc = new THREE.Box3().setFromObject(p).getCenter(new THREE.Vector3());
          let axis: THREE.Vector3 | null = null;
          let best = Infinity;
          for (const m of motors) {
            const d = Math.hypot(m.x - pc.x, m.z - pc.z);
            if (d < best) {
              best = d;
              axis = m;
            }
          }
          const hub = axis ? new THREE.Vector3(axis.x, pc.y, axis.z) : pc;
          const g = new THREE.Group();
          occRoot.add(g);
          g.position.copy(occRoot.worldToLocal(hub.clone()));
          g.updateMatrixWorld(true);
          const sp = new THREE.Group();
          g.add(sp);
          sp.updateMatrixWorld(true);
          sp.attach(p);
          const dx = hub.x - droneCentre.x;
          const dz = hub.z - droneCentre.z;
          (g as any).userData = {spin: sp, dir: dx * dz < 0 ? 1 : -1};
          propPivots.push(g);
        }
        if (propPivots.length !== 4)
          console.warn(`[hero] expected 4 props, rigged ${propPivots.length}`);
      }

      /* ------------------------------------------------------------ beats */
      const VIDEO_RE = new RegExp(cfg.videoModule, 'i');
      const NOT_FRAME = new RegExp(cfg.notFrame, 'i');
      const frameGroup = () =>
        occRoot.children.filter(
          (c) => !/^BOARD_/.test(c.name) && !VIDEO_RE.test(tidy(c.name)) && !NOT_FRAME.test(tidy(c.name)),
        );

      type Node = {
        node: THREE.Object3D;
        pos: THREE.Vector3;
        quat: THREE.Quaternion;
        scl: THREE.Vector3;
        worldOrigin: THREE.Vector3;
        worldCentre: THREE.Vector3;
        withTop?: boolean;
        withVideo?: boolean;
      };
      type Beat = {
        id: string;
        title: string;
        note: string;
        faceOn?: boolean;
        fade?: number;
        stops?: Array<{at: number; title: string; note: string}>;
        choreo?: string;
        nodes: Node[];
        centre?: THREE.Vector3;
        radius?: number;
        dim?: THREE.Mesh[];
      };

      function selectFor(spec: any): THREE.Object3D[] {
        if (!spec || spec.none) return [];
        if (spec.board) {
          const g = merged.get(spec.board);
          return g ? [g] : [];
        }
        if (spec.cluster) {
          const all = topLevel(pick(new RegExp(spec.cluster, 'i')));
          if (!all.length) return [];
          const seed = new THREE.Box3().setFromObject(all[0]).getCenter(new THREE.Vector3());
          const cluster = all.filter((n) => {
            const c = new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3());
            return Math.hypot(c.x - seed.x, c.z - seed.z) < 0.012;
          });
          if (spec.withProp) {
            let bestG: THREE.Group | null = null;
            let bestD = Infinity;
            for (const g of propPivots) {
              const p = g.getWorldPosition(new THREE.Vector3());
              const d = Math.hypot(p.x - seed.x, p.z - seed.z);
              if (d < bestD) {
                bestD = d;
                bestG = g;
              }
            }
            if (bestG && bestD < 0.03) cluster.push(bestG);
          }
          return cluster;
        }
        if (spec.complement) {
          const out = frameGroup();
          if (spec.plus === 'videoModule') out.push(...topLevel(pick(VIDEO_RE)));
          return out;
        }
        return [];
      }

      const BEATS: Beat[] = cfg.beats.map((b: any) => {
        const nodes: Node[] = selectFor(b.select).map((n) => ({
          node: n,
          pos: n.position.clone(),
          quat: n.quaternion.clone(),
          scl: n.scale.clone(),
          worldOrigin: n.getWorldPosition(new THREE.Vector3()),
          worldCentre: new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3()),
        }));
        const beat: Beat = {
          id: b.id,
          title: b.title,
          note: b.note,
          fade: b.fade,
          stops: b.stops,
          choreo: b.choreo,
          faceOn: !!b.select?.board,
          nodes,
        };
        if (nodes.length) {
          const bb = new THREE.Box3();
          for (const p of nodes) bb.expandByObject(p.node);
          beat.centre = bb.getCenter(new THREE.Vector3());
          beat.radius = Math.max(bb.getBoundingSphere(new THREE.Sphere()).radius, 1e-4);
          const plate = nodes.find((p) => tidy(p.node.name) === 'Top');
          if (plate) {
            const pbb = new THREE.Box3().setFromObject(plate.node);
            for (const p of nodes) {
              const n = tidy(p.node.name);
              if (n === 'Top') {
                p.withTop = true;
                continue;
              }
              if (!/(screw|hex nut|pressnut|press nut|washer)/i.test(n)) continue;
              const c = new THREE.Box3().setFromObject(p.node).getCenter(new THREE.Vector3());
              if (c.y >= pbb.min.y - 0.0015) p.withTop = true;
            }
          }
          const cradle = nodes.filter((p) => /^VTX-Mount/i.test(tidy(p.node.name)));
          if (cradle.length) {
            const vbb = new THREE.Box3();
            for (const p of cradle) vbb.expandByObject(p.node);
            vbb.min.x -= 0.002;
            vbb.max.x += 0.002;
            vbb.min.z -= 0.002;
            vbb.max.z += 0.002;
            vbb.min.y += 0.001;
            for (const p of nodes) {
              if (!/(screw|hex nut|pressnut|press nut|washer)/i.test(tidy(p.node.name))) continue;
              const c = new THREE.Box3().setFromObject(p.node).getCenter(new THREE.Vector3());
              if (vbb.containsPoint(c)) p.withVideo = true;
            }
          }
        } else if (!b.select?.none) {
          console.warn(`[hero] beat "${b.id}" resolved to 0 nodes`);
        }
        return beat;
      });
      onBeats?.(BEATS.map((b) => ({id: b.id, title: b.title, note: b.note})));

      /* --------------------------------------------- dim everything else */
      const twin = new Map<THREE.Material, THREE.MeshStandardMaterial>();
      const twinOf = (m: any) => {
        let t = twin.get(m);
        if (!t) {
          t = m.clone();
          (t as any).userData = {normal: m, baseColor: m.color.clone(), baseEnv: m.envMapIntensity ?? 1};
          twin.set(m, t!);
          twin.set(t!, t!);
        }
        return t!;
      };
      let dimmed: any[] = [];
      const dimSetFor = (b: Beat) => {
        if (b.dim) return b.dim;
        const keep = new Set<THREE.Object3D>();
        for (const p of b.nodes) p.node.traverse((o) => keep.add(o));
        const out: any[] = [];
        droneRoot.traverse((o: any) => {
          if (o.isMesh && !keep.has(o)) out.push(o);
        });
        b.dim = b.nodes.length ? out : [];
        return b.dim;
      };
      function setDim(b: Beat | null) {
        for (const m of dimmed) if (m.material.userData?.normal) m.material = m.material.userData.normal;
        dimmed = b ? dimSetFor(b) : [];
        for (const m of dimmed) m.material = twinOf(m.material);
      }

      /* ------------------------------------------------------- sequencing */
      const Q = cfg.sequence;
      const TRAVEL = Q.travel;
      const HOLD = Q.hold;
      const dur = () => TRAVEL * 2 + HOLD;
      const ease = (x: number) => x * x * (3 - 2 * x);
      const envelope = (l: number) =>
        l < TRAVEL ? ease(l / TRAVEL) : l < TRAVEL + HOLD ? 1 : 1 - ease(Math.min(1, (l - TRAVEL - HOLD) / TRAVEL));

      let beatIdx = 0;
      let t = 0;
      let camH = cfg.camera?.height ?? 0.5;
      let orbitAngle = 0;
      const _q = new THREE.Quaternion();
      const restore = (b: Beat) => {
        for (const p of b.nodes) {
          p.node.position.copy(p.pos);
          p.node.quaternion.copy(p.quat);
          p.node.scale.copy(p.scl);
        }
      };

      function present(b: Beat, k: number, elapsed: number) {
        if (!b.nodes.length) {
          spotL.intensity = 0;
          beam.visible = false;
          return;
        }
        restore(b);
        if (k <= 0.0001) {
          spotL.intensity = 0;
          beam.visible = false;
          return;
        }
        const fwd = camera.getWorldDirection(new THREE.Vector3());
        const rightv = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
        const dist = droneRadius * 2.55;
        const anchor = camera.position
          .clone()
          .addScaledVector(fwd, dist)
          .addScaledVector(rightv, -dist * S.stageLeft)
          .addScaledVector(camera.up, dist * 0.03);
        if (b.faceOn) anchor.addScaledVector(camera.up, dist * (S.boardTilt ?? 0));
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
        const wantScale =
          THREE.MathUtils.clamp((halfH * Q.partSize) / (b.radius as number), 0.2, 80) / pivot.scale.x;
        const spin = new THREE.Quaternion().setFromAxisAngle(camera.up, elapsed * Q.inspectSpin);
        const SS = wantScale * pivot.scale.x;

        // The spotlight strikes only once the part has arrived, and cuts as it
        // leaves. That cut is the cue for the copy on the right.
        const arrived = elapsed >= TRAVEL && elapsed <= TRAVEL + HOLD;
        const strike = arrived
          ? THREE.MathUtils.clamp((elapsed - TRAVEL) / Math.max(S.strike * HOLD, 1e-3), 0, 1)
          : 0;
        const shoot = 1 - (1 - strike) ** 3;
        const ignite = 1 + 0.9 * Math.exp(-7 * strike);
        const sideAng = THREE.MathUtils.degToRad(S.sideAngle);
        const lampPos = anchor
          .clone()
          .addScaledVector(camera.up, dist * S.height)
          .addScaledVector(rightv, dist * 0.55 * Math.sin(sideAng))
          .addScaledVector(fwd, -dist * 0.55 * Math.cos(sideAng));
        spotL.position.copy(lampPos);
        spotL.target.position.copy(anchor);
        spotL.target.updateMatrixWorld();
        spotL.angle = THREE.MathUtils.degToRad(S.coneAngle);
        spotL.penumbra = S.softness;
        spotL.intensity = S.power * shoot * ignite * droneRadius * droneRadius;
        const dirv = anchor.clone().sub(lampPos).normalize();
        const span = lampPos.distanceTo(anchor) * 6 * shoot;
        const rad = Math.tan(THREE.MathUtils.degToRad(S.coneAngle)) * span * 0.55 * shoot;
        beam.visible = strike > 0.01;
        beamMat.opacity = 0.085 * S.beam * shoot * ignite;
        beam.scale.set(rad, Math.max(span, 1e-5), rad);
        beam.position.copy(lampPos).addScaledVector(dirv, span * 0.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirv);

        const holdT = THREE.MathUtils.clamp((elapsed - TRAVEL) / Math.max(HOLD, 1e-3), 0, 1);
        const open = holdT < 0.45 ? ease(holdT / 0.45) : holdT < 0.7 ? 1 : 1 - ease((holdT - 0.7) / 0.3);
        const ref = (b.radius as number) * SS;

        for (const p of b.nodes) {
          // Teardown: the plate and its screws lift, the video stack lifts less,
          // then the frame goes home while the video stack stays lit.
          let kk = k;
          if (b.choreo === 'frame-teardown') {
            const isVideo = p.withVideo || VIDEO_RE.test(tidy(p.node.name));
            if (!isVideo && holdT > 0.55) {
              const back = 1 - Math.min(1, (holdT - 0.55) / 0.25);
              kk = k * (back * back * (3 - 2 * back));
            }
          }
          const off = p.worldCentre.clone().sub(b.centre as THREE.Vector3).multiplyScalar(SS).applyQuaternion(spin);
          if (b.choreo === 'frame-teardown') {
            if (p.withTop) off.addScaledVector(camera.up, ref * 1.15 * open);
            else if (p.withVideo || VIDEO_RE.test(tidy(p.node.name)))
              off.addScaledVector(camera.up, ref * 0.55 * open);
          }
          const targetCentre = anchor.clone().add(off);
          const o2c = p.worldCentre.clone().sub(p.worldOrigin).multiplyScalar(SS).applyQuaternion(spin);
          const wantLocal = p.node.parent!.worldToLocal(targetCentre.sub(o2c));
          p.node.position.lerpVectors(p.pos, wantLocal, kk);
          p.node.parent!.getWorldQuaternion(_q);
          const target = _q.clone().invert().multiply(spin).multiply(_q).multiply(p.quat);
          p.node.quaternion.copy(p.quat).slerp(target, kk);
          p.node.scale.copy(p.scl).lerp(p.scl.clone().multiplyScalar(wantScale), kk);
        }
      }

      /* ----------------------------------------------------------- scroll
       * The reader's wheel moves a TARGET; a critically damped spring moves the
       * position. No velocity clamp: throttling input feels broken. On release
       * the destination is committed ONCE in the direction of travel, so the
       * timeline can never reverse under someone mid-transition. */
      const span = () => BEATS.length * dur();
      const stopFor = (i: number) => i * dur() + TRAVEL + HOLD * 0.5;
      const nearestIdx = (x: number) => {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < BEATS.length; i++) {
          const d = Math.abs(stopFor(i) - x);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        return best;
      };
      let target = 0;
      let pos = 0;
      let vel = 0;
      let lastWheel = 0;
      let gestureFrom = 0;
      let gestureDir = 0;
      let committed: number | null = null;
      const onWheel = (e: WheelEvent) => {
        const now = performance.now();
        // Let the page scroll away once the sequence is finished at either end.
        const atEnd = pos >= span() - dur() * 0.5 && e.deltaY > 0;
        const atStart = pos <= dur() * 0.2 && e.deltaY < 0;
        if (atEnd || atStart) return;
        e.preventDefault();
        if (now - lastWheel > 220) {
          gestureFrom = nearestIdx(pos);
          gestureDir = 0;
          committed = null;
        }
        if (e.deltaY !== 0) gestureDir = Math.sign(e.deltaY);
        lastWheel = now;
        const step = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 60) * 0.0016 * dur();
        target = Math.max(0, Math.min(span() - 0.001, target + step));
      };
      el.addEventListener('wheel', onWheel, {passive: false});
      cleanup.push(() => el.removeEventListener('wheel', onWheel));

      /* ------------------------------------------------------------- loop */
      const clock = new THREE.Clock();
      let lastBeat = -1;
      let lastDimBeat = -1;
      let sizedTo = '';
      const resizeIfNeeded = () => {
        const w = Math.round(el.clientWidth);
        const h = Math.round(el.clientHeight);
        if (!w || !h) return;
        const dpr = Math.min(devicePixelRatio, 2);
        const key = `${w}x${h}@${dpr}`;
        if (key === sizedTo) return;
        sizedTo = key;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, true);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        (window as any).__heroSize = key;
      };

      camera.position.copy(droneCentre).add(new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(droneRadius * 2.15));
      camera.near = droneRadius / 300;
      camera.far = droneRadius * 60;
      resizeIfNeeded();

      renderer.setAnimationLoop(() => {
        resizeIfNeeded();
        const dt = Math.min(clock.getDelta(), 0.05);

        const idle = performance.now() - lastWheel;
        if (idle > 120) {
          if (committed === null) {
            const fromPos = stopFor(gestureFrom);
            const moved = (target - fromPos) * (gestureDir || 1);
            const advance = moved > dur() * 0.28 || Math.abs(vel) > dur() * 0.6;
            committed = Math.max(0, Math.min(BEATS.length - 1, gestureFrom + (advance ? gestureDir || 1 : 0)));
          }
          const snap = stopFor(committed);
          const settle = Math.min(1, (idle - 120) / 260);
          target += (snap - target) * (1 - (1 - 0.14 * settle) ** (dt * 60));
        }
        const omega = 2 * Math.PI * 1.1;
        const f = 1 + 2 * dt * omega;
        const oo = omega * omega;
        const hoo = dt * oo;
        const hhoo = dt * hoo;
        const det = 1 / (f + hhoo);
        const nx = (f * pos + dt * vel + hhoo * target) * det;
        const nv = (vel + hoo * (target - pos)) * det;
        pos = nx;
        vel = nv;

        beatIdx = Math.min(BEATS.length - 1, Math.max(0, Math.floor(pos / dur())));
        t = pos - beatIdx * dur();
        const b = BEATS[beatIdx];

        if (beatIdx !== lastDimBeat) {
          lastDimBeat = beatIdx;
          setDim(b);
        }
        if (beatIdx !== lastBeat) {
          lastBeat = beatIdx;
          onBeat?.({id: b.id, title: b.title, note: b.note}, beatIdx);
        }
        onProgress?.(pos / span());

        const kRaw = envelope(t);
        const k = b.nodes.length ? kRaw : 0;

        for (const g of propPivots)
          (g as any).userData.spin.rotation.z += dt * Q.propRate * (1 - k) * (g as any).userData.dir * Q.propHanded;

        for (const other of BEATS) if (other !== b) restore(other);
        pivot.scale.setScalar(THREE.MathUtils.lerp(1, S.shrinkDrone, k));
        const bright = THREE.MathUtils.lerp(1, 1 - (b.fade ?? S.darkenRest), k);
        for (const m of twin.values()) {
          const u = (m as any).userData;
          if (!u?.baseColor) continue;
          m.color.copy(u.baseColor).multiplyScalar(bright);
          m.envMapIntensity = u.baseEnv * bright;
        }
        const d = THREE.MathUtils.lerp(1, 1 - S.dimLights, k);
        hemi.intensity = BASE.hemi * d;
        keyL.intensity = BASE.key * d;
        fillL.intensity = BASE.fill * d;
        rimL.intensity = BASE.rim * d;
        bncL.intensity = BASE.bounce * d;

        scene.updateMatrixWorld(true);
        present(b, k, t);

        orbitAngle += dt * Q.autoOrbit;
        const wantH = b.faceOn ? (cfg.camera?.heightOnBoard ?? 0.72) : (cfg.camera?.height ?? 0.5);
        camH += (THREE.MathUtils.lerp(cfg.camera?.height ?? 0.5, wantH, k) - camH) * (1 - 0.35 ** dt);
        const back = droneRadius * ((cfg.camera?.distance ?? 2.15) + (cfg.camera?.dollyOnShow ?? 0.92) * k);
        const off = new THREE.Vector3(Math.cos(orbitAngle), camH, Math.sin(orbitAngle)).normalize().multiplyScalar(back);
        camera.position.lerp(droneCentre.clone().add(off), 1 - 0.004 ** dt);
        camera.lookAt(droneCentre);

        renderer.render(scene, camera);
      });
      cleanup.push(() => renderer.setAnimationLoop(null));

      onReady?.();
    })().catch((e: unknown) => {
      console.error('[hero]', e);
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      disposed = true;
      for (const fn of cleanup.reverse()) fn();
      // Belt and braces: if an in-flight instance still managed to append, do
      // not leave a dead canvas stacked over the live one.
      for (const c of Array.from(el.querySelectorAll('canvas'))) c.remove();
    };
  }, [model, onBeat, onBeats, onProgress, onReady]);

  return (
    <div ref={host} style={{position: 'absolute', inset: 0}}>
      {error ? (
        <div style={{position: 'absolute', left: 16, bottom: 16, color: '#ff8574', font: '12px ui-monospace'}}>
          hero: {error}
        </div>
      ) : null}
    </div>
  );
}
