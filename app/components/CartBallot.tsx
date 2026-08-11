import {useMemo} from 'react';
import {CartForm, type OptimisticCart} from '@shopify/hydrogen';
import {Link, useFetcher} from 'react-router';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';
import {voteCandidates} from '~/lib/roadmap-data';
import {
  VOTE_ATTR_KEY,
  VOTE_MAX_CHOICES,
  parseVoteRank,
  serializeVoteRank,
} from '~/lib/votes';

/**
 * The ranked ballot: vote with your order on what gets built next.
 *
 * A vote is one cart attribute (`_vote_rank`), which Shopify copies onto the
 * order at checkout; `scripts/tally-votes.mjs` later reads it back off the
 * orders. Ranking is tap-to-rank: first tap is your first choice, second tap
 * your second, a tap on a ranked card removes it and everything below moves
 * up. No drag and drop, it has to work in the aside on a phone.
 *
 * `cartAttributesUpdate` REPLACES the cart's attribute list, so every submit
 * re-sends the attributes already on the cart (the attribution keys) with the
 * vote merged in. Submitting only the vote would wipe attribution, and
 * vice versa.
 */
export function CartBallot({
  cart,
  layout,
}: {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
}) {
  const fetcher = useFetcher();
  const candidates = useMemo(() => voteCandidates(), []);
  const candidateIds = useMemo(() => candidates.map((c) => c.id), [candidates]);

  const attributes = useMemo(
    () =>
      (cart?.attributes ?? []).filter(
        (a): a is {key: string; value: string} =>
          typeof a?.key === 'string' && typeof a?.value === 'string',
      ),
    [cart?.attributes],
  );

  // Optimistic: while a submit is in flight, show the ranking it carries.
  const pending = fetcher.formData?.get(CartForm.INPUT_NAME);
  const ranked = useMemo(() => {
    if (typeof pending === 'string') {
      try {
        const parsed = JSON.parse(pending) as {
          inputs?: {attributes?: Array<{key: string; value: string}>};
        };
        const vote = parsed.inputs?.attributes?.find(
          (a) => a.key === VOTE_ATTR_KEY,
        );
        return parseVoteRank(vote?.value ?? '', candidateIds);
      } catch {
        // fall through to the saved value
      }
    }
    const saved = attributes.find((a) => a.key === VOTE_ATTR_KEY);
    return parseVoteRank(saved?.value, candidateIds);
  }, [pending, attributes, candidateIds]);

  if (candidates.length === 0) return null;

  const submitRank = (ids: string[]) => {
    const others = attributes.filter((a) => a.key !== VOTE_ATTR_KEY);
    const next = ids.length
      ? [...others, {key: VOTE_ATTR_KEY, value: serializeVoteRank(ids)}]
      : others;
    void fetcher.submit(
      {
        [CartForm.INPUT_NAME]: JSON.stringify({
          action: CartForm.ACTIONS.AttributesUpdateInput,
          inputs: {attributes: next},
        }),
      },
      {method: 'post', action: '/cart'},
    );
  };

  const toggle = (id: string) => {
    if (ranked.includes(id)) {
      submitRank(ranked.filter((r) => r !== id));
    } else if (ranked.length < VOTE_MAX_CHOICES) {
      submitRank([...ranked, id]);
    }
  };

  const full = ranked.length >= VOTE_MAX_CHOICES;

  return (
    <section
      className={`cart-ballot cart-ballot-${layout}`}
      aria-label={copyText('cart.ballot_title') ?? 'Vote on what we build next'}
    >
      <Txt id="cart.ballot_title" as="h3" className="cart-ballot-title" />
      <Txt id="cart.ballot_hint" as="p" className="cart-ballot-hint" />
      <ul className="cart-ballot-list">
        {candidates.map((c) => {
          const rank = ranked.indexOf(c.id);
          const isRanked = rank >= 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`cart-ballot-chip${isRanked ? ' is-ranked' : ''}`}
                onClick={() => toggle(c.id)}
                disabled={!isRanked && full}
                aria-pressed={isRanked}
              >
                <span className="cart-ballot-rank" aria-hidden="true">
                  {isRanked ? rank + 1 : ''}
                </span>
                <Txt id={`roadmap.item_${c.id}_name`} fallback={c.id} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="cart-ballot-foot">
        {ranked.length ? (
          <Txt id="cart.ballot_saved" />
        ) : (
          <Txt id="cart.ballot_empty" />
        )}{' '}
        <Link prefetch="viewport" to="/roadmap">
          <Txt id="cart.ballot_results_link" />
        </Link>
      </p>
    </section>
  );
}
