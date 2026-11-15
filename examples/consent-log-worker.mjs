// Example Cloudflare Worker for Meliora Consent's optional consent log (config: `logEndpoint: '/api/consent'`).
// Stores each choice in D1 as proof of consent: a random id, the policy version, time, method and choices.
// No IP address and no user agent are stored. Add rate limiting before using it on a busy site.
//
// wrangler.jsonc:  "d1_databases": [{"binding": "CONSENT_DB", "database_name": "consent-log", "database_id": "…"}]
// Create the table once:  npx wrangler d1 execute consent-log --remote --command "<SCHEMA below>"
export const SCHEMA = `CREATE TABLE IF NOT EXISTS consent_log (
  id TEXT NOT NULL, policy TEXT NOT NULL, ts TEXT NOT NULL, method TEXT NOT NULL,
  choices TEXT NOT NULL, gpc INTEGER NOT NULL, received TEXT NOT NULL DEFAULT (datetime('now'))
)`;

const METHODS = new Set(['accept-all', 'reject-all', 'custom', 'embed']);
const CATEGORIES = new Set(['functional', 'analytics', 'marketing']);

export async function handleConsentLog(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}});
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return new Response('Forbidden', {status: 403});
  if (Number(request.headers.get('content-length')) > 2048) return new Response('Too large', {status: 413});
  let data;
  try { data = await request.json(); } catch { return new Response('Bad request', {status: 400}); }
  const valid = data && typeof data === 'object'
    && typeof data.id === 'string' && /^[0-9a-f-]{36}$/i.test(data.id)
    && typeof data.policy === 'string' && data.policy.length <= 64
    && typeof data.ts === 'string' && !Number.isNaN(Date.parse(data.ts))
    && METHODS.has(data.method) && typeof data.gpc === 'boolean'
    && data.choices && typeof data.choices === 'object'
    && Object.entries(data.choices).every(([key, value]) => CATEGORIES.has(key) && typeof value === 'boolean');
  if (!valid) return new Response('Bad request', {status: 400});
  await env.CONSENT_DB.prepare('INSERT INTO consent_log (id, policy, ts, method, choices, gpc) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(data.id, data.policy, data.ts, data.method, JSON.stringify(data.choices), data.gpc ? 1 : 0)
    .run();
  return new Response(null, {status: 204});
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/consent') return handleConsentLog(request, env);
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status: 404});
  },
};
