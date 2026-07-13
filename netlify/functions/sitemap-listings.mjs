// Trovai · sitemap-listings.mjs
// Serves /sitemap-listings.xml, gebouwd uit de gedeelde listings-manifest —
// exact de set die tijdens de build statisch wordt voorgerenderd
// (scripts/build-listings.mjs). Bewust géén live inventaris-scrape meer:
// niet-voorgerenderde listing-URL's in de sitemap leidden tot lege shells
// met een canonical naar de homepage (soft-404's voor Googlebot).
// Geen lastmod: de werkelijke wijzigingsdatum per woning is onbekend en een
// vaste "vandaag"-stempel is een vals freshness-signaal.

import { CDA_IDS, CURACAO_IDS } from "../shared/listings-manifest.mjs";

const SITE = "https://trovai.nl";

function buildXml() {
  const entry = (loc) => `  <url><loc>${loc}</loc></url>`;
  const lines = [];
  for (const id of CDA_IDS) lines.push(entry(`${SITE}/listing/${id}`));
  for (const id of CURACAO_IDS) lines.push(entry(`${SITE}/listing/cur-${id}`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines.join("\n")}
</urlset>
`;
}

export default async () => {
  return new Response(buildXml(), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Trovai-Sitemap-Source": "manifest",
    },
  });
};

export const config = { path: "/sitemap-listings.xml" };
