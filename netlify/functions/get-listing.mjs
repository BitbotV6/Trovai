// Trovai · get-listing.mjs
// Proxy: haalt één woning op van LOCA API (omzeilt CORS)
const LOCA = 'https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products';

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });

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
