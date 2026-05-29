// Trovai · listing-meta edge function
// Server-side rendering voor /listing/*: injecteert een korte <title>, meta,
// OG/Twitter-tags, JSON-LD én de echte woningcontent (h1, locatie, prijs,
// omschrijving, hoofdafbeelding en interne links) in de zichtbare body, zodat
// crawlers zonder JS volledige, unieke content met precies één h1 zien.
// Edge functions draaien op Deno; regex-literals zijn hier toegestaan.

const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";

// Bestaande stad/regio-landingspagina's (voorkomt gebroken interne links).
const KNOWN_PAGES = new Set([
  "antibes","beaulieu-sur-mer","biot","cagnes-sur-mer","cannes","cap-dantibes",
  "eze","gassin","grasse","grimaud","juan-les-pins","le-cannet","mandelieu",
  "menton","monaco","mougins","nice","ramatuelle","roquebrune-cap-martin",
  "saint-jean-cap-ferrat","saint-paul-de-vence","saint-tropez","sainte-maxime",
  "sophia-antipolis","theoule-sur-mer","valbonne","vence","villefranche-sur-mer",
  "cote-dazur","curacao","curacao-blauwbaai","curacao-investering",
  "curacao-jan-thiel","curacao-willemstad",
]);

// Curatie van interne links + gerelateerde woningen per regio (alleen bestaande URLs).
const REGION_LINKS = {
  "cote-dazur": {
    label: "Côte d'Azur",
    cities: [["nice","Woningen in Nice"],["cannes","Woningen in Cannes"],["antibes","Woningen in Antibes"],["saint-tropez","Woningen in Saint-Tropez"],["mougins","Woningen in Mougins"]],
    listings: ["3599285","3599130","3599203","3599146","3599138"],
  },
  "curacao": {
    label: "Curaçao",
    cities: [["curacao-jan-thiel","Woningen in Jan Thiel"],["curacao-willemstad","Woningen in Willemstad"],["curacao-blauwbaai","Woningen in Blauwbaai"],["curacao-investering","Investeren op Curaçao"]],
    listings: ["cur-1433459","cur-1419108","cur-1421898","cur-1428687","cur-1432882"],
  },
};

function jsonScriptSafe(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/-->/g, "--\\>");
}

function htmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function stripTags(s) {
  return String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getAttr(p, name) {
  const a = (p.attributes || []).find((x) => x.name === name);
  return a && a.terms && a.terms[0] ? a.terms[0].name : "";
}

function slugifyCity(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function typeLabel(cat) {
  const c = (cat || "").toLowerCase();
  // Volgorde: villa/landgoed vóór appartement, zodat "villa met appartement"
  // niet als Appartement wordt gelabeld.
  if (c.includes("penthouse")) return "Penthouse";
  if (c.includes("villa")) return "Villa";
  if (c.includes("bastide") || c.includes("mas") || c.includes("domaine") || c.includes("estate") || c.includes("landgoed")) return "Landgoed";
  if (c.includes("appartement") || c.includes("apartment") || c.includes("flat")) return "Appartement";
  if (c.includes("maison") || c.includes("house") || c.includes("huis") || c.includes("woning")) return "Woning";
  if (c.includes("terrain") || c.includes("plot") || c.includes("land") || c.includes("kavel") || c.includes("bouwgrond")) return "Bouwgrond";
  return "Woning";
}

async function fetchLoca(id) {
  const res = await fetch(`${LOCA}?include=${id}&per_page=1`, {
    headers: { Accept: "application/json", "User-Agent": "Trovai/1.0" },
  });
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}

async function fetchCuracao(origin, id) {
  const res = await fetch(`${origin}/api/get-curacao-listing?id=${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && !data.error ? data : null;
}

function normaliseLoca(p, canonical) {
  const name = stripTags(p.name || "Woning op de Côte d'Azur");
  const city = getAttr(p, "City");
  const region = getAttr(p, "Region") || "Côte d'Azur";
  const country = getAttr(p, "Country") || "Frankrijk";
  const beds = getAttr(p, "Number of beds");
  const rooms = getAttr(p, "Number of rooms");
  const sqm = getAttr(p, "Living area");
  const land = getAttr(p, "Land area");
  const construction = getAttr(p, "Type of construction");
  const price = parseInt((p.prices && p.prices.price) || 0, 10);
  const priceFormatted = price > 0 ? "€" + price.toLocaleString("nl-NL") : "Prijs op aanvraag";
  const description = stripTags(p.description || p.short_description || "");
  const image = (p.images && p.images[0] && p.images[0].src) || "https://trovai.nl/og-image.svg";
  const category = (p.categories && p.categories[0] && p.categories[0].name) || "Woning";
  return {
    name, city, region, country, beds, rooms,
    surface: sqm ? sqm + " m²" : "",
    land: land ? land + " m²" : "",
    construction, price, priceFormatted, description, image, category,
    canonical, region_slug: "cote-dazur", currency: "EUR",
  };
}

function normaliseCuracao(p, canonical) {
  const name = p.name || "Curaçao woning";
  const city = p.city || "";
  const region = p.region || "Curaçao";
  const country = p.country || "Curaçao";
  const surface = p.surface_sqm ? p.surface_sqm + " m²" : "";
  const price = parseInt(p.price || 0, 10);
  const priceFormatted = p.price_formatted || (price > 0 ? "€" + price.toLocaleString("nl-NL") : "Prijs op aanvraag");
  const description = stripTags(p.description || "");
  const image = p.main_image || (p.images && p.images[0]) || "https://trovai.nl/og-image.svg";
  return {
    name, city, region, country,
    beds: p.beds ? String(p.beds) + " slaapkamers" : "",
    rooms: "", surface, land: "", construction: "",
    price, priceFormatted, description, image,
    category: typeLabel(name) === "Woning" ? "Woning" : typeLabel(name),
    canonical, region_slug: "curacao", currency: p.currency || "EUR",
  };
}

function buildJsonLd(d) {
  const offers = {
    "@type": "Offer",
    priceCurrency: d.currency,
    availability: "https://schema.org/InStock",
    url: d.canonical,
    seller: { "@type": "Organization", name: "Trovai", url: "https://trovai.nl" },
  };
  if (d.price > 0) offers.price = d.price;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": d.canonical,
    name: d.name,
    description: d.description || `${d.category} in ${d.city || d.region}. ${d.priceFormatted}.`,
    url: d.canonical,
    image: d.image,
    category: d.category,
    brand: { "@type": "Organization", name: "Trovai" },
    offers,
  };
}

function cityPath(d) {
  if (!d.city) return "";
  const slug = slugifyCity(d.city);
  return d.region_slug === "curacao" ? `curacao-${slug}` : slug;
}

function buildBreadcrumb(d) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Trovai", item: "https://trovai.nl/" },
    { "@type": "ListItem", position: 2, name: d.region, item: `https://trovai.nl/${d.region_slug}` },
  ];
  let pos = 3;
  const cSlug = cityPath(d);
  if (cSlug && KNOWN_PAGES.has(cSlug)) {
    items.push({ "@type": "ListItem", position: pos++, name: d.city, item: `https://trovai.nl/${cSlug}` });
  }
  items.push({ "@type": "ListItem", position: pos, name: d.name, item: d.canonical });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function buildTitle(d) {
  const t = typeLabel(d.category);
  const place = d.city || d.region;
  let title = `${t} in ${place} | Trovai`;
  if (title.length > 60) title = `${t} in ${place}`;
  if (title.length > 60) title = title.slice(0, 59).trim() + "…";
  return title;
}

function buildHeadInjection(d) {
  const title = buildTitle(d);
  const descSource = d.description ||
    `${d.category} in ${d.city || d.region}${d.beds ? ", " + d.beds : ""}${d.surface ? ", " + d.surface : ""}. ${d.priceFormatted}. Bekijk deze woning op Trovai.`;
  const metaDesc = descSource.replace(/\s+/g, " ").trim().slice(0, 156);
  const product = buildJsonLd({ ...d, description: metaDesc });
  const breadcrumb = buildBreadcrumb(d);
  const ogTitle = `${d.name} · ${d.priceFormatted}`;
  return {
    title,
    head: `
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(metaDesc)}">
<link rel="canonical" href="${htmlEscape(d.canonical)}">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://media.apimo.pro" crossorigin>
<link rel="preconnect" href="https://athomecuracao.com" crossorigin>
<meta property="og:type" content="product">
<meta property="og:url" content="${htmlEscape(d.canonical)}">
<meta property="og:title" content="${htmlEscape(ogTitle)}">
<meta property="og:description" content="${htmlEscape(metaDesc)}">
<meta property="og:image" content="${htmlEscape(d.image)}">
<meta property="og:site_name" content="Trovai">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(ogTitle)}">
<meta name="twitter:description" content="${htmlEscape(metaDesc)}">
<meta name="twitter:image" content="${htmlEscape(d.image)}">
<script type="application/ld+json">${jsonScriptSafe(product)}</script>
<script type="application/ld+json">${jsonScriptSafe(breadcrumb)}</script>
`,
  };
}

// Beschrijvende, unieke tekst per woning (locatie, kenmerken, context).
function buildDescriptionHtml(d) {
  const paras = (d.description || "")
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  let html = paras.map((p) => `<p>${htmlEscape(p)}</p>`).join("");

  const t = typeLabel(d.category);
  const feat = [];
  if (d.beds) feat.push(d.beds.toLowerCase().includes("slaapkamer") ? d.beds : d.beds + " slaapkamers");
  if (d.surface) feat.push("een woonoppervlak van " + d.surface);
  if (d.land) feat.push("een perceel van " + d.land);
  const featTxt = feat.length ? " met " + feat.join(", ") : "";

  const ctx =
    `Deze ${t.toLowerCase()}${featTxt} bevindt zich in ${d.city || d.region}` +
    `${d.city && d.region && d.city !== d.region ? `, ${d.region}` : ""}. ` +
    `De vraagprijs bedraagt ${d.priceFormatted}. ` +
    `${d.city || d.region} is een gewilde bestemming voor internationale kopers van luxe vastgoed. ` +
    `Trovai begeleidt u als onafhankelijke private buyer's advisor van eerste bezichtiging tot aan de notaris — discreet en volledig aan uw zijde.`;
  html += `<p>${htmlEscape(ctx)}</p>`;
  return html;
}

// Interne links: regio-hub, relevante stadspagina's en gerelateerde woningen.
function buildRelatedHtml(d) {
  const cfg = REGION_LINKS[d.region_slug] || REGION_LINKS["cote-dazur"];
  const currentId = (d.canonical.split("/").filter(Boolean).pop() || "").toLowerCase();

  const cityLinks = cfg.cities
    .filter(([slug]) => KNOWN_PAGES.has(slug))
    .map(([slug, label]) => `<a class="rel-link" href="/${slug}">${htmlEscape(label)}</a>`)
    .join("");

  const related = cfg.listings
    .filter((id) => id.toLowerCase() !== currentId)
    .slice(0, 3)
    .map((id) => `<a class="rel-link" href="/listing/${id}">Vergelijkbare woning</a>`)
    .join("");

  const hub = `<a class="rel-link" href="/${cfg.label === "Curaçao" ? "curacao" : "cote-dazur"}">Alle woningen in ${htmlEscape(cfg.label)}</a>`;

  return `
<section class="related-section" aria-label="Gerelateerde woningen en bestemmingen">
  <h2 class="rel-title">Ontdek meer in ${htmlEscape(d.region)}</h2>
  <div class="rel-grid">${hub}${cityLinks}${related}</div>
</section>`;
}

const RELATED_CSS = `
<style>
.related-section{max-width:1200px;margin:0 auto;padding:48px 48px 8px;border-top:0.5px solid var(--border,rgba(244,242,238,0.08))}
.rel-title{font-family:'Instrument Serif',serif;font-weight:400;font-size:24px;color:var(--white,#F4F2EE);margin:0 0 20px}
.rel-grid{display:flex;flex-wrap:wrap;gap:12px}
.rel-link{display:inline-block;font-size:13px;letter-spacing:0.04em;color:var(--gold,#C8A96A);border:0.5px solid rgba(200,169,106,0.35);background:rgba(200,169,106,0.04);padding:9px 16px;border-radius:2px;text-decoration:none;transition:all 0.2s}
.rel-link:hover{background:rgba(200,169,106,0.12)}
@media(max-width:900px){.related-section{padding:36px 20px 8px}}
</style>`;

export default async (request, context) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[parts.length - 1] || "";
  const isCuracao = /^cur-\d+/i.test(raw);
  const id = isCuracao ? raw.replace(/^cur-/i, "") : raw.replace(/[^\d]/g, "");

  const response = await context.next();
  if (!id || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }
  const html = await response.text();

  let listing = null;
  try {
    listing = isCuracao ? await fetchCuracao(url.origin, id) : await fetchLoca(id);
  } catch (_err) {
    listing = null;
  }
  if (!listing) {
    return new Response(html, { status: response.status, headers: response.headers });
  }

  const canonical = `https://trovai.nl${url.pathname}`;
  const d = isCuracao ? normaliseCuracao(listing, canonical) : normaliseLoca(listing, canonical);

  const { head } = buildHeadInjection(d);
  const cSlug = cityPath(d);
  const cityCrumb = cSlug && KNOWN_PAGES.has(cSlug)
    ? `<a href="/${cSlug}">${htmlEscape(d.city)}</a><span>/</span>`
    : "";

  // ---- HEAD: vervang bestaande tags door per-woning varianten ----
  let newHtml = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:(?:url|title|description|image|type|site_name)["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");
  newHtml = newHtml.replace(/<\/head>/i, head + RELATED_CSS + "</head>");

  // ---- BODY: toon de listing direct en vul de echte content (één h1) ----
  newHtml = newHtml
    .replace('<div id="loading">', '<div id="loading" style="display:none">')
    .replace('<div id="listing" class="fade-in">', '<div id="listing" class="fade-in" style="display:block">')
    // breadcrumb met interne links naar regio/stad
    .replace(
      /<div class="breadcrumb">[\s\S]*?<\/div>/i,
      `<div class="breadcrumb"><a href="/">Trovai</a><span>/</span><a href="/${d.region_slug}">${htmlEscape(d.region)}</a><span>/</span>${cityCrumb}<span id="bc-city">${htmlEscape(d.name)}</span></div>`,
    )
    .replace('<div class="listing-tag" id="l-tag">Woning</div>', `<div class="listing-tag" id="l-tag">${htmlEscape(typeLabel(d.category))}</div>`)
    .replace('<h1 class="listing-title" id="l-title"></h1>', `<h1 class="listing-title" id="l-title">${htmlEscape(d.name)}</h1>`)
    .replace('<span id="l-city"></span>', `<span id="l-city">${htmlEscape(d.city)}</span>`)
    .replace('<span id="l-region"></span>', `<span id="l-region">${htmlEscape(d.region)}</span>`)
    .replace('<span id="l-country">Frankrijk</span>', `<span id="l-country">${htmlEscape(d.country)}</span>`)
    .replace('<div class="listing-price" id="l-price"></div>', `<div class="listing-price" id="l-price">${htmlEscape(d.priceFormatted)}</div>`)
    .replace('<div class="sidebar-price" id="sb-price"></div>', `<div class="sidebar-price" id="sb-price">${htmlEscape(d.priceFormatted)}</div>`)
    .replace('<div class="desc-text" id="l-desc"></div>', `<div class="desc-text" id="l-desc">${buildDescriptionHtml(d)}</div>`)
    .replace(
      '<div class="gallery" id="l-gallery"></div>',
      `<div class="gallery" id="l-gallery"><div class="gallery-main"><img src="${htmlEscape(d.image)}" alt="${htmlEscape(d.name + " — " + (d.city || d.region))}" width="1200" height="800" fetchpriority="high" decoding="async" style="width:100%;height:100%;object-fit:cover"></div></div>`,
    )
    // interne links-blok vlak voor </main>
    .replace(/<\/main>/i, buildRelatedHtml(d) + "</main>");

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Content-Type", "text/html; charset=UTF-8");
  newHeaders.set("Cache-Control", "public, max-age=1800, s-maxage=3600");

  return new Response(newHtml, { status: 200, headers: newHeaders });
};

export const config = { path: "/listing/*" };
