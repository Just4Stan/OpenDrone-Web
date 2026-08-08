/**
 * Flatten any content file into a flat list of editable leaves.
 *
 * Page copy is mostly `key: "string"`. Product content is not: a spec is a pair
 * inside an array, an in-the-box row is `{qty, item}`, the hero is an object of
 * four differently styled lines, and variants nest another whole record per
 * option. A textarea per top-level key cannot edit any of that.
 *
 * Rather than write a bespoke editor per shape, and then a seventh one the day
 * a new field appears, the file is walked to its string leaves and each is
 * addressed by path: `hero.line1`, `specs.3.1`, `inTheBox.2.item`,
 * `variants.20×20.specs.0.1`. One input per leaf, one writer, every shape.
 *
 * Only strings are editable. Numbers and booleans are configuration rather than
 * copy (`discountPct`, `propHanded`), and letting them be retyped as text in a
 * box labelled "words" is how a page ends up with `"discountPct": "ten"`.
 */

export type Leaf = {
  /** Dotted path from the file root. Also the React key and the `data-edit` id. */
  path: string;
  value: string;
  /** Depth, so the inspector can indent rather than show a wall of paths. */
  depth: number;
};

/** Keys starting with `$` are configuration, not copy. */
const isMeta = (k: string) => k.startsWith('$');

export function flattenLeaves(input: unknown, prefix = '', depth = 0): Leaf[] {
  const out: Leaf[] = [];

  if (typeof input === 'string') {
    out.push({path: prefix, value: input, depth});
    return out;
  }

  if (Array.isArray(input)) {
    input.forEach((v, i) => {
      out.push(...flattenLeaves(v, prefix ? `${prefix}.${i}` : String(i), depth + 1));
    });
    return out;
  }

  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (!prefix && isMeta(k)) continue;
      out.push(...flattenLeaves(v, prefix ? `${prefix}.${k}` : k, depth + 1));
    }
    return out;
  }

  // Numbers, booleans, null: real data, but not text. Skipped on purpose.
  return out;
}

/**
 * Write one leaf back, without mutating the original.
 *
 * Structure is never created or destroyed here: the path must already exist, so
 * an edit can only ever change a string in place. That is deliberate. The words
 * editor should not be able to invent a spec row or delete a variant as a side
 * effect of a typo in a path, and array indices stay meaningful because nothing
 * shifts.
 */
export function setLeaf<T>(root: T, path: string, value: string): T {
  const parts = path.split('.');

  const walk = (node: unknown, i: number): unknown => {
    const key = parts[i];
    const last = i === parts.length - 1;

    if (Array.isArray(node)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return node;
      const copy = [...node];
      copy[idx] = last ? value : walk(node[idx], i + 1);
      return copy;
    }

    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (!(key in obj)) return node;
      return {...obj, [key]: last ? value : walk(obj[key], i + 1)};
    }

    return node;
  };

  return walk(root, 0) as T;
}

/**
 * A short label for a leaf: the last one or two path segments, with numeric
 * indices folded into the segment before them.
 *
 * `specs.3.1` reads as nothing on its own; `specs 3 · 1` is not much better.
 * The inspector shows the full path too, so this only has to be scannable in a
 * list, not unambiguous.
 */
export function leafLabel(path: string): string {
  const parts = path.split('.');
  const tail = parts.slice(-2);
  if (tail.length < 2) return parts.join('.');
  // Order matters: `specs.3.1` has a numeric segment in BOTH positions, and it
  // is the leading one that tells you we are inside an array, so it is tested
  // first. Checking the trailing index first labelled it `3[1]`, which drops
  // the only word in the path.
  if (/^\d+$/.test(tail[0])) {
    return `${parts.at(-3) ?? ''} ${tail[0]}·${tail[1]}`.trim();
  }
  if (/^\d+$/.test(tail[1])) return `${tail[0]}[${tail[1]}]`;
  return tail.join('.');
}
