/**
 * Design-token overrides authored in the studio.
 *
 * `content/theme.json` is a flat map of custom property to value. It is emitted
 * as a `:root{}` block after the stylesheet, so it overrides the `@theme`
 * defaults without touching app.css. The stylesheet stays the designed baseline
 * and this file is the diff on top of it, which means `git diff content/` shows
 * exactly what was changed and deleting the file restores the original design.
 *
 * Loaded through a glob rather than a direct import so a missing or empty file
 * is simply "no overrides" instead of a build error.
 */
/**
 * Guarded so the module can also be imported by the node:test suites, which run
 * the TypeScript directly with no bundler and have no `import.meta.glob`. Vite
 * still rewrites the call itself, so the real build is unaffected.
 */
const FILES = import.meta.env
  ? import.meta.glob<{default: Record<string, string>}>('/content/theme.json', {
      eager: true,
    })
  : {};

const OVERRIDES: Record<string, string> =
  Object.values(FILES)[0]?.default ?? {};

/**
 * Only accept things that look like a custom property and a value with no way
 * out of the declaration. The file is committed to the repo and only written by
 * a localhost-only dev endpoint, so this is not defending against an attacker;
 * it is making sure a malformed value breaks one token instead of terminating
 * the block early and taking the rest of the page's theme with it.
 */
const NAME_OK = /^--[a-zA-Z0-9-]+$/;
const VALUE_BAD = /[;{}<]|\/\*|\*\//;

export function themeOverrideCss(): string {
  const decls = Object.entries(OVERRIDES)
    .filter(([k, v]) => NAME_OK.test(k) && typeof v === 'string' && !VALUE_BAD.test(v))
    .map(([k, v]) => `${k}:${v.trim()}`);
  if (!decls.length) return '';
  // Both selectors, because `html.light` is a class and would otherwise
  // out-specify a bare `:root` for the 18 tokens it redefines.
  return `:root,html.light,html.dark{${decls.join(';')}}`;
}
