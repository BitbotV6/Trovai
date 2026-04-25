// Trovai · get-curacao-listings.mjs
// Haalt ECHTE listings op van athomecuracao.com (At Home Curacao - Patricia Zegwaard)
// URLs gaan naar trovai.nl/listing/cur-[id] zodat de koper op ons domein blijft
// Minimumprijs: 400.000 euro - afspraak met Patricia Zegwaard
//
// Strategie:
//   1. Parse HTML van /kopen/ en /kopen/koopappartement/ overzichtspagina's
//      (daar staan alle listing-cards met prijs, beds, baths, image, url)
//   2. EUR-prijs uit "vaste prijs in: €" override gebruiken indien aanwezig,
//      anders USD->EUR converteren met DAILY_USD_EUR rate
//   3. Filter op prijs en property_type
//
// Geen externe deps - regex parsing is hier voldoende en robuust.

const ATHOME = 'https://athomecuracao.com';
const MIN_PRICE_EUR = 400000;

// Static USD->EUR (kan later via env var of live API)
// Per april 2026 rond 0.92 EUR per USD - update via env var DAILY_USD_EUR
const DEFAULT_USD_EUR = 0.92;

// Mapping van quiz property_type naar Curacao categorie-paden
// Quiz opties: villa, apartment, invest, bungalow (uit qs-cur-1 in index.html)
const TYPE_PATHS = {
  villa:     ['/kopen/koopwoning/'],
  apartment: ['/kopen/koopappartement/'],
  invest:    ['/kopen/koopwoning/', '/kopen/koopappartement/', '/vastgoed-investeringen/'],
  bungalow:  ['/kopen/koopwoning/'],
  estate:    ['/kopen/koopwoning/'],
  newbuild:  ['/kopen/nieuwbouw/'],
  open:      ['/kopen/koopwoning/', '/kopen/koopappartement/']
};

// Optionele wijk-filter (niet actief in huidige quiz, maar voorbereid voor uitbreiding)
const AREA_MAP = {
  // luxury beach areas zuid-oost kant
  janthiel:    ['Jan Thiel', 'Brakkeput', 'Boca Gentil', 'Caracasbaaiweg', 'Spaanse Water'],
  // resort/villaparks
  villaparks:  ['Vista Royal', 'Coral Estate', 'Blue Bay', 'Jan Sofat', 'Vredenberg', 'La Privada'],
  // willemstad omgeving (centraal)
  willemstad:  ['Mahaai', 'Pietermaai', 'Punda', 'Otrobanda', 'Scharloo', 'Salina'],
  // westpunt regio (rustig, natuur)
  westpunt:    ['Westpunt', 'Banda Abou', 'Coral Estate', 'Cas Abou', 'Santa Catharina', 'Christoffel']
};

function parseBudget(str) {
  if (!str) return { min: MIN_PRICE_EUR, max: 99000000 };
  const clean = String(str).replace(/[€.\s+±~]/g, '').replace(',', '');
  const num = parseInt(clean) || 0;
  const isPlus = String(str).includes('+');
  return {
    min: Math.max(MIN_PRICE_EUR, Math.floor(num * 0.6)),
    max: isPlus ? 99000000 : Math.ceil(num * 1.4)
  };
}

function decode(s) {
  if (!s) return '';
  return s
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .trim();
}

// Parse prijs uit raw block. Retourneert {price_eur, price_usd, currency_source}
function parsePrices(block, usdEurRate) {
  // EUR override - "vaste prijs in: € 695,000" of "€ 695.000"
  const eurMatch = block.match(/vaste\s*prijs\s*in:\s*€\s*([\d.,]+)/i)
              || block.match(/€\s*([\d.,]+)(?!\s*\.--)/);
  if (eurMatch) {
    const num = parseInt(eurMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { price_eur: num, price_usd: 0, source: 'EUR' };
  }

  // USD: "USD 1.047.835.--" of "USD 813.681" of "$ 450,000"
  const usdMatch = block.match(/USD\s*([\d.,]+)/i)
              || block.match(/US\$\s*([\d.,]+)/i)
              || block.match(/\$\s*([\d.,]+)/);
  if (usdMatch) {
    const num = parseInt(usdMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) {
      return { price_eur: Math.round(num * usdEurRate), price_usd: num, source: 'USD' };
    }
  }

  return { price_eur: 0, price_usd: 0, source: 'none' };
}

// Parse listing cards uit HTML. Elke card heeft een H2 met titel+url, een prijsblok ervoor of erin,
// en optioneel beds/baths/sqft en image.
function parseListings(html, usdEurRate) {
  const listings = [];

  // Split op de individuele property cards. Cards beginnen met "Nieuw " of "Onder bod " of "Exclusief "
  // gevolgd door image link, dan H2 met titel+url. We pakken vanaf elke H2.
  // H2 regex: ## [Titel](URL "Titel")  (markdown rendering van de site)
  // In rauwe HTML zou het <h2><a href="URL">Titel</a></h2> zijn - we werken met markdown renderering
  
  const cardRegex = /##\s*\[([^\]]+)\]\(([^)]+)\s*"[^"]*"\)\s*\n([\s\S]*?)(?=\n##\s*\[|$)/g;
  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    const title = decode(m[1]);
    const url = m[2].trim();
    const block = m[3];

    if (!url.includes('athomecuracao.com')) continue;
    
    // Object ID — strip "-nl" suffix eerst, dan alles wat geen cijfer is
    const idMatch = block.match(/Object\s*ID\s*([\d-]+(?:-nl)?)/i)
                 || url.match(/-(\d+)-nl\/?$/)
                 || url.match(/\/(\d+)\/?$/);
    const id = idMatch ? String(idMatch[1]).replace(/-?nl$/i, '').replace(/[^\d]/g, '') : '';
    if (!id) continue;

    // Prijzen
    const prices = parsePrices(block, usdEurRate);

    // Beds, Baths, sqft
    const bedsMatch = block.match(/Beds\s*(\d+)/i);
    const bathsMatch = block.match(/Baths\s*(\d+)/i);
    const sqftMatch = block.match(/(\d+)\s*sq\s*ft/i);

    const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
    const baths = bathsMatch ? parseInt(bathsMatch[1]) : 0;
    const sqft = sqftMatch ? parseInt(sqftMatch[1]) : 0;
    const sqm = sqft ? Math.round(sqft * 0.0929) : 0;

    // Korte beschrijving - eerste tekstparagraaf na de specs
    const descMatch = block.match(/(?:sq ft|Baths\s*\d+)\s*\n+([\s\S]*?)\[…\s*more\]/i);
    let description = descMatch ? decode(descMatch[1].replace(/\n+/g, ' ').trim()) : '';
    if (description.length > 200) description = description.substring(0, 197) + '...';

    // Categorie raden uit URL
    let category = 'Woning';
    if (url.includes('koopappartement')) category = 'Appartement';
    else if (url.includes('kavels') || url.includes('bouwkavel')) category = 'Kavel';
    else if (url.includes('nieuwbouw')) category = 'Nieuwbouw';
    else if (title.toLowerCase().includes('villa')) category = 'Villa';
    else if (title.toLowerCase().includes('penthouse')) category = 'Penthouse';
    else if (title.toLowerCase().includes('appartement')) category = 'Appartement';

    // Wijk raden uit titel
    let area = '';
    const allAreas = Object.values(AREA_MAP).flat();
    for (const a of allAreas) {
      if (title.includes(a)) { area = a; break; }
    }

    listings.push({
      id: 'cur-' + id,
      raw_id: id,
      name: title,
      city: area || 'Curaçao',
      category,
      price: prices.price_eur,
      price_usd: prices.price_usd,
      price_source: prices.source,
      price_formatted: prices.price_eur > 0
        ? '€ ' + prices.price_eur.toLocaleString('nl-NL')
        : 'Prijs op aanvraag',
      beds: beds ? `${beds} slaapkamers` : '',
      baths: baths ? `${baths} badkamers` : '',
      surface: sqm ? `${sqm} m²` : '',
      image: '', // images worden lazy-loaded op de overzichtspagina als data-URI placeholder
                 // detail page haalt echte images op via get-curacao-listing
      url: `https://trovai.nl/listing/cur-${id}`,
      source_url: url,
      description
    });
  }

  return listings;
}

async function fetchPage(path) {
  const res = await fetch(`${ATHOME}${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Trovai/1.0; +https://trovai.nl)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'nl-NL,nl;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`At Home Curacao ${path} ${res.status}`);
  return await res.text();
}

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=900' // 15 min cache
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const { property_type, budget, area } = await req.json();
    const usdEurRate = parseFloat(process.env.DAILY_USD_EUR) || DEFAULT_USD_EUR;

    const { min: minPrice, max: maxPrice } = parseBudget(budget);
    const paths = TYPE_PATHS[property_type] || TYPE_PATHS.open;

    // Fetch alle relevante categorie-pagina's parallel
    const htmls = await Promise.all(paths.map(p => fetchPage(p).catch(e => {
      console.error(`Curacao fetch ${p} failed:`, e.message);
      return '';
    })));

    // Parse en dedupe op ID
    const seen = new Set();
    let all = [];
    for (const html of htmls) {
      if (!html) continue;
      const items = parseListings(html, usdEurRate);
      for (const it of items) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          all.push(it);
        }
      }
    }

    const totalUnfiltered = all.length;

    // Filter: alleen met geldige EUR prijs binnen budget en boven minimum
    let filtered = all.filter(p =>
      p.price >= Math.max(MIN_PRICE_EUR, minPrice) && p.price <= maxPrice
    );

    // Fallback als budget te smal: verbreed naar minPrice = MIN_PRICE_EUR + 1.6x maxPrice
    if (filtered.length < 3) {
      filtered = all.filter(p =>
        p.price >= MIN_PRICE_EUR && p.price <= Math.ceil(maxPrice * 1.6)
      );
    }

    // Optionele wijk-filter
    if (area && AREA_MAP[area] && filtered.length > 3) {
      const preferred = AREA_MAP[area];
      const byArea = filtered.filter(p =>
        preferred.some(a => p.name.includes(a) || p.city.includes(a))
      );
      if (byArea.length >= 2) filtered = byArea;
    }

    // Sorteer op prijs aflopend (hoogste eerst, past bij luxe positionering)
    filtered.sort((a, b) => b.price - a.price);

    const results = filtered.slice(0, 5);

    return new Response(JSON.stringify({
      listings: results,
      total: totalUnfiltered,
      source: 'athomecuracao.com',
      partner: 'At Home Curaçao',
      filters: {
        property_type: property_type || 'open',
        minPrice: Math.max(MIN_PRICE_EUR, minPrice),
        maxPrice,
        area: area || null,
        usd_eur_rate: usdEurRate
      }
    }), { status: 200, headers });

  } catch (err) {
    console.error('get-curacao-listings error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: 'Curaçao listings tijdelijk niet beschikbaar',
      detail: err.message,
      listings: [],
      total: 0
    }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-curacao-listings' };
