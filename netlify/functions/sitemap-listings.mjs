// Trovai · sitemap-listings.mjs
// Genereert een actuele sitemap met alle huidige listing-URLs op basis van
// de LOCA WooCommerce productlijst en de At Home Curaçao scraper. Wordt
// geserveerd op /sitemap-listings.xml en in robots.txt aangekondigd als
// extra sitemap naast het statische /sitemap.xml.

const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";
const LOCA_MAX_PAGES = 6;
const LOCA_PER_PAGE = 100;

function xmlEscape(s) {
  return String(s).replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  }[c]));
}

async function fetchLocaIds() {
  const ids = [];
  for (let page = 1; page <= LOCA_MAX_PAGES; page++) {
    const url = `${LOCA}?per_page=${LOCA_PER_PAGE}&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Trovai/1.0" },
    });
    if (!res.ok) break;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const p of arr) {
      if (p && p.id) ids.push(String(p.id));
    }
    if (arr.length < LOCA_PER_PAGE) break;
  }
  return ids;
}

async function fetchCuracaoIds(origin) {
  const res = await fetch(`${origin}/api/get-curacao-listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ property_type: "open", budget: "€ 5000000+" }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const listings = Array.isArray(data && data.listings) ? data.listings : [];
  return listings.map((l) => l.raw_id).filter(Boolean).map(String);
}

function buildUrlEntry(loc, lastmod) {
  return `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
}

export default async (req) => {
  const reqUrl = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);

  const seen = new Set();
  const entries = [];

  const settled = await Promise.allSettled([
    fetchLocaIds(),
    fetchCuracaoIds(reqUrl.origin),
  ]);

  const locaIds = settled[0].status === "fulfilled" ? settled[0].value : [];
  const curIds = settled[1].status === "fulfilled" ? settled[1].value : [];

  for (const id of locaIds) {
    const key = `loca:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(buildUrlEntry(`https://trovai.nl/listing/${id}`, today));
  }
  for (const id of curIds) {
    const key = `cur:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(buildUrlEntry(`https://trovai.nl/listing/cur-${id}`, today));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
      "X-Trovai-Loca-Count": String(locaIds.length),
      "X-Trovai-Curacao-Count": String(curIds.length),
    },
  });
};

export const config = { path: "/sitemap-listings.xml" };
