// Trovai · listings-manifest.mjs
// Eén bron van waarheid voor de getoonde (pre-gerenderde) listings.
// Gebruikt door scripts/build-listings.mjs (statische pre-render) én
// netlify/functions/sitemap-listings.mjs (sitemap) zodat de sitemap nooit
// listing-URL's bevat zonder eigen voorgerenderde pagina.
// Houd in sync met de listing-entries in sitemap.xml.
// Let op (esbuild): geen regex-literals in dit bestand.

export const CDA_IDS = ["3599285", "3599138", "3599130", "3599203", "3599146"];

export const CURACAO_IDS = [
  "1433459", "1419108", "1421898", "1428687", "1432882",
  "1420862", "1435441", "1416350", "1436113",
];
