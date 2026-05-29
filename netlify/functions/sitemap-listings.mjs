// Trovai · sitemap-listings.mjs (reader)
// Serves /sitemap-listings.xml. Reads the pre-built XML from Netlify Blobs
// (written by the scheduled build-listings-sitemap function). This keeps the
// response instant — the slow LOCA + Curaçao scraping happens out-of-band on
// a cron, never at request time.
//
// If the blob does not exist yet (e.g. before the first scheduled run after a
// fresh deploy), it falls back to an embedded baseline of the currently-known
// listing IDs so the sitemap is always valid and never 502s.

import { getStore } from "@netlify/blobs";

const SITE = "https://trovai.nl";

// Baseline mirrors the listings hardcoded in the static sitemap.xml. Kept in
// sync so a blob-miss still yields a complete, valid sitemap.
const FALLBACK_LOCA = ["3599285", "3599138", "3599130", "3599203", "3599146"];
const FALLBACK_CURACAO = [
  "1433459", "1419108", "1421898", "1428687", "1432882",
  "1420862", "1435441", "1416350", "1436113",
];

function fallbackXml() {
  const today = new Date().toISOString().slice(0, 10);
  const entry = (loc) =>
    `  <url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
  const lines = [];
  for (const id of FALLBACK_LOCA) lines.push(entry(`${SITE}/listing/${id}`));
  for (const id of FALLBACK_CURACAO) lines.push(entry(`${SITE}/listing/cur-${id}`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join("\n")}
</urlset>
`;
}

export default async () => {
  let xml = null;
  try {
    const store = getStore("sitemaps");
    xml = await store.get("listings", { type: "text" });
  } catch {
    xml = null;
  }

  const body = xml || fallbackXml();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Trovai-Sitemap-Source": xml ? "blob" : "fallback",
    },
  });
};

export const config = { path: "/sitemap-listings.xml" };
