import type {Route} from './+types/roadmap';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {EditorialShell} from '~/components/EditorialShell';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {DISCORD_INVITE_URL} from '~/lib/company';

/**
 * Words live in `content/copy/roadmap.json`; this file holds the machinery.
 *
 * The split is not the usual one here, because this page carries the product
 * status system. A status is a controlled vocabulary shared with the
 * `status-*` topics on the GitHub repos, so the status KEYS and their column
 * order stay in code where a copy edit cannot invent a sixth status or
 * reorder the board. What a status is CALLED, and the sentence explaining it,
 * are prose and live in the copy file, keyed 1:1 off the status key. Same for
 * the roadmap entries: the status, the links and the order are code; the name
 * and the one-line note are copy, keyed off the entry's `id`.
 */
export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title:
      copyText('roadmap.meta_title') ??
      'Roadmap · What we build and how to help',
    description: copyText('roadmap.meta_description') ?? '',
  });

/**
 * The status-* topic on each public GitHub repo is the canonical status
 * (see hardware/README.md in the working container). This loader pulls
 * the topics at request time so the page mirrors the repos; the static
 * status in ROADMAP is the fallback for products without a public repo
 * and for API failures. In-memory cache, 1 hour per worker isolate,
 * which also keeps unauthenticated API usage far under the rate limit.
 */
let topicCache: {at: number; map: Record<string, ProductStatus>} | null = null;

async function fetchStatusFlags(
  token?: string,
): Promise<Record<string, ProductStatus>> {
  if (topicCache && Date.now() - topicCache.at < 3_600_000) {
    return topicCache.map;
  }
  const map: Record<string, ProductStatus> = {};
  await Promise.all(
    ROADMAP.filter((r) => r.link).map(async (r) => {
      try {
        const name = (r.link as string).replace('https://github.com/', '');
        const res = await fetch(`https://api.github.com/repos/${name}/topics`, {
          headers: {
            'User-Agent': 'opendrone-store-roadmap',
            Accept: 'application/vnd.github+json',
            // 60 req/h unauthenticated vs 5000 with a token; set
            // GITHUB_STATUS_TOKEN (read-only, public repos) in Oxygen.
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
          },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {names?: string[]};
        const flag = data.names
          ?.find((t) => t.startsWith('status-'))
          ?.slice('status-'.length);
        if (flag && (STATUS_ORDER as string[]).includes(flag)) {
          map[r.link as string] = flag as ProductStatus;
        }
      } catch {
        // Unreachable API: the static status stands in.
      }
    }),
  );
  topicCache = {at: Date.now(), map};
  return map;
}

export async function loader({context}: Route.LoaderArgs) {
  const env = context.env as unknown as Record<string, string | undefined>;
  const flags = await fetchStatusFlags(env.GITHUB_STATUS_TOKEN);
  const roadmap = ROADMAP.map((r) =>
    r.link && flags[r.link] ? {...r, status: flags[r.link]} : r,
  );
  return {roadmap};
}

/**
 * Product status index. One vocabulary, used in three places that must
 * agree: this board, the product pages, and (as `status-<label>` topics)
 * the GitHub repos. Change a status here and mirror it in the other two.
 */
type ProductStatus = 'launched' | 'beta' | 'alpha' | 'in-progress' | 'planned';

type RoadmapItem = {
  /** Copy key stem: `item_<id>_name` and `item_<id>_note`. */
  id: string;
  status: ProductStatus;
  /** Product page on this site, when one exists. */
  productPath?: string;
  /** Public design source. Omit when nothing public exists. */
  link?: string;
};

/**
 * DATA RULE: every entry must be verifiable in public, or be an explicit
 * statement of intent (planned). Nothing gets a date.
 *
 * The entry's name and its one-line note are copy, keyed off `id`. Everything
 * here is structure: which products exist, what they link to, and the status
 * that puts them in a column (overwritten at request time by the repo topic).
 */
const ROADMAP: RoadmapItem[] = [
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
const STATUS_ORDER: ProductStatus[] = [
  'launched',
  'beta',
  'alpha',
  'in-progress',
  'planned',
];

export default function RoadmapRoute({loaderData}: Route.ComponentProps) {
  const columns = STATUS_ORDER.map((status) => ({
    status,
    items: loaderData.roadmap.filter((r) => r.status === status),
  }));

  return (
    <EditorialShell slug="roadmap">
      <header className="editorial-hero">
        <Txt id="roadmap.eyebrow" as="p" className="editorial-eyebrow" />
        <Txt id="roadmap.title" as="h1" className="editorial-title" />
        <Txt id="roadmap.lead" as="p" className="editorial-lead" />
      </header>

      <section className="editorial-section">
        <Txt id="roadmap.s1_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s1_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s2_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s2_body" as="p" />
        <div className="kanban">
          {columns.map((col) => (
            <div className="kanban-col" key={col.status}>
              <p className="kanban-col-head" data-status={col.status}>
                <span className="kanban-dot" />
                <Txt id={`roadmap.status_${col.status}_label`} />
                <span className="kanban-count">{col.items.length}</span>
              </p>
              {col.items.length === 0 ? (
                <Txt id="roadmap.kanban_empty" as="p" className="kanban-empty" />
              ) : (
                col.items.map((r) => (
                  <article className="kanban-card" key={r.id}>
                    <Txt
                      id={`roadmap.item_${r.id}_name`}
                      as="h3"
                      className="kanban-name"
                    />
                    <Txt
                      id={`roadmap.item_${r.id}_note`}
                      as="p"
                      className="kanban-note"
                    />
                    {r.productPath || r.link ? (
                      <p className="kanban-links">
                        {r.productPath ? (
                          <Link prefetch="viewport" to={r.productPath}>
                            <Txt id="roadmap.kanban_product_link" />
                          </Link>
                        ) : null}
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noopener noreferrer">
                            <Txt id="roadmap.kanban_source_link" />
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s3_title" as="h2" className="editorial-section-title" />
        <dl className="status-legend">
          {STATUS_ORDER.map((status) => (
            <div key={status}>
              <dt data-status={status}>
                <span className="kanban-dot" />
                <Txt id={`roadmap.status_${status}_label`} />
              </dt>
              <Txt id={`roadmap.status_${status}_legend`} as="dd" />
            </div>
          ))}
        </dl>
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s4_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s4_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s5_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s5_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s6_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s6_body" as="p" />
      </section>

      <section className="editorial-section">
        <Txt id="roadmap.s7_title" as="h2" className="editorial-section-title" />
        <Txt id="roadmap.s7_body" as="p" />
      </section>

      <section className="editorial-cta">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-primary"
        >
          <Txt id="roadmap.cta_primary" />
        </a>
        <a
          href="https://github.com/OpenDrone-hw"
          target="_blank"
          rel="noopener noreferrer"
          className="editorial-cta-secondary"
        >
          <Txt id="roadmap.cta_secondary" />
        </a>
      </section>
    </EditorialShell>
  );
}
