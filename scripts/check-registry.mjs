#!/usr/bin/env node
/**
 * Executes the builder-registry invariants in CI.
 *
 * The asserts in app/lib/builder/registry.ts are gated behind
 * `import.meta.env.DEV` so a bad data edit can never 500 the production
 * worker at boot (server.ts statically imports the route graph, which imports
 * the registry). But lint/tsc/build never EVALUATE the module either — so
 * without this script no automated step would ever run the checks. CI calls
 * `npm run check:registry` (see .github/workflows/ci.yml), which imports the
 * registry via Node's type stripping (registry.ts is intentionally
 * dependency-free and erasable-syntax-only) and runs every invariant:
 *
 *   - HERO_SLOT_IDS ⊆ SLOTS, exactly one fitAnchor slot
 *   - every hero slot × airframe size resolves to a purchasable part + GLB,
 *     one product handle per slot, option values agree with the airframe's
 *     Model mapping
 *   - choreography generator: 3-slot output identical to the legacy
 *     hand-tuned literals, and non-overlapping windows bracketed by
 *     monotonic stops for slot counts 1–6
 *
 * Run locally: npm run check:registry
 */
import process from 'node:process';

const {assertBuilderRegistry} = await import(
  '../app/lib/builder/registry.ts'
);

try {
  assertBuilderRegistry();
} catch (err) {
  console.error('Builder-registry invariants FAILED:\n');
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
}
console.log('Builder-registry invariants OK (assertBuilderRegistry passed).');
