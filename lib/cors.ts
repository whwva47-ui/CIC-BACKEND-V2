export const PLATFORM_ORIGINS = [
  'https://chattersinnercircle.vercel.app',
  'https://chathomebase.com',
  'https://www.chathomebase.com',
  'https://alpha.date',
  'https://www.alpha.date',
  'https://onlyfans.com',
  'https://fansly.com',
  'https://loyalfans.com',
  'https://fancentro.com',
  'https://admireme.vip',
  'https://fanvue.com',
  'https://www.manyvids.com',
  'https://unlockd.com',
  'https://chatterapply.com',
  'http://localhost:3000',
];

export const AUTH_ORIGINS = [
  'https://chattersinnercircle.vercel.app',
  'http://localhost:3000',
];

export function corsHeaders(origin: string | null, allowed: string[] = AUTH_ORIGINS) {
  if (origin && origin.startsWith('chrome-extension://')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Session-Token, X-API-Key',
    };
  }
  const o = origin && (allowed.includes(origin) || PLATFORM_ORIGINS.includes(origin)) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Session-Token, X-API-Key',
  };
}

export const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
