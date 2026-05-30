// Trovai · get-curacao-listing.mjs
// Proxy: haalt detail-pagina van At Home Curacao op (omzeilt CORS)
// Parseert images, beschrijving, specs uit de HTML
// Wordt aangeroepen vanaf /listing/cur-[id] op trovai.nl
// REGEL: prijzen NOOIT omrekenen - exacte valuta + exact bedrag van bron behouden

const ATHOME = 'https://athomecuracao.com';

function decode(s) {
  if (!s) return '';
  return s
    .replace(/&#8211;/g, '–').replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

// Haalt de VOLLEDIGE omschrijving uit de body (#overview entry-content),
// niet de afgekapte og:description. Geeft alinea's terug, gescheiden door lege regels.
function extractFullDescription(html) {
  const k = html.indexOf('id="overview"');
  if (k < 0) return '';
  const openEnd = html.indexOf('>', k);
  if (openEnd < 0) return '';
  // Loop tot de bijbehorende </div> via diepte-telling (geneste divs).
  let i = openEnd + 1, depth = 1, end = -1;
  while (i < html.length) {
    const nd = html.indexOf('<div', i);
    const cd = html.indexOf('</div>', i);
    if (cd < 0) break;
    if (nd >= 0 && nd < cd) { depth++; i = nd + 4; }
    else { depth--; if (depth === 0) { end = cd; break; } i = cd + 6; }
  }
  if (end < 0) return '';
  const frag = html.slice(openEnd + 1, end);
  const blocks = frag.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paras = [];
  for (const b of blocks) {
    const t = decode(b).replace(/\s+/g, ' ').trim();
    if (!t || t.toLowerCase() === 'property description') continue;
    if (t !== paras[paras.length - 1]) paras.push(t); // opeenvolgende duplicaten weg
  }
  return paras.join('\n\n');
}

// Parseert prijs zonder valuta-conversie. Behoudt exact het bedrag en de valuta zoals op de bron staat.
function parsePrices(html) {
  // 1. PRIMAIR: vaste prijs in Euros (owner-set prijs voor Curacao listings, stabiel)
  const eurVaste = html.match(/vaste\s*prijs\s*in\s*Euros?[:\s]+€\s*([\d.,]+)/i);
  if (eurVaste) {
    const num = parseInt(eurVaste[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { amount: num, currency: 'EUR' };
  }

  // 2. FALLBACK: vaste prijs in USD (alleen letterlijk "USD", niet "US$")
  const usdVaste = html.match(/vaste\s*prijs\s*in\s*USD[:\s]+US\$?\s*([\d.,]+)/i);
  if (usdVaste) {
    const num = parseInt(usdVaste[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { amount: num, currency: 'USD' };
  }

  // 3. FALLBACK: property-price span - HTML strippen, dan EUR/USD eruit
  const propIdx = html.search(/<span[^>]*class="property-price"/i);
  if (propIdx >= 0) {
    const window_ = html.slice(propIdx, propIdx + 1500);
    const stripped = window_.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const e = stripped.match(/€\s*([\d.,]+)/);
    if (e) {
      const num = parseInt(e[1].replace(/[.,]/g, '')) || 0;
      if (num > 1000) return { amount: num, currency: 'EUR' };
    }
    const u = stripped.match(/USD\s*([\d.,]+)/i);
    if (u) {
      const num = parseInt(u[1].replace(/[.,]/g, '')) || 0;
      if (num > 1000) return { amount: num, currency: 'USD' };
    }
  }

  return { amount: 0, currency: null };
}
function formatPrice(amount, currency) {
  if (!amount || !currency) return 'Prijs op aanvraag';
  if (currency === 'EUR') return '€ ' + amount.toLocaleString('nl-NL');
  if (currency === 'USD') return 'USD ' + amount.toLocaleString('en-US');
  return amount + ' ' + currency;
}

// Zoekt zoek-listing URL via REST API
async function findUrlById(id) {
  try {
    const res = await fetch(`${ATHOME}/wp-json/wp/v2/search?search=${id}&per_page=5`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Trovai/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      const match = data.find(d => d.url && d.url.includes(`-${id}-nl`));
      if (match) return match.url;
      if (data[0] && data[0].url) return data[0].url;
    }
  } catch (e) {
    // Negeer
  }
  return null;
}

async function fetchDetail(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Trovai/1.0; +https://trovai.nl)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'nl-NL,nl;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`At Home Curacao detail ${res.status}`);
  return await res.text();
}

function parseDetail(html, id, sourceUrl) {
  // Title
  const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)
                  || html.match(/<title>([^<]+)<\/title>/);
  const titleRaw = titleMatch ? titleMatch[1] : '';
  const title = decode(titleRaw.replace(/\s*[\|\-–]\s*At\s*Home\s*Cura.*$/i, ''));

  // Description — volledige body-omschrijving; val terug op og:description als die ontbreekt
  const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/)
                 || html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  const ogDesc = descMatch ? decode(descMatch[1]) : '';
  const description = extractFullDescription(html) || ogDesc;

  // Images
  const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/) || [])[1];
  const imgRegex = /https:\/\/athomecuracao\.com\/wp-content\/uploads\/[\w/-]+?\.(?:jpg|jpeg|png|webp)/gi;
  const allImages = [...new Set((html.match(imgRegex) || []))];
  const images = allImages.filter(u =>
    !u.includes('logo') && !u.includes('icon') && !u.includes('avatar') && !u.includes('masthead')
  );

  // Prijs (zonder conversie)
  const prices = parsePrices(html);

  // Specs
  const bedsMatch = html.match(/(\d+)\s*slaapkamer/i) || html.match(/Beds[:\s]*(\d+)/i) || html.match(/Slaapkamer\w*[\s\S]{0,150}?>\s*(\d+)/i) || html.match(/Beds?\b[\s\S]{0,150}?>\s*(\d+)/i);
  const bathsMatch = html.match(/(\d+)\s*badkamer/i) || html.match(/Baths[:\s]*(\d+)/i) || html.match(/Badkamer\w*[\s\S]{0,150}?>\s*(\d+)/i) || html.match(/Baths?\b[\s\S]{0,150}?>\s*(\d+)/i);
  const sqftMatch = html.match(/(\d+)\s*sq\s*ft/i);
  const sqmMatch = html.match(/(\d+)\s*m[²2]/i);

  const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
  const baths = bathsMatch ? parseInt(bathsMatch[1]) : 0;
  const sqm = sqmMatch ? parseInt(sqmMatch[1])
            : sqftMatch ? Math.round(parseInt(sqftMatch[1]) * 0.0929)
            : 0;

  // Wijk bepalen: de woningnaam/titel noemt de échte wijk; de omschrijving noemt
  // vaak ook naburige gebieden (bv. "nabij Jan Thiel"), dus titel heeft voorrang.
  const wijken = ['Jan Thiel', 'Jan Sofat', 'Vista Royal', 'Boca Gentil', 'Coral Estate',
                  'Blue Bay', 'Brakkeput', 'Mahaai', 'Westpunt', 'Pietermaai', 'Piscadera',
                  'Spaanse Water', 'Vredenberg', 'La Privada', 'Cas Grandi', 'Matancia',
                  'Santa Catharina', 'Trai Seru', 'Seru Lora', 'Curasol', 'Salinja'];
  let area = '';
  for (const w of wijken) { if (title.includes(w)) { area = w; break; } }
  if (!area) { for (const w of wijken) { if (description.includes(w)) { area = w; break; } } }

  return {
    id: 'cur-' + id,
    raw_id: id,
    name: title || 'Curaçao woning',
    city: area || 'Curaçao',
    region: 'Curaçao',
    country: 'Curaçao',
    price: prices.amount,
    currency: prices.currency,
    price_formatted: formatPrice(prices.amount, prices.currency),
    beds,
    baths,
    surface_sqm: sqm,
    images,
    main_image: ogImage || images[0] || '',
    description,
    source_url: sourceUrl,
    partner: 'At Home Curaçao'
  };
}

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=1800'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });

  const url = new URL(req.url);
  let id = url.searchParams.get('id') || '';
  id = id.replace(/^cur-/, '').replace(/[^\d]/g, '');

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID vereist' }), { status: 400, headers });
  }

  try {
    const sourceUrl = await findUrlById(id);
    if (!sourceUrl) {
      return new Response(JSON.stringify({ error: 'Listing niet gevonden', id }), { status: 404, headers });
    }

    const html = await fetchDetail(sourceUrl);
    const data = parseDetail(html, id, sourceUrl);

    return new Response(JSON.stringify(data), { status: 200, headers });

  } catch (err) {
    console.error('get-curacao-listing error:', err.message);
    return new Response(JSON.stringify({ error: err.message, id }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-curacao-listing' };
