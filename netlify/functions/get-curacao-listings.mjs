// Trovai · get-curacao-listings.mjs
// Haalt ECHTE listings op van athomecuracao.com (At Home Curacao - Patricia Zegwaard)
// HTML parser - werkt direct met WP HTML output
// REGEL: prijzen NOOIT omrekenen - exacte valuta + exact bedrag van bron behouden

const ATHOME = 'https://athomecuracao.com';
const MIN_PRICE = 400000; // minimum bedrag (ongeacht valuta)

const TYPE_PATHS = {
  villa:     ['/kopen/koopwoning/'],
  apartment: ['/kopen/koopappartement/'],
  invest:    ['/kopen/koopwoning/', '/kopen/koopappartement/'],
  bungalow:  ['/kopen/koopwoning/'],
  estate:    ['/kopen/koopwoning/'],
  open:      ['/kopen/koopwoning/', '/kopen/koopappartement/']
};

function parseBudget(str) {
  if (!str) return { min: MIN_PRICE, max: 99000000 };
  const clean = String(str).replace(/[€$.\s+±~]/g, '').replace(',', '');
  const num = parseInt(clean) || 0;
  const isPlus = String(str).includes('+');
  return {
    min: Math.max(MIN_PRICE, Math.floor(num * 0.6)),
    max: isPlus ? 99000000 : Math.ceil(num * 1.4)
  };
}

function decode(s) {
  if (!s) return '';
  return String(s)
    .replace(/&#8211;/g, '-').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

// Parseert prijs zonder valuta-conversie. Behoudt exact het bedrag en de valuta zoals op de bron staat.
function parsePrices(block) {
  // EUR eerst (vaste prijs in euro of euro-teken)
  const eurMatch = block.match(/vaste\s*prijs\s*in:\s*€\s*([\d.,]+)/i)
                || block.match(/€\s*([\d.,]+)(?!\s*\.--)/);
  if (eurMatch) {
    const num = parseInt(eurMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { amount: num, currency: 'EUR' };
  }
  // USD
  const usdMatch = block.match(/vaste\s*prijs\s*in:\s*US\$?\s*([\d.,]+)/i)
                || block.match(/USD\s*([\d.,]+)/i)
                || block.match(/US\$\s*([\d.,]+)/i)
                || block.match(/\$\s*([\d.,]+)/);
  if (usdMatch) {
    const num = parseInt(usdMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { amount: num, currency: 'USD' };
  }
  return { amount: 0, currency: null };
}

function formatPrice(amount, currency) {
  if (!amount || !currency) return 'Prijs op aanvraag';
  if (currency === 'EUR') return '€ ' + amount.toLocaleString('nl-NL');
  if (currency === 'USD') return 'USD ' + amount.toLocaleString('en-US');
  return amount + ' ' + currency;
}

const LINK_RE = /<a[^>]+href="(https:\/\/athomecuracao\.com\/[a-z0-9\/-]+-(\d+)-nl\/?)"/i;
const LINK_RE_G = /<a[^>]+href="(https:\/\/athomecuracao\.com\/[a-z0-9\/-]+-(\d+)-nl\/?)"/gi;

// Verzamelt listing-blokken uit de HTML. Primair: per <article> element (meest robuust,
// elke article = 1 listing met natuurlijke grenzen). Fallback: link-based met begrenzing
// tot de volgende link, voor het geval het WP-thema geen articles gebruikt.
// Dezelfde ID kan meerdere keren voorkomen (preview-strook bovenaan + echte card lager)
// - per ID kiezen we de variant waar een prijs in het blok staat.
function collectMatches(html) {
  const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  const articles = [];
  let am;
  while ((am = articleRe.exec(html)) !== null) {
    articles.push({ block: am[0], index: am.index });
  }

  const byId = new Map();

  if (articles.length > 0) {
    for (const a of articles) {
      const lm = a.block.match(LINK_RE);
      if (!lm) continue;
      const id = lm[2];
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push({ id, url: lm[1], index: a.index, block: a.block });
    }
  } else {
    // Fallback: geen <article> tags - blok start exact bij de link, eindigt vóór volgende link
    // Geen vooraf-bytes om prijs-bleed vanuit vorige listing te voorkomen
    const allLinks = [];
    let m;
    while ((m = LINK_RE_G.exec(html)) !== null) {
      allLinks.push({ id: m[2], url: m[1], index: m.index });
    }
    for (let i = 0; i < allLinks.length; i++) {
      const cur = allLinks[i];
      const nextIdx = i + 1 < allLinks.length ? allLinks[i + 1].index : html.length;
      const end = Math.min(cur.index + 4000, nextIdx);
      const block = html.substring(cur.index, end);
      if (!byId.has(cur.id)) byId.set(cur.id, []);
      byId.get(cur.id).push({ id: cur.id, url: cur.url, index: cur.index, block });
    }
  }

  // Per ID: kies kandidaat met prijs in blok, anders laatste kandidaat
  const chosen = [];
  for (const [id, candidates] of byId) {
    let pick = candidates.find(c => parsePrices(c.block).amount > 0);
    if (!pick) pick = candidates[candidates.length - 1];
    chosen.push(pick);
  }
  return chosen;
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
    const { min: minPrice, max: maxPrice } = parseBudget(budget);
    const paths = TYPE_PATHS[property_type] || TYPE_PATHS.open;

    const pages = await Promise.all(paths.map(p => fetchPage(p).catch(e => ({ err: e.message, path: p }))));

    // === DEBUG MODE ===
    if (debug) {
      const stats = pages.map((html, i) => {
        if (typeof html !== 'string') return { path: paths[i], err: html.err };
        const all = collectMatches(html);
        const withPrice = all.filter(c => parsePrices(c.block).amount > 0).length;
        return {
          path: paths[i],
          length: html.length,
          h2_count: (html.match(/<h2/gi) || []).length,
          h3_count: (html.match(/<h3/gi) || []).length,
          article_count: (html.match(/<article/gi) || []).length,
          property_class_count: (html.match(/class="[^"]*property[^"]*"/gi) || []).length,
          listing_class_count: (html.match(/class="[^"]*listing[^"]*"/gi) || []).length,
          unique_ids: all.length,
          ids_with_price: withPrice,
          first_h2: (html.match(/<h2[^>]*>[\s\S]{0,300}?<\/h2>/i) || ['(geen)'])[0]
        };
      });
      const blocks = [];
      for (let i = 0; i < pages.length && blocks.length < 2; i++) {
        const html = pages[i];
        if (typeof html !== 'string') continue;
        const matches = collectMatches(html).slice(0, 2);
        for (const c of matches) {
          blocks.push({ url: c.url, id: c.id, block: c.block });
        }
      }
      return new Response(JSON.stringify({ debug: true, paths, stats, blocks }, null, 2), { status: 200, headers });
    }

    // === Echte parsing ===
    const allListings = [];
    for (let i = 0; i < pages.length; i++) {
      const html = pages[i];
      if (typeof html !== 'string') continue;

      const chosen = collectMatches(html);
      for (const { id, url, block } of chosen) {

        // Titel
        let title = '';
        const titleMatch = block.match(/<h[23][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/i)
                       || block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)
                       || block.match(/title="([^"]+)"/i)
                       || block.match(/alt="([^"]+)"/i);
        if (titleMatch) title = decode(titleMatch[1]);
        if (!title || title.length < 5) continue;

        const prices = parsePrices(block);
        const bedsMatch = block.match(/(\d+)\s*Beds?/i) || block.match(/Beds?\s*[:>]?\s*(\d+)/i);
        const bathsMatch = block.match(/(\d+)\s*Baths?/i) || block.match(/Baths?\s*[:>]?\s*(\d+)/i);
        const sqftMatch = block.match(/([\d,]+)\s*sq\s*ft/i);
        const sqmMatch  = block.match(/([\d.,]+)\s*m[\u00b2²]/i);

        const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
        const baths = bathsMatch ? parseInt(bathsMatch[1]) : 0;
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : 0;
        const sqmRaw = sqmMatch ? parseInt(sqmMatch[1].replace(/[.,]/g, '')) : 0;
        const sqm = sqmRaw || (sqft ? Math.round(sqft * 0.0929) : 0);

        const imgMatch = block.match(/<img[^>]+(?:src|data-src|data-lazy-src)="(https:\/\/athomecuracao\.com\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
        const image = imgMatch ? imgMatch[1] : '';

        let category = 'Woning';
        if (paths[i].includes('koopappartement')) category = 'Appartement';
        else if (title.toLowerCase().includes('villa')) category = 'Villa';
        else if (title.toLowerCase().includes('penthouse')) category = 'Penthouse';
        else if (title.toLowerCase().includes('kavel')) category = 'Kavel';
        else if (title.toLowerCase().includes('bungalow')) category = 'Bungalow';

        allListings.push({
          id: 'cur-' + id,
          raw_id: id,
          name: title,
          city: 'Curaçao',
          category,
          price: prices.amount,
          currency: prices.currency,
          price_formatted: formatPrice(prices.amount, prices.currency),
          beds: beds ? `${beds} slaapkamers` : '',
          baths: baths ? `${baths} badkamers` : '',
          surface_sqm: sqm,
          surface: sqm ? `${sqm} m²` : '',
          image,
          url: `https://trovai.nl/listing/cur-${id}`,
          source_url: url
        });
      }
    }

    // Dedupe op id (kan voorkomen als zelfde listing op meerdere paths staat)
    const dedup = new Map();
    for (const l of allListings) {
      if (!dedup.has(l.id) || (dedup.get(l.id).price === 0 && l.price > 0)) {
        dedup.set(l.id, l);
      }
    }
    const unique = [...dedup.values()];

    // Filter: bedrag >= MIN_PRICE en in budgetrange (zelfde getal-vergelijking, ongeacht valuta)
    let filtered = unique.filter(l =>
      l.price >= MIN_PRICE && l.price >= minPrice * 0.8 && l.price <= maxPrice * 1.3
    );

    if (filtered.length < 3) {
      filtered = unique.filter(l => l.price >= MIN_PRICE);
    }

    filtered.sort((a, b) => b.price - a.price);

    return new Response(JSON.stringify({
      listings: filtered.slice(0, 9),
      total: filtered.length,
      source: 'athomecuracao.com',
      partner: 'At Home Curaçao',
      filters: { property_type, minPrice, maxPrice, area, raw_count: unique.length }
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
