// Trovai · build-listings-sitemap.mjs (scheduled)
// Runs on a cron, scrapes the full LOCA WooCommerce product list and the
// live At Home Curaçao listings, builds the listings sitemap XML and stores
// it in Netlify Blobs (store "sitemaps", key "listings"). A scheduled/
// background function has a generous (~15 min) budget, so the slow upstreams
// (≈8 s per LOCA page, ≈16 s for the Curaçao scrape) are no problem here —
// unlike a request-time function which is capped at ~10 s and 502'd.
//
// The reader function (sitemap-listings.mjs) serves the stored blob instantly.

import { getStore } from "@netlify/blobs";

const SITE = "https://trovai.nl";
const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";
const LOCA_PER_PAGE = 100;
const LOCA_MAX_PAGES = 60; // safety cap (6.000 listings) — loop breaks earlier

async function fetchLocaIds() {
  const ids = [];
  for (let page = 1; page <= LOCA_MAX_PAGES; page++) {
    let res;
    try {
      res = await fetch(`${LOCA}?per_page=${LOCA_PER_PAGE}&page=${page}`, {
        headers: { Accept: "application/json", "User-Agent": "Trovai/1.0" },
      });
    } catch {
      break;
    }
    if (!res.ok) break;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) break;
    for (const p of arr) if (p && p.id) ids.push(String(p.id));
    if (arr.length < LOCA_PER_PAGE) break;
  }
  return ids;
}

async function fetchCuracaoIds() {
  try {
    const res = await fetch(`${SITE}/api/get-curacao-listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_type: "open", budget: "€ 5000000+" }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const listings = Array.isArray(data && data.listings) ? data.listings : [];
    return listings.map((l) => l.raw_id).filter(Boolean).map(String);
  } catch {
    return [];
  }
}

function buildXml(locaIds, curIds) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = (loc) =>
    `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
  const seen = new Set();
  const lines = [];
  for (const id of locaIds) {
    const u = `${SITE}/listing/${id}`;
    if (!seen.has(u)) { seen.add(u); lines.push(entry(u)); }
  }
  for (const id of curIds) {
    const u = `${SITE}/listing/cur-${id}`;
    if (!seen.has(u)) { seen.add(u); lines.push(entry(u)); }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join("\n")}
</urlset>
`;
}

export default async () => {
  const [locaR, curR] = await Promise.allSettled([
    fetchLocaIds(),
    fetchCuracaoIds(),
  ]);
  const locaIds = locaR.status === "fulfilled" ? locaR.value : [];
  const curIds = curR.status === "fulfilled" ? curR.value : [];

  // Never overwrite a previously-good blob with an empty result.
  if (locaIds.length === 0 && curIds.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, reason: "both upstreams empty" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const xml = buildXml(locaIds, curIds);
  const store = getStore("sitemaps");
  await store.set("listings", xml, {
    metadata: {
      loca: locaIds.length,
      curacao: curIds.length,
      builtAt: new Date().toISOString(),
    },
  });

  return new Response(
    JSON.stringify({ ok: true, loca: locaIds.length, curacao: curIds.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

// Every 6 hours. Listings change more often than daily during peak season.
export const config = { schedule: "0 */6 * * *" };
