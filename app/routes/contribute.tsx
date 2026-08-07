import type {Route} from './+types/contribute';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {PRODUCT_CONTENT} from '~/lib/product-content';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Contribute · Help design open drone hardware',
    description:
      'Every OpenDrone board is designed in public. How to report a bug, send a design change, or help bring up the next product.',
  });

export async function loader(_args: Route.LoaderArgs) {
  return {};
}

/** The boards people can actually contribute to, straight from the
 *  editorial registry: no invented projects. */
function repoRows(): Array<{name: string; url: string}> {
  const rows: Array<{name: string; url: string}> = [];
  const seen = new Set<string>();
  for (const [handle, content] of Object.entries(PRODUCT_CONTENT)) {
    const urls = [
      content.repoUrl,
      ...Object.values(content.variants ?? {}).map((v) => v.repoUrl),
    ];
    for (const url of urls) {
      if (!url || seen.has(url) || !url.includes('github.com/incutec-hw/'))
        continue;
      seen.add(url);
      rows.push({name: url.split('/').pop() ?? handle, url});
    }
  }
  return rows;
}

export default function ContributeRoute() {
  const repos = repoRows();
  return (
    <div className="editorial-page">
      <header className="editorial-hero">
        <p className="editorial-eyebrow">Contribute · CERN-OHL-S-2.0</p>
        <h1 className="editorial-title">
          You don&apos;t need permission. <em>You need a GitHub account.</em>
        </h1>
        <p className="editorial-lead">
          Every board here is designed in public: schematic, layout, BOM and
          production files, all in the open from the first commit. Contributions
          are not a nice-to-have, they are how the boards got good. The FC
          connector on every OpenESC exists because someone sent a PR.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Report what broke</h2>
        <p>
          Flew it, bench-tested it, or just read the schematic and found
          something off: open an issue on the board&apos;s repo. A photo, a log
          file, or a net name is enough. Confirmed design problems get fixed in
          the next revision and credited on the product page, receipts linked.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · Change the design</h2>
        <p>
          The hardware is KiCad, latest stable release. Fork the repo, make the
          change, open a PR: same flow as software. Small, focused changes merge
          fastest: one connector, one footprint, one silkscreen fix. Merged
          design changes show up in the &ldquo;You asked. We changed it.&rdquo;
          chapter of the product page, and your account lands in its
          contributor grid.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Improve the firmware</h2>
        <p>
          The boards run community firmware: Betaflight, AM32 and ExpressLRS.
          Work there helps every board, not just ours; €1 of every board sold
          already goes to these projects. Start with the{' '}
          <Link to="/firmware-partners">firmware partners</Link> page if you
          want the details.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">04 · Shape what comes next</h2>
        <p>
          Products marked <strong>Concept</strong> in the shop are published
          before hardware exists, precisely so the design discussion can happen
          in public. Open an issue with a use case, a schematic sketch, or a
          part suggestion: that is the whole point of posting them early.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · The repos</h2>
        <ul className="editorial-list">
          {repos.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.name} ↗
              </a>
            </li>
          ))}
          <li>
            <a
              href="https://github.com/incutec-hw"
              target="_blank"
              rel="noopener noreferrer"
            >
              Everything else on the org ↗
            </a>
          </li>
        </ul>
        <p>
          Hardware is CERN-OHL-S v2: strong reciprocal, share your changes.
          By opening a PR you license your contribution under the repo&apos;s
          license. No CLA, no paperwork.
        </p>
      </section>
    </div>
  );
}
