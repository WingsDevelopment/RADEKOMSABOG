import { errors } from './content/errors.js';

const invalid = errorCode => ({ errorCode, error: errors.en[errorCode] });

export function validateSignup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('invalidBody');
  const { steamNick, steamLink, mmr } = data;
  if (typeof steamNick !== 'string' || !steamNick.trim() || steamNick.trim().length > 64 || /[\u0000-\u001f\u007f]/.test(steamNick)) return invalid('nick');
  if (typeof steamLink !== 'string' || steamLink.length > 256) return invalid('link');
  let url;
  try { url = new URL(steamLink.trim()); } catch { return invalid('link'); }
  if (url.protocol !== 'https:' || url.hostname !== 'steamcommunity.com' || url.port || url.username || url.password || !/^\/(id\/[A-Za-z0-9_-]{1,64}|profiles\/[0-9]{17})\/?$/.test(url.pathname) || url.search || url.hash) return invalid('link');
  if (!Number.isInteger(mmr) || mmr < 0 || mmr > 20000) return invalid('mmr');
  return { value: { steamNick: steamNick.trim(), steamLink: url.href, mmr } };
}
