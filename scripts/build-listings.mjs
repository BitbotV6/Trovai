// Trovai · build-listings.mjs
// Genereert tijdens de Netlify-build per getoonde woning een COMPLETE statische
// HTML-pagina (listing/<id>/index.html) met de eigen data eringebakken: unieke
// title, meta, schema.org, beschrijvende tekst, hoofdafbeelding en interne links,
// plus window.__PRELOADED zodat de client niet opnieuw hoeft te fetchen.
// Resultaat: een listing openen is direct (statische HTML, geen runtime-fetch).
//
// Databron: de eigen, al gedeployde API-endpoints (die de LOCA-/athomecuracao-
// bronnen server-side afhandelen). Robuust: faalt per-woning stil, nooit de build.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseLoca, normaliseCuracao, renderListingHtml } from "../netlify/edge-functions/lib/render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.URL || process.env.DEPLOY_PRIME_URL || "https://trovai.nl";
const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";
const TIMEOUT_MS = 20000;

// Getoonde woningen (sitemap/showcase). Houd in sync met sitemap.xml.
// CDA: direct bij LOCA via /products/<id> (de ?include-param van de Store-API is kapot).
// Curaçao: via het eigen API-endpoint (scrape met correcte per-id data).
const CDA = ["3599285", "3599138", "3599130", "3599203", "3599146"];
const CURACAO = ["1433459", "1419108", "1421898", "1428687", "1432882", "1420862", "1435441", "1416350", "1436113"];

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Trovai-build/1.0" }, signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data && !data.error ? data : null;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function writePage(slug, htmlOut) {
  const dir = join(ROOT, "listing", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), htmlOut);
}

async function buildOne(template, { slug, id, isCuracao, apiUrl }) {
  const raw = await fetchJson(apiUrl);
  if (!raw) { console.warn(`  ⚠ overslaan ${slug} (geen data)`); return false; }
  // Guard: bron mag geen verkeerde woning teruggeven (bv. kapotte ?include).
  const gotId = String(isCuracao ? (raw.raw_id || "") : (raw.id || ""));
  if (gotId !== String(id)) { console.warn(`  ⚠ overslaan ${slug} (id-mismatch: kreeg ${gotId})`); return false; }
  const canonical = `https://trovai.nl/listing/${slug}`;
  const d = isCuracao ? normaliseCuracao(raw, canonical) : normaliseLoca(raw, canonical);
  if (!d.name) { console.warn(`  ⚠ overslaan ${slug} (geen naam)`); return false; }
  const out = renderListingHtml(template, d, { preload: { type: isCuracao ? "curacao" : "loca", data: raw } });
  writePage(slug, out);
  console.log(`  ✓ ${slug} — ${d.name.slice(0, 48)}`);
  return true;
}

async function main() {
  const template = readFileSync(join(ROOT, "listing.html"), "utf8");
  const jobs = [
    ...CDA.map((id) => ({ slug: id, id, isCuracao: false, apiUrl: `${LOCA}/${id}` })),
    ...CURACAO.map((id) => ({ slug: `cur-${id}`, id, isCuracao: true, apiUrl: `${ORIGIN}/api/get-curacao-listing?id=${id}` })),
  ];
  console.log(`Pre-render ${jobs.length} listings (bron: ${ORIGIN}) ...`);
  let ok = 0;
  // Beperkte parallelliteit zodat de trage Curaçao-scrape de build niet ophoudt.
  const CONC = 4;
  for (let i = 0; i < jobs.length; i += CONC) {
    const batch = jobs.slice(i, i + CONC);
    const res = await Promise.all(batch.map((j) => buildOne(template, j).catch(() => false)));
    ok += res.filter(Boolean).length;
  }
  console.log(`Klaar: ${ok}/${jobs.length} listings statisch gegenereerd.`);
  // Nooit de build laten falen op ontbrekende brondata.
  process.exit(0);
}

main();
