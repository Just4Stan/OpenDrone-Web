/**
 * The studio's write path. Dev only, by construction rather than by promise.
 *
 * Three facts about this repo shape everything below.
 *
 * 1. In dev, `@shopify/mini-oxygen` registers a `configureServer` hook with
 *    `order: 'pre'` that forwards EVERY request into a Workerd sandbox. Workerd
 *    has no filesystem and Oxygen sets no `nodejs_compat` flag, so a write
 *    handled anywhere downstream of that proxy cannot touch disk. This plugin
 *    therefore also registers `order: 'pre'` and is listed BEFORE `oxygen()` in
 *    vite.config.ts, and it never calls `next()` for a path it owns. It runs in
 *    the real Node process, which is the only place `node:fs` exists.
 *
 * 2. `apply: 'serve'` means the plugin is not part of `vite build` at all. There
 *    is no production code path to disable, because there is no production code.
 *
 * 3. The site itself never imports this file. It lives outside `app/`, so it
 *    cannot be pulled into the client or worker bundle by an accidental import.
 *
 * Everything it writes is inside `content/` and is committed to git, so every
 * edit Stan makes in the studio shows up in `git diff` and can be reverted with
 * `git checkout`. That is the undo button, and it is the reason the write
 * surface is deliberately narrow.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type {Plugin, ViteDevServer} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';

/** URL prefix the studio talks to. Underscored so it cannot collide with a route. */
const API = '/__studio';

/**
 * The only directory the studio may write into, relative to the repo root.
 *
 * A path allowlist is the whole security model here. The endpoint is bound to
 * localhost in dev, but "it is only dev" is not a reason to accept a traversal
 * bug: this process runs with Stan's permissions on his own machine, and a
 * malicious page in his browser can POST to localhost. Every write resolves the
 * target and confirms it is still inside this directory afterwards.
 */
const WRITE_ROOT = 'content';

/** Reject anything that is not a plain .json file under WRITE_ROOT. */
function resolveWritePath(repoRoot: string, rel: string): string | null {
  if (typeof rel !== 'string' || !rel) return null;
  // Reject absolute paths, NUL bytes and Windows drive letters before resolving.
  if (rel.includes('\0') || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    return null;
  }
  if (!rel.endsWith('.json')) return null;
  const root = path.resolve(repoRoot, WRITE_ROOT);
  const abs = path.resolve(root, rel);
  // The containment check has to happen AFTER resolution, because that is what
  // collapses `..` segments. Compare against root + separator so a sibling
  // directory named `contentX` cannot pass as `content`.
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

async function readBody(req: IncomingMessage, limitBytes = 2_000_000) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // Bound the body so a runaway client cannot exhaust memory.
    if (size > limitBytes) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // The studio is same-origin with the dev server. No CORS headers on purpose:
  // another origin should not be able to read the response.
  res.setHeader('cache-control', 'no-store');
  res.end(json);
}

/**
 * Write a file the way an editor should: serialise, write to a temp file in the
 * same directory, then rename over the target. Rename is atomic on the same
 * filesystem, so a crash mid-write leaves the old file intact rather than a
 * half-written one. Content files are the source of truth for the site, so a
 * truncated write would take pages down until git restored them.
 */
async function writeAtomic(abs: string, text: string) {
  await fs.mkdir(path.dirname(abs), {recursive: true});
  const tmp = `${abs}.studio-tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, abs);
}

export function studioPlugin(): Plugin {
  let repoRoot = process.cwd();

  return {
    name: 'opendrone-studio',
    apply: 'serve',
    configResolved(config) {
      repoRoot = config.root;
    },
    configureServer: {
      // `pre` puts this ahead of Oxygen's own `pre` proxy, but only because the
      // plugin is also listed before `oxygen()` in the plugins array: Vite keeps
      // registration order within the same `order` bucket. Both halves matter.
      order: 'pre',
      handler(server: ViteDevServer) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '';
          if (!url.startsWith(`${API}/`)) return next();

          // Same-origin only. A request with no Origin header is a direct
          // fetch (curl, the studio's own same-origin XHR in some browsers);
          // one with a foreign Origin is another site probing localhost.
          const origin = req.headers.origin;
          if (origin) {
            let ok = false;
            try {
              const h = new URL(origin).hostname;
              ok = h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
            } catch {
              ok = false;
            }
            if (!ok) return send(res, 403, {error: 'cross-origin write refused'});
          }

          void handle(req, res, url, repoRoot, server);
          return undefined;
        });
      },
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  repoRoot: string,
  server: ViteDevServer,
) {
  const route = url.split('?')[0].slice(API.length);

  try {
    if (route === '/read' && req.method === 'POST') {
      const {file} = JSON.parse(await readBody(req)) as {file?: string};
      const abs = resolveWritePath(repoRoot, file ?? '');
      if (!abs) return send(res, 400, {error: 'bad path'});
      try {
        const text = await fs.readFile(abs, 'utf8');
        return send(res, 200, {ok: true, data: JSON.parse(text)});
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return send(res, 404, {error: 'not found'});
        }
        throw err;
      }
    }

    if (route === '/write' && req.method === 'POST') {
      const {file, data} = JSON.parse(await readBody(req)) as {
        file?: string;
        data?: unknown;
      };
      const abs = resolveWritePath(repoRoot, file ?? '');
      if (!abs) return send(res, 400, {error: 'bad path'});
      if (data === undefined) return send(res, 400, {error: 'no data'});

      // Two trailing newline conventions in one repo is a diff-noise generator.
      // Match what Prettier writes for JSON: two-space indent, trailing newline.
      const text = `${JSON.stringify(data, null, 2)}\n`;
      await writeAtomic(abs, text);

      // Vite watches `content/`, so the importing module invalidates and the
      // page hot-reloads on its own. This is belt and braces for editors whose
      // atomic-rename shape the watcher misses.
      const mod = server.moduleGraph.getModulesByFile(abs);
      if (mod) for (const m of mod) server.moduleGraph.invalidateModule(m);

      return send(res, 200, {ok: true, file: path.relative(repoRoot, abs)});
    }

    if (route === '/list' && req.method === 'GET') {
      const root = path.resolve(repoRoot, WRITE_ROOT);
      const out: string[] = [];
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, {withFileTypes: true});
        for (const e of entries) {
          const abs = path.join(dir, e.name);
          if (e.isDirectory()) await walk(abs);
          else if (e.name.endsWith('.json')) {
            out.push(path.relative(root, abs));
          }
        }
      };
      await walk(root);
      out.sort();
      return send(res, 200, {ok: true, files: out});
    }

    return send(res, 404, {error: 'no such studio endpoint'});
  } catch (err) {
    // Surface the real reason in dev. This endpoint never runs in production,
    // so there is no information-disclosure trade to make here.
    return send(res, 500, {error: String((err as Error)?.message ?? err)});
  }
}
