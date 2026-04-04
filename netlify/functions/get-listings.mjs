// Trovai · get-listings.mjs
// Haalt ECHTE listings op van livingonthecotedazur.com
// URLs gaan naar trovai.nl/listing/[id] zodat de koper op ons domein blijft

const LOCA = 'https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products';

const CATEGORY_MAP = {
  villa: 'villa',
  apartment: 'apartment',
  estate: 'villa',
  open: null
};

const CITY_MAP = {
  nice:       ['Nice','Antibes','Villefranche-sur-Mer','Beaulieu-sur-Mer','Cagnes-sur-Mer'],
  cannes:     ['Cannes','Antibes','Juan-les-Pins','Mougins','Mandelieu'],
  monaco:     ['Monaco','Menton','Roquebrune-Cap-Martin','Cap-d-Ail','Beausoleil'],
  hinterland: ['Valbonne','Mougins','Grasse','Saint-Paul-de-Vence','Biot','Opio','Tourrettes']
};

function parseBudget(str) {
  if (!str) return { min: 0, max: 99000000 };
  const clean = str.replace(/[€.\s+±~]/g, '').replace(',', '');
  const num = parseInt(clean) || 0;
  const isPlus = str.includes('+');
  return {
    min: Math.floor(num * 0.6),
    max: isPlus ? 99000000 : Math.ceil(num * 1.4)
  };
}

function cleanName(name) {
  return name
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .trim();
}

function formatListing(p) {
  const price = parseInt(p.prices?.price || 0);
  const city = p.attributes?.find(a => a.name === 'City')?.terms?.[0]?.name || '';
  const beds = p.attributes?.find(a => a.name === 'Number of beds')?.terms?.[0]?.name || '';
  const surface = p.attributes?.find(a => a.name === 'Living area')?.terms?.[0]?.name || '';
  const category = p.categories?.[0]?.name || '';
  const image = p.images?.[0]?.src || '';
  const desc = p.short_description?.replace(/<[^>]+>/g, '').trim().substring(0, 180) || '';

  return {
    id: p.id,
    name: cleanName(p.name),
    city,
    category,
    price,
    price_formatted: price > 0 ? '€ ' + Math.round(price).toLocaleString('nl-NL') : 'Prijs op aanvraag',
    beds: beds ? `${beds} slaapkamers` : '',
    surface: surface ? `${surface} m²` : '',
    image,
    url: `https://trovai.nl/listing/${p.id}`,
    loca_url: p.permalink,
    description: desc
  };
}

async function fetchFromLOCA({ category, minPrice, maxPrice, limit = 9 }) {
  const params = new URLSearchParams({ per_page: limit, orderby: 'date', order: 'desc' });
  if (category) params.set('category', category);
  if (minPrice > 0) params.set('min_price', minPrice);
  if (maxPrice < 99000000) params.set('max_price', maxPrice);

  const res = await fetch(`${LOCA}?${params}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Trovai/1.0' }
  });
  if (!res.ok) throw new Error(`LOCA API ${res.status}`);
  const data = await res.json();
  const total = res.headers.get('X-WP-Total') || '?';
  return { listings: data, total };
}

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const { destination, property_type, budget, area } = await req.json();

    if (destination === 'curacao') {
      return new Response(JSON.stringify({
        listings: [], total: 0,
        message: 'Curaçao selectie volgt via At Home Curaçao — u ontvangt dit per email.'
      }), { status: 200, headers });
    }

    const category = CATEGORY_MAP[property_type] || null;
    const { min: minPrice, max: maxPrice } = parseBudget(budget);

    let { listings, total } = await fetchFromLOCA({ category, minPrice, maxPrice, limit: 12 });

    if (listings.length < 3) {
      const wider = await fetchFromLOCA({
        category,
        minPrice: Math.floor(minPrice * 0.4),
        maxPrice: Math.ceil(maxPrice * 1.6),
        limit: 12
      });
      listings = wider.listings;
      total = wider.total;
    }

    let filtered = listings;
    if (area && CITY_MAP[area] && listings.length > 3) {
      const preferred = CITY_MAP[area];
      const byCity = listings.filter(p => {
        const city = p.attributes?.find(a => a.name === 'City')?.terms?.[0]?.name || '';
        return preferred.some(c => city.toLowerCase().includes(c.toLowerCase()));
      });
      if (byCity.length >= 2) filtered = byCity;
    }

    const results = filtered.slice(0, 5).map(formatListing);

    return new Response(JSON.stringify({
      listings: results,
      total: parseInt(total) || results.length,
      source: 'livingonthecotedazur.com',
      filters: { category, minPrice, maxPrice, area }
    }), { status: 200, headers });

  } catch (err) {
    console.error('get-listings error:', err.message);
    return new Response(JSON.stringify({ error: 'Listings tijdelijk niet beschikbaar', listings: [], total: 0 }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-listings' };
