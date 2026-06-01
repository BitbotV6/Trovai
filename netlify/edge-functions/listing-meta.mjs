// Trovai · listing-meta edge function (dynamische fallback)
// De getoonde listings worden tijdens de build statisch voorgerenderd
// (scripts/build-listings.mjs) en bevatten de marker window.__PRERENDERED;
// die slaat deze function over. Voor overige (bv. quiz-)id's rendert deze
// function de pagina server-side, met een timeout zodat een trage bron-API
// de pagina nooit langer dan een paar seconden blokkeert.
// Edge functions draaien op Deno; regex-literals zijn hier toegestaan.

import { normaliseLoca, normaliseCuracao, renderListingHtml } from "./lib/render.mjs";

const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";
const FETCH_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function fetchLoca(id) {
  // Pad-based: ?include= wordt genegeerd door de LOCA Store-API; /products/<id> niet.
  const res = await fetch(`${LOCA}/${id}`, {
    headers: { Accept: "application/json", "User-Agent": "Trovai/1.0" },
  });
  if (!res.ok) return null;
  const obj = await res.json();
  return obj && obj.id ? obj : null;
}

async function fetchCuracao(origin, id) {
  const res = await fetch(`${origin}/api/get-curacao-listing?id=${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && !data.error ? data : null;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[parts.length - 1] || "";
  const isCuracao = /^cur-\d+/i.test(raw);
  const id = isCuracao ? raw.replace(/^cur-/i, "") : raw.replace(/[^\d]/g, "");

  const response = await context.next();
  // Laat alles wat geen 200 text/html is ongemoeid (o.a. redirects naar
  // trailing-slash, 404's, assets) — anders lekt een Location-header door.
  if (!id || response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }
  const html = await response.text();

  // Statisch voorgerenderde pagina: niets te doen, direct serveren.
  if (html.includes("__PRERENDERED")) {
    return new Response(html, { status: response.status, headers: response.headers });
  }

  // Dynamische fallback: data ophalen met timeout zodat de render nooit lang blokkeert.
  let listing = null;
  try {
    listing = await withTimeout(
      isCuracao ? fetchCuracao(url.origin, id) : fetchLoca(id),
      FETCH_TIMEOUT_MS,
    );
  } catch (_err) {
    listing = null;
  }
  if (!listing) {
    // Geen/te trage data: serveer het skeleton; de client vult het aan.
    return new Response(html, { status: response.status, headers: response.headers });
  }

  const canonical = `https://trovai.nl${url.pathname}`;
  const d = isCuracao ? normaliseCuracao(listing, canonical) : normaliseLoca(listing, canonical);
  const newHtml = renderListingHtml(html, d, {
    preload: { type: isCuracao ? "curacao" : "loca", data: listing },
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Content-Type", "text/html; charset=UTF-8");
  newHeaders.set("Cache-Control", "public, max-age=1800");
  newHeaders.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=86400, stale-while-revalidate=86400");

  return new Response(newHtml, { status: 200, headers: newHeaders });
};

export const config = { path: "/listing/*" };
