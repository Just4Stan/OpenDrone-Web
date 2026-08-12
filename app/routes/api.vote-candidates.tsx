import type {Route} from './+types/api.vote-candidates';
import {
  fetchStatusFlags,
  resolveRoadmap,
  voteCandidates,
} from '~/lib/roadmap-data';

/**
 * The live ballot candidate list, for the cart.
 *
 * The ballot renders sitewide in the cart aside, so its candidates cannot come
 * from a page loader without taxing every page with the GitHub topics fetch.
 * Instead it server-renders from the static statuses and refines itself from
 * this route on mount. The fetch behind it is the same 1-hour-cached topics
 * call the roadmap page uses, so a project graduating out of
 * `planned`/`in-progress` (or a new planned repo appearing) updates the
 * ballot within the hour, with no code edit and no deploy.
 */
export async function loader({context}: Route.LoaderArgs) {
  const env = context.env as unknown as Record<string, string | undefined>;
  const flags = await fetchStatusFlags(env.GITHUB_STATUS_TOKEN);
  const candidates = voteCandidates(resolveRoadmap(flags)).map((r) => ({
    id: r.id,
    added: r.added ?? null,
  }));
  return Response.json(
    {candidates},
    // Shared cache hint for Oxygen's edge: the underlying data moves at most
    // once an hour anyway.
    {headers: {'Cache-Control': 'public, max-age=300'}},
  );
}
