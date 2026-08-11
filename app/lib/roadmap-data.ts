/**
 * The roadmap's structure, lifted out of the route so other surfaces can
 * share it without importing a route module.
 *
 * Two consumers today: `app/routes/roadmap.tsx` renders the kanban from it,
 * and the cart ballot derives its candidate list from it, so "what you can
 * vote on" and "what the board shows" cannot drift apart. The product pages'
 * status chips were the third consumer this lift was originally asked for
 * (see the status-system note in CLAUDE.md).
 *
 * DATA RULE, unchanged from the route: every entry must be verifiable in
 * public, or be an explicit statement of intent (planned). Nothing gets a
 * date. The entry's name and its one-line note are copy in
 * `content/copy/roadmap.json`, keyed off `id`; everything here is structure.
 *
 * The status listed here is the static fallback. At request time the roadmap
 * loader overwrites it with the `status-*` topic on the linked GitHub repo,
 * which is the canonical carrier.
 */

export type ProductStatus =
  | 'launched'
  | 'beta'
  | 'alpha'
  | 'in-progress'
  | 'planned';

export type RoadmapItem = {
  /** Copy key stem: `item_<id>_name` and `item_<id>_note`. */
  id: string;
  status: ProductStatus;
  /** Product page on this site, when one exists. */
  productPath?: string;
  /** Public design source. Omit when nothing public exists. */
  link?: string;
};

export const ROADMAP: RoadmapItem[] = [
  {
    id: 'openfc_lite_30',
    status: 'beta',
    productPath: '/products/openfc-lite',
    link: 'https://github.com/OpenDrone-hw/OpenFC-Lite',
  },
  {
    id: 'openfc_lite_mini_20',
    status: 'beta',
    productPath: '/products/openfc-lite',
    link: 'https://github.com/OpenDrone-hw/OpenFC-Lite-Mini',
  },
  {
    id: 'openesc_20',
    status: 'beta',
    productPath: '/products/openesc',
    link: 'https://github.com/OpenDrone-hw/OpenESC-20x20',
  },
  {
    id: 'openesc_30',
    status: 'beta',
    productPath: '/products/openesc',
    link: 'https://github.com/OpenDrone-hw/OpenESC-30x30',
  },
  {
    id: 'openrx',
    status: 'alpha',
    productPath: '/products/openrx',
    link: 'https://github.com/OpenDrone-hw/OpenRX',
  },
  {
    id: 'openframe',
    status: 'in-progress',
    productPath: '/products/openframe',
  },
  {
    id: 'motors',
    status: 'in-progress',
  },
  {
    id: 'openvtx',
    status: 'planned',
    link: 'https://github.com/OpenDrone-hw/OpenVTX',
  },
  {
    id: 'openremoteid',
    status: 'planned',
    link: 'https://github.com/OpenDrone-hw/OpenRemoteID',
  },
  {
    id: 'openaio',
    status: 'planned',
    link: 'https://github.com/OpenDrone-hw/OpenAIO',
  },
  {
    id: 'charger',
    status: 'planned',
    link: 'https://github.com/OpenDrone-hw/Charger',
  },
];

/**
 * The vocabulary and its column order. Deliberately a bare list of KEYS: each
 * status's label and legend are copy (`status_<key>_label` /
 * `status_<key>_legend`), so a studio edit can rename a status but cannot add,
 * drop or reorder one. The `status-*` topics on the repos are matched against
 * exactly this list.
 */
export const STATUS_ORDER: ProductStatus[] = [
  'launched',
  'beta',
  'alpha',
  'in-progress',
  'planned',
];

/**
 * What the community can vote on: everything not yet buyable and not already
 * on the home straight. Alpha is excluded on purpose, a product with community
 * testers is being finished regardless of the vote.
 *
 * Uses the static statuses, not the live topics: the ballot is rendered in the
 * cart, which does not fetch GitHub, and a candidate list that changed under a
 * voter mid-session would be worse than one that lags a repo topic by a
 * deploy.
 */
const VOTABLE: ReadonlySet<ProductStatus> = new Set<ProductStatus>([
  'in-progress',
  'planned',
]);

export function voteCandidates(): RoadmapItem[] {
  return ROADMAP.filter((r) => VOTABLE.has(r.status));
}

export function voteCandidateIds(): string[] {
  return voteCandidates().map((r) => r.id);
}
