/**
 * Cooperative main-thread scheduling primitives shared by the heavy client
 * pipelines (HeroScene GLB build, FrameViewer edge extraction, viewer
 * warm-ups). One home for the yield strategy and its tuning constants so a
 * fix or retune reaches every consumer.
 */

/** Target upper bound for one synchronous work slice. */
export const SLICE_BUDGET_MS = 10;

// Shared MessageChannel for the non-scheduler.yield fallback: allocating a
// channel (two entangled ports) per yield churns GC on exactly the browsers
// that need the fallback (no scheduler.yield). Yields resolve strictly in
// post order, so one channel with a resolver queue is equivalent.
let sharedChannel: MessageChannel | null = null;
const pendingYields: Array<() => void> = [];

/**
 * Give the main thread back for one macrotask, without timer clamping.
 * scheduler.yield() (Chromium 129+) resumes with continuation priority; the
 * MessageChannel fallback is likewise unclamped. setTimeout(0) is NOT usable
 * here: nested-timer clamping (>=4ms, worse for background pages) stretches
 * a finely sliced pipeline from ~0.6s of work into many seconds of wall time.
 */
export function yieldToMain(): Promise<void> {
  const sched = (globalThis as {scheduler?: {yield?: () => Promise<void>}})
    .scheduler;
  if (typeof sched?.yield === 'function') return sched.yield();
  if (typeof MessageChannel !== 'undefined') {
    if (!sharedChannel) {
      sharedChannel = new MessageChannel();
      sharedChannel.port1.onmessage = () => {
        pendingYields.shift()?.();
      };
    }
    return new Promise<void>((resolve) => {
      pendingYields.push(resolve);
      sharedChannel!.port2.postMessage(null);
    });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Run `fn` over `items`, yielding via `yieldFn` whenever the current
 * synchronous slice exceeds `budgetMs`. Identical output to a plain loop,
 * just spread across multiple tasks so it never blocks a frame.
 */
export async function forEachSliced<T>(
  items: readonly T[],
  fn: (item: T, index: number) => void,
  yieldFn: () => Promise<void> = yieldToMain,
  budgetMs = SLICE_BUDGET_MS,
): Promise<void> {
  let sliceStart = performance.now();
  for (let i = 0; i < items.length; i++) {
    fn(items[i], i);
    if (performance.now() - sliceStart > budgetMs) {
      await yieldFn();
      sliceStart = performance.now();
    }
  }
}

/**
 * requestIdleCallback with a setTimeout fallback (Safari). Returns a cancel
 * function that always matches the mechanism that was armed.
 */
export function onIdle(
  cb: () => void,
  opts?: {timeout?: number; fallbackDelayMs?: number},
): () => void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(
      cb,
      opts?.timeout != null ? {timeout: opts.timeout} : undefined,
    );
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, opts?.fallbackDelayMs ?? 250);
  return () => window.clearTimeout(id);
}
