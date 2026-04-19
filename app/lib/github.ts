/**
 * Fetches the latest commit on a public GitHub repo so a PDP can show
 * "last pushed X ago — commit title — by Y" inline. No auth — the
 * unauthenticated API is capped at 60 req / hour per IP, so we rely
 * on Oxygen's edge cache (cf.cacheTtl) to keep the origin calls low.
 */

export type LatestCommit = {
  sha: string;
  shortSha: string;
  message: string;          // first line of the commit message
  author: string;
  date: string;             // ISO
  url: string;              // html_url of the commit
  repoUrl: string;          // original https://github.com/... input
  repoLabel: string;        // just the repo name, for display
};

export function parseRepoUrl(
  repoUrl: string,
): {owner: string; repo: string} | null {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) return null;
  return {owner: m[1], repo: m[2].replace(/\.git$/, '')};
}

export async function fetchLatestCommit(
  repoUrl: string,
): Promise<LatestCommit | null> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return null;
  try {
    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'opendrone-web',
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(4000),
      // Cloudflare / Oxygen edge-cache hint — keep GitHub origin hits
      // to roughly once every 5 minutes per PoP. Safe cast because
      // the RequestInit type doesn't know about `cf`.
      ...({cf: {cacheTtl: 300, cacheEverything: true}} as RequestInit),
    });
    if (!res.ok) {
      console.warn('[github]', parsed.owner + '/' + parsed.repo, res.status);
      return null;
    }
    const data = (await res.json()) as Array<{
      sha: string;
      html_url: string;
      commit: {
        message: string;
        author: {name: string; date: string};
      };
      author?: {login: string} | null;
    }>;
    if (!Array.isArray(data) || !data.length) return null;
    const c = data[0];
    return {
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: (c.commit?.message ?? '').split('\n')[0],
      author: c.commit?.author?.name ?? c.author?.login ?? 'unknown',
      date: c.commit?.author?.date ?? '',
      url: c.html_url,
      repoUrl,
      repoLabel: parsed.repo,
    };
  } catch (err) {
    console.warn('[github] fetch failed', repoUrl, err);
    return null;
  }
}

export async function fetchLatestCommits(
  repoUrls: string[],
): Promise<LatestCommit[]> {
  const unique = Array.from(new Set(repoUrls));
  const results = await Promise.all(unique.map(fetchLatestCommit));
  return results.filter((c): c is LatestCommit => c !== null);
}
