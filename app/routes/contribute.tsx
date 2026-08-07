import type {Route} from './+types/contribute';
import {Link} from 'react-router';
import {buildSeoMeta} from '~/lib/seo';
import {PRODUCT_CONTENT} from '~/lib/product-content';
import {DISCORD_INVITE_URL} from '~/lib/company';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Contribute · Help design open drone hardware',
    description:
      'OpenDrone is designed by its community. How contribution works: talk on Discord, review on GitHub, one maintainer per board, credit on the product page.',
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
          You don&apos;t need permission. <em>You need a conversation.</em>
        </h1>
        <p className="editorial-lead">
          OpenDrone is a community project: every board is designed in public,
          from the first commit, and the direction belongs to whoever shows up.
          Contributions are not a nice-to-have, they are how the boards got
          good. The FC connector on every OpenESC exists because someone sent a
          PR.
        </p>
      </header>

      <section className="editorial-section">
        <h2 className="editorial-section-title">01 · Start on Discord</h2>
        <p>
          Ideas are discussed and agreed on{' '}
          <a href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer">
            the OpenDrone Discord
          </a>{' '}
          before anyone draws a design. That conversation is the point: it
          stops two people building the same thing, and it kills bad ideas
          before someone spends weeks on a layout. Proposals, board ownership,
          design reviews and contributor samples are all coordinated there.
          GitHub holds the record; Discord is where people agree who is doing
          what.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">02 · Report what broke</h2>
        <p>
          Flew it, bench-tested it, or just read the schematic and found
          something off: open an issue on the board&apos;s repo. A photo, a log
          file, or a net name is enough. Confirmed design problems get fixed in
          the next revision and credited on the product page, receipts linked.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">03 · Change the design</h2>
        <p>
          Hardware is not software: two people can edit the same code file, but
          a PCB layout cannot be merged. So each board has one maintainer who
          holds the layout, and edits are serialised through file locks.
          Schematics are split across hierarchical sheets, so separate sheets
          can have separate owners. Two people can hold two boards. Two people
          cannot hold one layout.
        </p>
        <p>
          Everyone else contributes through review, and review is where the
          real capacity is: CI renders the schematic, the board images, ERC and
          DRC output and a BOM diff on every pull request, so a design one
          person draws can be reviewed by anyone, without opening KiCad. Small,
          focused changes land fastest: one connector, one footprint, one
          silkscreen fix, agreed with the board&apos;s maintainer.
        </p>
        <p>
          Merged design changes show up in the &ldquo;You asked. We changed
          it.&rdquo; chapter of the product page, and your account lands in its
          contributor grid. Every product page names who developed the board,
          maintainer first, the way a record sleeve names the band. A handle
          and avatar are enough; nobody needs your real name.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">04 · Propose new hardware</h2>
        <p>
          Anyone can propose hardware OpenDrone does not have, including boards
          that compete with what is already in the shop. A proposal names an
          owner, who holds the design and carries it through review and
          measurement. Incutec reviews it, tests it and manufactures it if it
          is good, and that decision is argued on published measurements, not
          on preference. Contributors whose hardware is verified by the
          community receive manufactured samples of their own design.
        </p>
        <p>
          Products marked <strong>Concept</strong> in the shop are published
          before hardware exists, precisely so the design discussion can happen
          in public. Open an issue with a use case, a schematic sketch, or a
          part suggestion: that is the whole point of posting them early.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">05 · Improve the firmware</h2>
        <p>
          The boards run community firmware: Betaflight, AM32 and ExpressLRS.
          Work there helps every board, not just ours; €1 of every board sold
          already goes to these projects. Start with the{' '}
          <Link to="/firmware-partners">firmware partners</Link> page if you
          want the details.
        </p>
      </section>

      <section className="editorial-section">
        <h2 className="editorial-section-title">06 · The repos</h2>
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
          The hardware is KiCad, latest stable release. Everything is
          CERN-OHL-S v2: strong reciprocal, share your changes. By opening a PR
          you license your contribution under the repo&apos;s license. No CLA,
          no paperwork.
        </p>
      </section>
    </div>
  );
}
