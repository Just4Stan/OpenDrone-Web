import {HERO_VARIANT_AXIS, type PartDef} from '~/lib/builder/registry';

/**
 * CompatBadge — a row of mono compatibility chips derived ENTIRELY from
 * registry facts (never authored prose): the mount pattern(s) a part bolts to,
 * the airframe size class(es) it ships a model for, and its Shopify variant
 * value. Answers "does this fit my build?" structurally on register rows, the
 * PDP ordering table and cart ghost rows.
 *
 * `state` is built out now — ok / neutral / blocked — so the future /builder
 * route inherits the compatibility-verdict styling without a rewrite. Today
 * every surface passes the default `neutral`.
 *
 * Skin: 1px --color-border-strong hairline, --color-bg-elevated fill, JetBrains
 * Mono 11px, square (--r-xs). Tokens only — correct in both themes.
 */

export type CompatState = 'ok' | 'neutral' | 'blocked';

/** '20x20' → '20×20' (U+00D7); 'm9' → 'M9'. Registry mount values only. */
function formatMount(m: string): string {
  const grid = /^(\d+)x(\d+)$/.exec(m);
  return grid ? `${grid[1]}×${grid[2]}` : m.toUpperCase();
}

const SIZE_LABEL: Record<string, string> = {'3': '3″', '5': '5″'};

const COMPAT_STYLE = `
.compat-badge{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;}
.compat-badge__chip{
  display:inline-flex;align-items:center;
  padding:2px 6px;
  border:1px solid var(--color-border-strong);
  background:var(--color-bg-elevated);
  border-radius:var(--r-xs);
  font-family:var(--font-mono);
  font-size:11px;line-height:1.3;letter-spacing:0.04em;
  color:var(--color-text-muted);
  font-variant-numeric:tabular-nums slashed-zero;
  white-space:nowrap;
}
.compat-badge--ok .compat-badge__chip{border-color:var(--color-stock);color:var(--color-text);}
.compat-badge--blocked .compat-badge__chip{border-color:var(--color-error);color:var(--color-text);}
`;

export function CompatBadge({
  part,
  state = 'neutral',
  className,
}: {
  part: PartDef;
  state?: CompatState;
  className?: string;
}) {
  const chips: string[] = [];

  // Mount pattern(s) it bolts to.
  if (part.mounts?.length) {
    chips.push(part.mounts.map(formatMount).join(' · '));
  }

  // Size class(es) it ships a model for (Object.keys(models) → '3″ · 5″').
  const sizes = Object.keys(part.models).sort();
  if (sizes.length) {
    chips.push(sizes.map((s) => SIZE_LABEL[s] ?? `${s}″`).join(' · '));
  }

  // Shopify variant value on the Model axis (e.g. '30×30').
  if (
    part.commerce.kind === 'shopify' &&
    part.commerce.options?.[HERO_VARIANT_AXIS]
  ) {
    chips.push(part.commerce.options[HERO_VARIANT_AXIS]);
  }

  // Drop exact duplicates — an FC's mount chip and its variant chip often
  // coincide ('30×30'). Keep first occurrence, registry-order.
  const seen = new Set<string>();
  const unique = chips.filter((c) => c && !seen.has(c) && seen.add(c));
  if (unique.length === 0) return null;

  return (
    <span
      className={`compat-badge compat-badge--${state}${
        className ? ` ${className}` : ''
      }`}
    >
      {unique.map((c) => (
        <span key={c} className="compat-badge__chip">
          {c}
        </span>
      ))}
      <style>{COMPAT_STYLE}</style>
    </span>
  );
}
