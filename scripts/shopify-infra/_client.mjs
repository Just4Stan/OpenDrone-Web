/**
 * Minimal Shopify Admin GraphQL client for the one-off infra setup scripts
 * in this directory. Reads credentials from the repo .env (gitignored):
 *   PUBLIC_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_ADMIN_API_VERSION
 *
 * The token belongs to the custom app "OpenDrone Infra" (scopes:
 * read/write products, discounts, translations, files). These scripts are
 * idempotent where practical and safe to re-run. No secrets are hard-coded.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadEnv() {
  const env = {};
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) throw new Error('.env not found at repo root');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
export const SHOP = env.PUBLIC_STORE_DOMAIN;
const TOKEN = env.SHOPIFY_ADMIN_API_TOKEN;
export const VERSION = env.SHOPIFY_ADMIN_API_VERSION || '2026-01';

if (!SHOP) throw new Error('PUBLIC_STORE_DOMAIN missing in .env');
if (!TOKEN) throw new Error('SHOPIFY_ADMIN_API_TOKEN missing in .env');

const ENDPOINT = `https://${SHOP}/admin/api/${VERSION}/graphql.json`;

/** Run an Admin GraphQL query/mutation. Throws on transport or GraphQL errors. */
export async function admin(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (json.errors) {
    throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  }
  return json.data;
}

/** Throw if a *UserErrors array on a mutation payload is non-empty. */
export function assertNoUserErrors(label, payload) {
  const errs =
    payload?.userErrors || payload?.productUserErrors || payload?.userErrors;
  if (errs && errs.length) {
    throw new Error(`${label} userErrors: ${JSON.stringify(errs)}`);
  }
}
