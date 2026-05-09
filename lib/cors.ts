// Platform origins -- content scripts run on these pages
export const PLATFORM_ORIGINS = [
  'chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp',
  'https://chattersinnercircle.vercel.app',
  'https://cic-app.pages.dev',
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
  'https://agents.moderationinterface.com',
  'http://localhost:3000',
];

// Auth origins -- only extension and web apps
export const AUTH_ORIGINS = [
  'chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp',
  'https://chattersinnercircle.vercel.app',
  'https://cic-app.pages.dev',
  'http://localhost:3000',
];

export function corsHeaders(origin: string | null, allowed: string[] = AUTH_ORIGINS) {
  const o = origin && allowed.includes(origin) ? origin : allowed[1];
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
