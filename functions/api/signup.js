import { validateSignup } from '../../src/validation.js';
import { errors } from '../../src/content/errors.js';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Error('large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function onRequest({ request, env }) {
  const language = /^en(?:\b|-)/i.test(request.headers.get('Accept-Language') || '') ? 'en' : 'sr';
  const fail = (errorCode, status, headers = {}) => json({ success: false, errorCode, error: errors[language][errorCode] }, status, { 'Content-Language': language, Vary: 'Accept-Language', ...headers });
  if (request.method !== 'POST') return fail('method', 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return fail('origin', 403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('contentType', 415);
  let data;
  try { data = await readBody(request); } catch (error) { return fail(error.message === 'large' ? 'large' : 'invalidBody', error.message === 'large' ? 413 : 400); }
  if (data?.website) return fail('rejected', 400);
  const checked = validateSignup(data);
  if (checked.error) return fail(checked.errorCode, 400);
  if (!env.DB || !env.IP_HASH_SALT) return fail('unavailable', 503);
  try {
    const now = Math.floor(Date.now() / 1000);
    const ip = request.headers.get('CF-Connecting-IP') || 'local-development';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.IP_HASH_SALT}:${Math.floor(now / 86400)}:${ip}`));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    // Atomic D1 UPSERT: concurrent requests cannot bypass the five-per-hour cap.
    const rate = await env.DB.prepare(`INSERT INTO signup_limits (key, hits, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
      hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END
      RETURNING hits, expires_at`).bind(key, now + 3600, now, now, now + 3600).first();
    if (rate.hits > 5) return fail('rateLimit', 429, { 'Retry-After': String(Math.max(1, rate.expires_at - now)) });
    const { steamNick, steamLink, mmr } = checked.value;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO challengers (steam_nick, steam_link, mmr) VALUES (?, ?, ?)').bind(steamNick, steamLink, mmr),
      env.DB.prepare('DELETE FROM signup_limits WHERE expires_at <= ?').bind(now),
    ]);
    return json({ success: true });
  } catch {
    return fail('unavailable', 503);
  }
}
