/**
 * One stable color per contributor, shared by every surface that draws
 * people: the commit strip's ticks and the contributor tiles' accent line.
 * The tiles ARE the legend, so both must derive the color the same way.
 *
 * Hash of the login rather than rank order: stable across products, across
 * reorderings of the grid, and across the strip and the grid disagreeing
 * about who appears (the strip sees the last 100 commits, the grid the top
 * 12 contributors). Collisions are possible and fine; this is attribution
 * texture, not an identifier.
 *
 * Engineering hues that read on both themes. The first entry is the house
 * gold and it is deliberately the loudest of the eight: it is the brand
 * colour, so a contributor tinted with it should look like the house.
 */
const PALETTE = [
  '#ffb700', // house gold
  '#5a9e6f', // moss
  '#5b84b1', // slate blue
  '#b56d5a', // clay
  '#8f74ad', // heather
  '#4f9a9a', // teal
  '#a3874f', // bronze
  '#7f8fb3', // steel
] as const;

export function contributorColor(login?: string | null): string | null {
  if (!login) return null;
  let h = 0;
  for (let i = 0; i < login.length; i++) {
    h = (h * 31 + login.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
