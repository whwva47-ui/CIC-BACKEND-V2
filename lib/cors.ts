// Platform origins -- content scripts run on these pages
export const PLATFORM_ORIGINS = [
  // Chrome extension IDs - add all known IDs here
  'chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp', // Store version
  'chrome-extension://clgkfdabcblagkhmekadakeeoblamlpk', // Dev/unpacked version
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
  'https://www.chatterapply.com',
  'https://agents.moderationinterface.com',
  'http://localhost:3000',
];

// Auth origins -- extension and web app
export const AUTH_ORIGINS = [
  'chrome-extension://dkgpheiimhedhdfandcgeogmbfmmiobp',
  'chrome-extension://clgkfdabcblagkhmekadakeeoblamlpk',
  'https://chattersinnercircle.vercel.app',
  'http://localhost:3000',
];

export function corsHeaders(origin: string | null, allowed: string[] = AUTH_ORIGINS) {
  // Allow any chrome-extension:// origin so unpacked/dev extensions work
  if (origin && origin.startsWith('chrome-extension://')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Email, X-Session-Token, X-API-Key',
    };
  }
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
