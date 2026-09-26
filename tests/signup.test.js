import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSignup } from '../src/validation.js';
import { onRequest } from '../functions/api/signup.js';

const valid = { steamNick: 'Test Challenger', steamLink: 'https://steamcommunity.com/id/test_player', mmr: 5000 };
test('accepts both Steam formats and range boundaries', () => {
  for (const mmr of [0, 20000]) for (const steamLink of [valid.steamLink, 'https://steamcommunity.com/profiles/76561198000000000/']) assert.ok(validateSignup({ ...valid, mmr, steamLink }).value);
});
test('rejects spoofed URLs, credentials, unexpected paths and malformed input', () => {
  for (const steamLink of ['http://steamcommunity.com/id/test', 'https://steamcommunity.com.evil.com/id/test', 'https://evil.com/steamcommunity.com/id/test', 'https://user@steamcommunity.com/id/test', 'https://steamcommunity.com:444/id/test', 'https://steamcommunity.com/id/test?x=1', 'https://steamcommunity.com/id/test#x', 'https://steamcommunity.com/profiles/123', 'https://steamcommunity.com/id/test/extra']) assert.ok(validateSignup({ ...valid, steamLink }).error, steamLink);
  for (const mmr of [-1, 20001, 1.2, '5000', null]) assert.ok(validateSignup({ ...valid, mmr }).error);
  for (const steamNick of ['', ' ', 'x'.repeat(65), '\u0000test', null]) assert.ok(validateSignup({ ...valid, steamNick }).error);
  for (const data of [null, [], 'hello']) assert.ok(validateSignup(data).error);
});
const request = (body = valid, options = {}) => new Request('https://example.com/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com', 'CF-Connecting-IP': '192.0.2.1', ...options.headers }, body: JSON.stringify(body), ...options });
test('method, content type, origin, malformed JSON, size and honeypot protections', async () => {
  for (const [req, status] of [
    [new Request('https://example.com/api/signup'), 405],
    [request(valid, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request(valid, { headers: { Origin: 'https://evil.com', 'Content-Type': 'application/json' } }), 403],
    [request(valid, { body: '{' }), 400],
    [request({ ...valid, steamNick: 'x'.repeat(5000) }), 413],
    [request({ ...valid, website: 'spam' }), 400],
    [request({ ...valid, mmr: 30000 }), 400],
  ]) assert.equal((await onRequest({ request: req, env: {} })).status, status);
});
test('fails closed if storage configuration is missing', async () => {
  const response = await onRequest({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});
test('only reports success after a parameterized database write; enforces rate limit', async () => {
  let writes = 0;
  let hits = 0;
  const DB = {
    prepare(sql) { return { bind(...args) { return { sql, args, async first() { return { hits: ++hits, expires_at: Math.floor(Date.now() / 1000) + 3600 }; } }; } }; },
    async batch(statements) { assert.match(statements[0].sql, /VALUES \(\?, \?, \?\)/); assert.deepEqual(statements[0].args, [valid.steamNick, valid.steamLink, valid.mmr]); writes++; },
  };
  for (let i = 0; i < 5; i++) {
    const response = await onRequest({ request: request(), env: { DB, IP_HASH_SALT: 'test-secret' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
  }
  const blocked = await onRequest({ request: request(), env: { DB, IP_HASH_SALT: 'test-secret' } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  assert.equal(writes, 5);
});
test('database failures do not expose internal errors or fake success', async () => {
  const response = await onRequest({ request: request(), env: { IP_HASH_SALT: 'test', DB: { prepare() { throw new Error('private database details'); } } } });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database details/);
});
