/**
 * Central device-capability / power tier for the whole site.
 *
 * The storefront is GPU/CPU-heavy on the homepage (a live WebGL drone) and the
 * PDP (a WebGL wireframe frame + layered SVG board art). Each surface already
 * optimizes itself in isolation, but nothing detected the *machine*: a weak GPU,
 * a laptop on battery-saver, or a `Save-Data` request all got the full M3-class
 * treatment. This module is the one place that decides how hard the site is
 * allowed to push, and every heavy surface reads the result.
 *
 * Three tiers (no in-between "live-but-degraded" state — fewer bugs):
 *   full    — capable GPU, plugged in, no reduced-* → everything as before
 *   minimal — weak hardware / low battery / reduced-motion / sustained jank →
 *             no live WebGL (poster fallback), ambient CSS motion off
 *   static  — no WebGL / software renderer / reduced-data / 2g → fully static
 *
 * Detection combines three signal classes (never trust one number):
 *   A. static hints   — hardwareConcurrency, deviceMemory, WebGL renderer string
 *   B. user/OS intent — reduced-motion, reduced-data/Save-Data, battery, conn
 *   C. runtime truth  — an FPS probe that can only push the tier DOWN (latched)
 *
 * The base tier (A + the synchronous parts of B) is resolved BEFORE first paint
 * by an inline `<head>` script (`PERF_INIT_SCRIPT`, mirrors the theme-init
 * pattern) so `shouldLoadHero()` and friends can read it at module eval with no
 * flash and no hydration mismatch. Battery (async) and the FPS probe refine it
 * after mount, in the provider.
 */

export type PerfTier = 'full' | 'minimal' | 'static';

/** Higher = more capable. Used to take the *worst* (lowest) of several reasons. */
const RANK: Record<PerfTier, number> = {static: 0, minimal: 1, full: 2};

/** Pick the most degraded (lowest-rank) tier among the candidates. */
export function worstTier(...tiers: PerfTier[]): PerfTier {
  return tiers.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b), 'full');
}

/** Raw signals captured at detection time — surfaced in the debug HUD. */
export interface PerfSignals {
  cores: number | null; // navigator.hardwareConcurrency
  memory: number | null; // navigator.deviceMemory (GB; Chromium only)
  reducedMotion: boolean;
  reducedData: boolean; // prefers-reduced-data OR connection.saveData
  effectiveType: string | null; // navigator.connection.effectiveType
  webgl: boolean; // a WebGL context could be created
  renderer: string | null; // unmasked GPU string, if exposed
  software: boolean; // renderer looks like a software rasterizer
}

/** The attribute the tier is written onto `<html>` so CSS can react too. */
export const PERF_TIER_ATTR = 'data-perf-tier';
/** Global the init script stashes signals on, for the provider + HUD to read. */
export const PERF_GLOBAL = '__odPerf';
/** localStorage key for a manual tier override (debug). Absent = auto-detect. */
export const PERF_FORCE_KEY = 'od-perf-force';

export type PerfForce = PerfTier | null;

/** Read the debug override from localStorage. Returns null when auto. */
export function readForce(): PerfForce {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(PERF_FORCE_KEY);
    return v === 'full' || v === 'minimal' || v === 'static' ? v : null;
  } catch {
    return null;
  }
}

/** Persist (or clear, with null) the debug override. */
export function writeForce(force: PerfForce): void {
  try {
    if (force) localStorage.setItem(PERF_FORCE_KEY, force);
    else localStorage.removeItem(PERF_FORCE_KEY);
  } catch {
    /* private mode / disabled storage — ignore */
  }
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;
const WEAK_EFFECTIVE_TYPE = /^(slow-)?2g$/;
const LOW_CORES = 4; // < this → minimal
const LOW_MEMORY = 4; // <= this (GB) → minimal

/**
 * Base tier from static hints + the *synchronous* intent signals. This is the
 * exact logic the inline `PERF_INIT_SCRIPT` runs pre-paint; it's duplicated as
 * a string there (can't import) and kept here as the readable source of truth /
 * for any client-side recompute. Battery is async and handled in the provider.
 */
export function detectBaseTier(signals: PerfSignals): PerfTier {
  // STATIC: no GPU path at all, or the user/network explicitly asked for less.
  if (!signals.webgl || signals.software) return 'static';
  if (signals.reducedData) return 'static';
  if (signals.effectiveType && WEAK_EFFECTIVE_TYPE.test(signals.effectiveType)) {
    return 'static';
  }
  // MINIMAL: motion-averse, or hardware that won't hold 60fps on the 3D scene.
  if (signals.reducedMotion) return 'minimal';
  if (signals.cores !== null && signals.cores > 0 && signals.cores < LOW_CORES) {
    return 'minimal';
  }
  if (signals.memory !== null && signals.memory > 0 && signals.memory <= LOW_MEMORY) {
    return 'minimal';
  }
  return 'full';
}

/** Read the live signals on the client. Safe to call after mount only. */
export function readSignals(): PerfSignals {
  if (typeof window === 'undefined') {
    return {
      cores: null,
      memory: null,
      reducedMotion: false,
      reducedData: false,
      effectiveType: null,
      webgl: true,
      renderer: null,
      software: false,
    };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {effectiveType?: string; saveData?: boolean};
  };
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const reducedDataPref = window.matchMedia(
    '(prefers-reduced-data: reduce)',
  ).matches;
  const conn = nav.connection;
  const {webgl, renderer, software} = probeWebGL();
  return {
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    reducedMotion,
    reducedData: reducedDataPref || conn?.saveData === true,
    effectiveType: conn?.effectiveType ?? null,
    webgl,
    renderer,
    software,
  };
}

/** Best-effort GPU probe: can we get a context, and is it a software rasterizer? */
function probeWebGL(): {webgl: boolean; renderer: string | null; software: boolean} {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') ||
      c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return {webgl: false, renderer: null, software: false};
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext
      ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
      : null;
    return {
      webgl: true,
      renderer,
      software: renderer ? SOFTWARE_RENDERER.test(renderer) : false,
    };
  } catch {
    return {webgl: false, renderer: null, software: false};
  }
}

/**
 * Synchronously read the base tier written to `<html>` by the init script.
 * Falls back to recomputing from live signals (e.g. in tests/SSR-less mounts),
 * and to 'full' on the server. This is what `shouldLoadHero()` reads.
 */
export function currentBaseTier(): PerfTier {
  if (typeof document === 'undefined') return 'full';
  const attr = document.documentElement.getAttribute(PERF_TIER_ATTR) as PerfTier | null;
  if (attr === 'full' || attr === 'minimal' || attr === 'static') return attr;
  return detectBaseTier(readSignals());
}

/**
 * Pre-paint inline script (stringified — runs before the bundle, so it can't
 * import anything). Computes the base tier from static + synchronous-intent
 * signals, honours a localStorage debug override, writes the result to
 * `<html data-perf-tier>`, and stashes the raw signals on `window[PERF_GLOBAL]`
 * for the provider/HUD. Mirrors THEME_INIT_SCRIPT.
 *
 * Kept in sync with `detectBaseTier` above — change both together.
 */
export const PERF_INIT_SCRIPT = `(function(){try{
var r=document.documentElement,n=navigator,m=window.matchMedia;
function mm(q){try{return m&&m(q).matches}catch(e){return false}}
var rm=mm('(prefers-reduced-motion: reduce)');
var rd=mm('(prefers-reduced-data: reduce)');
var conn=n.connection||n.webkitConnection||null;
var save=!!(conn&&conn.saveData);
var et=conn&&conn.effectiveType||null;
var cores=typeof n.hardwareConcurrency==='number'?n.hardwareConcurrency:null;
var mem=typeof n.deviceMemory==='number'?n.deviceMemory:null;
var webgl=false,renderer=null,software=false;
try{var c=document.createElement('canvas');var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
if(gl){webgl=true;var ex=gl.getExtension('WEBGL_debug_renderer_info');if(ex){renderer=gl.getParameter(ex.UNMASKED_RENDERER_WEBGL);}
software=renderer?/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(renderer):false;}}catch(e){}
var detected='full';
if(!webgl||software||rd||save||(et&&/^(slow-)?2g$/.test(et))){detected='static';}
else if(rm||(cores&&cores>0&&cores<4)||(mem&&mem>0&&mem<=4)){detected='minimal';}
var force=null;try{var f=localStorage.getItem('${PERF_FORCE_KEY}');if(f==='full'||f==='minimal'||f==='static')force=f;}catch(e){}
var tier=force||detected;
r.setAttribute('${PERF_TIER_ATTR}',tier);
window['${PERF_GLOBAL}']={tier:tier,base:tier,detected:detected,force:force,signals:{cores:cores,memory:mem,reducedMotion:rm,reducedData:(rd||save),effectiveType:et,webgl:webgl,renderer:renderer,software:software}};
}catch(e){try{document.documentElement.setAttribute('${PERF_TIER_ATTR}','full')}catch(_){}}})();`;
