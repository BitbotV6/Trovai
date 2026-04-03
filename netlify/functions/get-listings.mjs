// Trovai · get-listings.mjs
// Haalt live listings op van livingonthecotedazur.com en matcht op kopersprofiel

const LOCA_BASE = 'https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products';

// Mapping van Trovai quiz-antwoorden naar LOCA categorieën/attributen
const CATEGORY_MAP = {
  villa:     'villa',
  apartment: 'apartment',
  estate:    'villa',       // domaine/estate → villa categorie
  open:      null           // geen filter
};

const CITY_MAP = {
  nice:        ['Nice', 'Antibes', 'Villefranche-sur-Mer', 'Beaulieu-sur-Mer'],
  cannes:      ['Cannes', 'Antibes', 'Juan-les-Pins', 'Mougins'],
  monaco:      ['Monaco', 'Menton', 'Roquebrune-Cap-Martin', 'Cap-d-Ail'],
  hinterland:  ['Valbonne', 'Mougins', 'Grasse', 'Saint-Paul-de-Vence', 'Biot', 'Opio']
};

// Budget string uit quiz → min/max in euro's
function parseBudget(budgetStr) {
  if (!budgetStr) return { min: 0, max: 99000000 };
  const clean = budgetStr.replace(/V€.\s]/g, '').replace(',', '');
  // Formats: "500000", "2000000", "10000000+"
  const isPlus = budgetStr.includes('+');
  const num = parseInt(clean.replace('+', '')) || 0;
  
  // Geef 40% marge boven en onder voor betere resultaten
  return {
    min: Math.floor(num * 0.6),
    max: isPlus ? 99000000 : Math.ceil(num * 1.4)
  };
}

async function fetchListings({ category, minPrice, maxPrice, limit = 6 }) {
  const params = new URLSearchParams({
    per_page: limit,
    orderby: 'date',
    order: 'desc'
  });

  if (category) params.set('category', category);
  if (minPrice > 0) params.set('min_price', minPrice);
  if (maxPrice < 99000000) params.set('max_price', maxPrice);

  const url = `${LOCA_BASE}?${params}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) throw new Error(`LOCA API error: ${res.status}`);
  const data = await res.json();
  const total = res.headers.get('X-WP-Total') || '?';

  return { listings: data, total };
}

function formatListing(p) {
  const price = parseInt(p.prices?.price || 0);
  const city = p.attributes?.find(a => a.name === 'City')?.terms?.[0]?.name || '';
  const beds = p.attributes?.find(a => a.name === 'Number of beds')?.terms?.[0]?.name || '';
  const surface = p.attributes?.find(a => a.name === 'Living area')?.terms?.[0]?.name || '';
  const category = p.categories?.[0]?.name || '';
  const image = p.images?.[0]?.src || '';
  
  // Opschonen van de naam (HTML entities)
  const name = p.name
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/France/g, '&')
    .trim();

  return {
    id: p.id,
    name,
    city,
    category,
    price,
    price_formatted: price > 0 ? '€ ' + Math.round(price).toLocaleString('nl-NL') : 'Prijs op aanvraag',
    beds: beds ? `${beds} slaapkamers` : '',
    surface: surface ? `${surface} m²` : '',
    image,
    url: p.permalink,
    description: p.short_description?.replace(/<[^>]+>/g, '').trim().substring(0, 150) || ''
  };
}

export default async (req) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const {
      destination,
      property_type,
      budget,
      area
    } = body;

    if (destination === 'curacao') {
      return new Response(JSON.stringify({
        listings: [],
        total: 0,
        message: 'Curaçao listings komen binnenkort beschikbaar.'
      }), { status: 200, headers });
    }

    const category = CATEGORY_MAP[property_type] || null;
    const { min: minPrice, max: maxPrice } = parseBudget(budget);

    let { listings, total } = await fetchListings({ category, minPrice, maxPrice, limit: 9 });

    if (listings.length < 3) {
      const wider = await fetchListings({
        category,
        minPrice: Math.floor(minPrice * 0.4),
        maxPrice: Math.ceil(maxPrice * 1.6),
        limit: 9
      });
      listings = wider.listings;
      total = wider.total;
    }

    let filtered = listings;
    if (area && CITY_MAP[area] && listings.length > 3) {
      const preferredCities = CITY_MAP[area];
      const cityFiltered = listings.filter(p => {
        const city = p.attributes?.find(a => a.name === 'City')?.terms?.[0]?.name || '';
        return preferredCities.some(c => city.toLowerCase().includes(c.toLowerCase()));
      });
      if (cityFiltered.length >= 2) filtered = cityFiltered;
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
    return new Response(JSON.stringify({ 
      error: 'Kon listings niet ophalen',
      listings: [],
      total: 0
    }), { status: 500, headers });
  }
};

export const config = {
  path: '/api/get-listings'
};
