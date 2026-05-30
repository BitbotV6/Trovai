// Trovai · get-listing.mjs
// Proxy: haalt één woning op van LOCA API (omzeilt CORS).
// Toegang beperkt tot trovai.nl (hotlink-/CORS-bescherming).
const LOCA = 'https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products';

function ownHost() {
  try { return new URL(process.env.URL || '').hostname.toLowerCase(); } catch (e) { return ''; }
}

// Alleen trovai.nl (en eigen Netlify-host + localhost) mag de endpoint aanroepen.
// Server-to-server calls hebben geen Origin/Referer en blijven toegestaan.
function isAllowed(req) {
  const origin = (req.headers.get('origin') || '').toLowerCase();
  const referer = (req.headers.get('referer') || '').toLowerCase();
  if (!origin && !referer) return true;
  const hay = origin + ' ' + referer;
  if (hay.includes('trovai.nl')) return true;
  if (hay.includes('localhost') || hay.includes('127.0.0.1')) return true;
  const own = ownHost();
  if (own && hay.includes(own)) return true;
  return false;
}

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = origin && isAllowed(req) ? origin : 'https://trovai.nl';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=900, s-maxage=3600',
    'Vary': 'Origin'
  };
}

export default async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (!isAllowed(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id || isNaN(id)) return new Response(JSON.stringify({ error: 'ID vereist' }), { status: 400, headers });

  try {
    const res = await fetch(`${LOCA}?include=${id}&per_page=1`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Trovai/1.0' }
    });
    if (!res.ok) throw new Error('LOCA API ' + res.status);
    const data = await res.json();
    if (!data || data.length === 0) return new Response(JSON.stringify({ error: 'Niet gevonden' }), { status: 404, headers });
    return new Response(JSON.stringify(data[0]), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-listing' };
