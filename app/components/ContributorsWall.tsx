import {useState} from 'react';
import type {Contributor} from '~/lib/github';
import {copyText} from '~/lib/copy';

/**
 * Everyone with commits across the OpenDrone repos, as a wall of coins in
 * the contributing page's right column. Deliberately playful: the coins
 * sit on a loose honeycomb (deterministic per-index offsets, no
 * randomness — SSR and client must agree), the biggest contributors lead
 * with their names and commit counts shown, and the tail collapses behind an "everyone"
 * toggle because this list is meant to get long.
 */
const LEAD_COUNT = 6;
const FOLD_COUNT = 18;

export function ContributorsWall({contributors}: {contributors: Contributor[]}) {
  const [open, setOpen] = useState(false);
  if (contributors.length === 0) return null;

  const lead = contributors.slice(0, LEAD_COUNT);
  const rest = contributors.slice(LEAD_COUNT, open ? undefined : FOLD_COUNT);
  const hidden = contributors.length - FOLD_COUNT;

  return (
    <figure className="contrib-wall">
      <figcaption className="contrib-wall-head">
        {contributors.length}{' '}
        {copyText('contributing.wall_count_label') ?? 'people so far'}
      </figcaption>

      {/* The leads: coin + name, the record-sleeve credit. */}
      <ul className="contrib-wall-leads">
        {lead.map((c) => (
          <li key={c.login}>
            <a href={c.htmlUrl} target="_blank" rel="noopener noreferrer">
              <img src={c.avatarUrl} alt="" loading="lazy" />
              <span className="contrib-wall-name">{c.login}</span>
              {/* Commit count is the credit, so it sits with the name rather
                  than hiding in a tooltip. Tabular figures keep the column
                  aligned when the counts differ in width. */}
              <span className="contrib-wall-count">{c.contributions}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* The crowd: coins on a loose honeycomb, names on hover. */}
      <ul className="contrib-wall-crowd">
        {rest.map((c, i) => (
          <li key={c.login} style={{'--i': i} as React.CSSProperties}>
            <a
              href={c.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`${c.login} · ${c.contributions} ${
                c.contributions === 1 ? 'commit' : 'commits'
              }`}
            >
              <img src={c.avatarUrl} alt={c.login} loading="lazy" />
            </a>
          </li>
        ))}
      </ul>

      {hidden > 0 && !open ? (
        <button
          type="button"
          className="contrib-wall-more"
          onClick={() => setOpen(true)}
        >
          +{hidden} {copyText('contributing.wall_more_label') ?? 'more'}
        </button>
      ) : null}
    </figure>
  );
}
