// Trovai · get-curacao-listings.mjs
// Haalt ECHTE listings op van athomecuracao.com (At Home Curacao - Patricia Zegwaard)
// HTML parser - werkt direct met WP HTML output

const ATHOME = 'https://athomecuracao.com';
const MIN_PRICE_EUR = 400000;
const DEFAULT_USD_EUR = 0.92;

const TYPE_PATHS = {
  villa:     ['/kopen/koopwoning/'],
  apartment: ['/kopen/koopappartement/'],
  invest:    ['/kopen/koopwoning/', '/kopen/koopappartement/'],
  bungalow:  ['/kopen/koopwoning/'],
  estate:    ['/kopen/koopwoning/'],
  open:      ['/kopen/koopwoning/', '/kopen/koopappartement/']
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
  return String(s)
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function parsePrices(block, usdEurRate) {
  const eurMatch = block.match(/vaste\s*prijs\s*in[^€]*€\s*([\d.,]+)/i)
              || block.match(/€\s*([\d.,]+)(?!\s*\.--)/);
  if (eurMatch) {
    const num = parseInt(eurMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { price_eur: num, price_usd: 0, source: 'EUR' };
  }
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

async function fetchPage(path) {
  const res = await fetch(`${ATHOME}${path}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Trovai/1.0; +https://trovai.nl)',
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
    'Cache-Control': 'public, max-age=300'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const { property_type = 'open', budget = '€ 1.000.000', area, debug } = await req.json();
    const usdEurRate = parseFloat(process.env.DAILY_USD_EUR) || DEFAULT_USD_EUR;
    const { min: minPrice, max: maxPrice } = parseBudget(budget);
    const paths = TYPE_PATHS[property_type] || TYPE_PATHS.open;

    // Fetch alle relevante overzichtspagina's parallel
    const pages = await Promise.all(paths.map(p => fetchPage(p).catch(e => ({ err: e.message, path: p }))));

    // === DEBUG MODE ===
    if (debug) {
      const stats = pages.map((html, i) => {
        if (typeof html !== 'string') return { path: paths[i], err: html.err };
        return {
          path: paths[i],
          length: html.length,
          h2_count: (html.match(/<h2/gi) || []).length,
          h3_count: (html.match(/<h3/gi) || []).length,
          article_count: (html.match(/<article/gi) || []).length,
          property_class_count: (html.match(/class="[^"]*propert[^"]*"/gi) || []).length,
          listing_class_count: (html.match(/class="[^"]*listing[^"]*"/gi) || []).length,
          nl_links: (html.match(/href="[^"]*-nl\/?"/gi) || []).slice(0, 3),
          first_h2: (html.match(/<h2[^>]*>[\s\S]{0,500}<\/h2>/i) || [''])[0],
          first_link_to_listing: (html.match(/<a[^>]+href="https:\/\/athomecuracao\.com\/[^"]+-nl\/?"[^>]*>[\s\S]{0,300}<\/a>/i) || [''])[0],
          euro_count: (html.match(/€/g) || []).length,
          usd_count: (html.match(/USD/g) || []).length
        };
      });
      return new Response(JSON.stringify({ debug: true, paths, stats }, null, 2), { status: 200, headers });
    }

    // === Echte parsing ===
    // Strategie: zoek alle <a href="...-nl/"> links naar listing detail pages
    // Voor elke link: pak een blok van ~2000 chars rondom waaruit we titel/prijs/specs halen
    const allListings = [];
    for (let i = 0; i < pages.length; i++) {
      const html = pages[i];
      if (typeof html !== 'string') continue;

      const linkRegex = /<a[^>]+href="(https:\/\/athomecuracao\.com\/[a-z0-9\/-]+-(\d+)-nl\/?)"/gi;
      const seen = new Set();
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const url = m[1];
        const id = m[2];
        if (seen.has(id)) continue;
        seen.add(id);

        // Block: 200 chars before en 1500 chars after de link voor context
        const start = Math.max(0, m.index - 200);
        const end = Math.min(html.length, m.index + 1800);
        const block = html.substring(start, end);

        // Titel uit eerste <h2> of <h3> in het blok, of uit alt= van image
        let title = '';
        const titleMatch = block.match(/<h[23][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/i)
                       || block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)
                       || block.match(/title="([^"]+)"/i)
                       || block.match(/alt="([^"]+)"/i);
        if (titleMatch) title = decode(titleMatch[1]);
        if (!title || title.length < 5) continue;

        const prices = parsePrices(block, usdEurRate);
        const bedsMatch = block.match(/(\d+)\s*Beds?/i) || block.match(/Beds?\s*[:>]?\s*(\d+)/i);
        const bathsMatch = block.match(/(\d+)\s*Baths?/i) || block.match(/Baths?\s*[:>]?\s*(\d+)/i);
        const sqftMatch = block.match(/([\d,]+)\s*sq\s*ft/i);
        const sqmMatch  = block.match(/([\d.,]+)\s*m[\u00b2²]/i);

        const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
        const baths = bathsMatch ? parseInt(bathsMatch[1]) : 0;
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : 0;
        const sqmRaw = sqmMatch ? parseInt(sqmMatch[1].replace(/[.,]/g, '')) : 0;
        const sqm = sqmRaw || (sqft ? Math.round(sqft * 0.0929) : 0);

        // Image uit blok of er net voor (lazy-loaded src kan in data-src zitten)
        const imgMatch = block.match(/<img[^>]+(?:src|data-src|data-lazy-src)="(https:\/\/athomecuracao\.com\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
        const image = imgMatch ? imgMatch[1] : '';

        let category = 'Woning';
        if (paths[i].includes('koopappartement')) category = 'Appartement';
        else if (title.toLowerCase().includes('villa')) category = 'Villa';
        else if (title.toLowerCase().includes('penthouse')) category = 'Penthouse';

        allListings.push({
          id: 'cur-' + id,
          raw_id: id,
          name: title,
          city: 'Curaçao',
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
          image,
          url: `https://trovai.nl/listing/cur-${id}`,
          source_url: url,
          description: ''
        });
      }
    }

    // Filter op prijs en sorteer
    let filtered = allListings.filter(l =>
      l.price >= MIN_PRICE_EUR && l.price >= minPrice * 0.8 && l.price <= maxPrice * 1.3
    );

    if (filtered.length < 3) {
      filtered = allListings.filter(l => l.price >= MIN_PRICE_EUR);
    }

    filtered.sort((a, b) => b.price - a.price);

    return new Response(JSON.stringify({
      listings: filtered.slice(0, 9),
      total: filtered.length,
      source: 'athomecuracao.com',
      partner: 'At Home Curaçao',
      filters: { property_type, minPrice, maxPrice, area, usd_eur_rate: usdEurRate, raw_count: allListings.length }
    }), { status: 200, headers });

  } catch (err) {
    console.error('get-curacao-listings error:', err.message);
    return new Response(JSON.stringify({
      error: 'Listings tijdelijk niet beschikbaar',
      detail: err.message,
      listings: [],
      total: 0
    }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-curacao-listings' };
