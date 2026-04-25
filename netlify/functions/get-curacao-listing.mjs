// Trovai · get-curacao-listing.mjs
// Proxy: haalt detail-pagina van At Home Curacao op (omzeilt CORS)
// Parseert images, beschrijving, specs uit de HTML
// Wordt aangeroepen vanaf /listing/cur-[id] op trovai.nl

const ATHOME = 'https://athomecuracao.com';
const DEFAULT_USD_EUR = 0.92;

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

function parsePrices(html, usdEurRate) {
  const eurMatch = html.match(/vaste\s*prijs\s*in:\s*€\s*([\d.,]+)/i)
              || html.match(/€\s*([\d.,]+)(?!\s*\.--)/);
  if (eurMatch) {
    const num = parseInt(eurMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) return { price_eur: num, price_usd: 0, source: 'EUR' };
  }
  const usdMatch = html.match(/USD\s*([\d.,]+)/i)
              || html.match(/US\$\s*([\d.,]+)/i);
  if (usdMatch) {
    const num = parseInt(usdMatch[1].replace(/[.,]/g, '')) || 0;
    if (num > 1000) {
      return { price_eur: Math.round(num * usdEurRate), price_usd: num, source: 'USD' };
    }
  }
  return { price_eur: 0, price_usd: 0, source: 'none' };
}

// Zoekt zoek-listing URL via REST API of Google indexering. Aangezien we alleen het ID hebben
// (bijv. 1419108), moeten we de slug vinden. Strategie: gebruik WP REST API search endpoint.
async function findUrlById(id) {
  // Probeer WP REST API search - werkt op de meeste WP sites
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
    // Negeer, val terug op directe URL guess
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

function parseDetail(html, id, sourceUrl, usdEurRate) {
  // Title - uit <title> of og:title
  const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)
                  || html.match(/<title>([^<]+)<\/title>/);
  const titleRaw = titleMatch ? titleMatch[1] : '';
  const title = decode(titleRaw.replace(/\s*[\|\-–]\s*At\s*Home\s*Cura.*$/i, ''));

  // Description uit og:description of meta description
  const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/)
                 || html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  const description = descMatch ? decode(descMatch[1]) : '';

  // Images - uit og:image en alle uploads/year/month JPG/PNG die in de page voorkomen
  const ogImage = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/) || [])[1];
  const imgRegex = /https:\/\/athomecuracao\.com\/wp-content\/uploads\/[\w/-]+?\.(?:jpg|jpeg|png|webp)/gi;
  const allImages = [...new Set((html.match(imgRegex) || []))];
  // Filter masthead/logo/icons/avatars
  const images = allImages.filter(u =>
    !u.includes('athome-curacao-masthead') &&
    !u.includes('logo') &&
    !u.includes('icon') &&
    !u.includes('avatar') &&
    !/-\d+x\d+\./.test(u.split('/').pop()) === false || true // keep all but logo/avatar
  ).filter(u =>
    !u.includes('logo') && !u.includes('icon') && !u.includes('avatar') &&
    !u.includes('masthead')
  );

  // Prijzen
  const prices = parsePrices(html, usdEurRate);

  // Specs uit de detail page - vaak in een tabel of lijst
  const bedsMatch = html.match(/(\d+)\s*slaapkamer/i) || html.match(/Beds[:\s]*(\d+)/i);
  const bathsMatch = html.match(/(\d+)\s*badkamer/i) || html.match(/Baths[:\s]*(\d+)/i);
  const sqftMatch = html.match(/(\d+)\s*sq\s*ft/i);
  const sqmMatch = html.match(/(\d+)\s*m[²2]/i);

  const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
  const baths = bathsMatch ? parseInt(bathsMatch[1]) : 0;
  const sqm = sqmMatch ? parseInt(sqmMatch[1])
            : sqftMatch ? Math.round(parseInt(sqftMatch[1]) * 0.0929)
            : 0;

  // Wijk uit titel raden
  const wijken = ['Jan Thiel', 'Jan Sofat', 'Vista Royal', 'Boca Gentil', 'Coral Estate',
                  'Blue Bay', 'Brakkeput', 'Mahaai', 'Westpunt', 'Pietermaai',
                  'Spaanse Water', 'Vredenberg', 'La Privada', 'Cas Grandi', 'Matancia',
                  'Santa Catharina', 'Trai Seru', 'Seru Lora', 'Curasol', 'Salinja'];
  let area = '';
  for (const w of wijken) {
    if (title.includes(w) || description.includes(w)) { area = w; break; }
  }

  return {
    id: 'cur-' + id,
    raw_id: id,
    name: title || 'Curaçao woning',
    city: area || 'Curaçao',
    region: 'Curaçao',
    country: 'Curaçao',
    price: prices.price_eur,
    price_usd: prices.price_usd,
    price_formatted: prices.price_eur > 0
      ? '€ ' + prices.price_eur.toLocaleString('nl-NL')
      : 'Prijs op aanvraag',
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
    'Cache-Control': 'public, max-age=1800' // 30 min
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });

  const url = new URL(req.url);
  let id = url.searchParams.get('id') || '';
  // Accepteer zowel 1419108 als cur-1419108
  id = id.replace(/^cur-/, '').replace(/[^\d]/g, '');

  if (!id) {
    return new Response(JSON.stringify({ error: 'ID vereist' }), { status: 400, headers });
  }

  try {
    const usdEurRate = parseFloat(process.env.DAILY_USD_EUR) || DEFAULT_USD_EUR;

    // Vind de echte URL (slug + id-nl)
    const sourceUrl = await findUrlById(id);
    if (!sourceUrl) {
      return new Response(JSON.stringify({
        error: 'Listing niet gevonden',
        id
      }), { status: 404, headers });
    }

    const html = await fetchDetail(sourceUrl);
    const data = parseDetail(html, id, sourceUrl, usdEurRate);

    return new Response(JSON.stringify(data), { status: 200, headers });

  } catch (err) {
    console.error('get-curacao-listing error:', err.message);
    return new Response(JSON.stringify({
      error: err.message,
      id
    }), { status: 500, headers });
  }
};

export const config = { path: '/api/get-curacao-listing' };
