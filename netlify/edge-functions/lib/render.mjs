// Trovai · gedeelde listing-render-logica (puur, geen netwerk/runtime-specifiek).
// Gebruikt door de edge function (dynamische fallback) én het build-script
// (statische pre-render). Pure string-bewerkingen; werkt in Deno én Node.

export const KNOWN_PAGES = new Set([
  "antibes","beaulieu-sur-mer","biot","cagnes-sur-mer","cannes","cap-dantibes",
  "eze","gassin","grasse","grimaud","juan-les-pins","le-cannet","mandelieu",
  "menton","monaco","mougins","nice","ramatuelle","roquebrune-cap-martin",
  "saint-jean-cap-ferrat","saint-paul-de-vence","saint-tropez","sainte-maxime",
  "sophia-antipolis","theoule-sur-mer","valbonne","vence","villefranche-sur-mer",
  "cote-dazur","curacao","curacao-blauwbaai","curacao-investering",
  "curacao-jan-thiel","curacao-willemstad",
]);

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

const AREA_CONTEXT = {
  "Jan Thiel": "Jan Thiel is een van de meest geliefde gebieden van Curaçao, bekend om zijn boulevard, stranden en uitstekende voorzieningen.",
  "Vista Royal": "Vista Royal is een gewilde, groene woonwijk vlak bij Jan Thiel en de mooiste stranden van het eiland.",
  "Jan Sofat": "Jan Sofat is een exclusieve gated community aan het Spaanse Water, geliefd bij internationale kopers.",
  "Boca Gentil": "Boca Gentil is een prestigieus resortgebied aan zee, met privéstranden en jachthavenfaciliteiten.",
  "Willemstad": "Willemstad, de UNESCO-werelderfgoedhoofdstad, combineert historische charme met een levendig stadsleven.",
  "Piscadera": "Piscadera ligt centraal aan de kust, dicht bij Willemstad, resorts en uitstekende duiklocaties.",
  "Blue Bay": "Blue Bay is een beveiligd resort met golfbaan, eigen strand en een gewild internationaal karakter.",
  "Coral Estate": "Coral Estate is een luxe kustresort aan de westkant van het eiland, met spectaculaire zonsondergangen.",
  "Cas Grandi": "Cas Grandi is een rustige, gewilde woonwijk in het oosten van Curaçao, dicht bij Jan Thiel en de stranden.",
  "Cannes": "Cannes staat wereldwijd bekend om zijn glamour, de Croisette en een uiterst stabiele luxe-vastgoedmarkt.",
  "Nice": "Nice combineert een kosmopolitische stadssfeer met een eigen luchthaven en het hele jaar door een aangenaam klimaat.",
  "Antibes": "Antibes en Cap d'Antibes behoren tot de meest exclusieve adressen van de Rivièra, met jachthavens en privévilla's.",
  "Mougins": "Mougins is een geliefd kunstenaarsdorp boven Cannes, bekend om zijn rust, gastronomie en privacy.",
  "Saint-Tropez": "Saint-Tropez is het iconische zomerse epicentrum van de Rivièra, met jachthaven, stranden en discrete landgoederen.",
  "Théoule-sur-Mer": "Théoule-sur-Mer ligt aan de rode rotsen van het Estérel-massief, met uitzonderlijke zeezichten.",
  "Grasse": "Grasse, de parfumhoofdstad, biedt authentieke Provençaalse charme op korte afstand van de kust.",
  "Valbonne": "Valbonne is een geliefd Provençaals dorp in het achterland, dicht bij Sophia-Antipolis en de kust.",
  "Le Tignet": "Le Tignet is een rustig Provençaals dorp in het achterland van Grasse, met ruimte, groen en zicht op de heuvels.",
};

function nImg(src, w, q) {
  if (!src) return src;
  return "/.netlify/images?url=" + encodeURIComponent(src) + "&w=" + w + "&q=" + (q || 72);
}
function nSrcset(src, widths, q) {
  return widths.map((w) => `${nImg(src, w, q)} ${w}w`).join(", ");
}
function isHeading(p) {
  return p.length < 42 && p.split(" ").length <= 5 && !/[.!?:]$/.test(p);
}
function joinNL(arr) {
  if (arr.length <= 1) return arr.join("");
  return arr.slice(0, -1).join(", ") + " en " + arr[arr.length - 1];
}
function splitParas(text) {
  const blocks = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    if (block.length <= 320) { out.push(block); continue; }
    const sentences = block.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [block];
    let buf = "";
    for (const s of sentences) {
      buf += s;
      if (buf.length >= 240) { out.push(buf.trim()); buf = ""; }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}
function jsonScriptSafe(obj) {
  const bs = String.fromCharCode(92); // backslash zonder bron-escaping
  return JSON.stringify(obj).split("<").join(bs + "u003c").split("-->").join("--" + bs + ">");
}
function htmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function stripTags(s) {
  return String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function descToText(s) {
  return String(s ?? "")
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t ]+/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  if (c.includes("penthouse")) return "Penthouse";
  if (c.includes("villa")) return "Villa";
  if (c.includes("bastide") || c.includes("mas") || c.includes("domaine") || c.includes("estate") || c.includes("landgoed")) return "Landgoed";
  if (c.includes("appartement") || c.includes("apartment") || c.includes("flat")) return "Appartement";
  if (c.includes("maison") || c.includes("house") || c.includes("huis") || c.includes("woning")) return "Woning";
  if (c.includes("terrain") || c.includes("plot") || c.includes("land") || c.includes("kavel") || c.includes("bouwgrond")) return "Bouwgrond";
  return "Woning";
}

export function normaliseLoca(p, canonical) {
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
  const description = descToText(p.description || p.short_description || "");
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

export function normaliseCuracao(p, canonical) {
  const name = p.name || "Curaçao woning";
  const city = p.city || "";
  const region = p.region || "Curaçao";
  const country = p.country || "Curaçao";
  const surface = p.surface_sqm ? p.surface_sqm + " m²" : "";
  const price = parseInt(p.price || 0, 10);
  const priceFormatted = p.price_formatted || (price > 0 ? "€" + price.toLocaleString("nl-NL") : "Prijs op aanvraag");
  const description = descToText(p.description || "");
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
  const price = d.priceFormatted && d.priceFormatted !== "Prijs op aanvraag" ? d.priceFormatted : "";
  let title = price ? `${t} in ${place} · ${price} | Trovai` : `${t} in ${place} | Trovai`;
  if (title.length > 60 && price) title = `${t} in ${place} · ${price}`;
  if (title.length > 60) title = `${t} in ${place} | Trovai`;
  if (title.length > 60) title = `${t} in ${place}`.slice(0, 59).trim() + "…";
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
  return `
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
`;
}

function buildDescriptionHtml(d) {
  let src = (d.description || "").trim();
  if (src && !/[.!?"'）]$/.test(src) && !/\n/.test(src)) src = src.replace(/[,;:\s]+$/, "") + ".";
  const paras = src ? splitParas(src) : [];

  const extra = [];
  if (src.length < 900) {
    const t = typeLabel(d.category).toLowerCase();
    const feats = [];
    if (d.beds) feats.push(d.beds.toLowerCase().includes("slaapkamer") ? d.beds : d.beds + " slaapkamers");
    if (d.rooms) feats.push(d.rooms + " kamers");
    if (d.surface) feats.push("een woonoppervlak van " + d.surface);
    if (d.land) feats.push("een perceel van " + d.land);
    const place = d.city && d.region && d.city !== d.region ? `${d.city}, ${d.region}` : (d.city || d.region);
    extra.push(`Deze ${t} in ${place} ${feats.length ? "beschikt over " + joinNL(feats) : "wordt aangeboden via Trovai"}. De vraagprijs bedraagt ${d.priceFormatted}.`);
    extra.push(AREA_CONTEXT[d.city] || AREA_CONTEXT[d.region] ||
      `${d.region} is een gewilde bestemming voor internationale kopers van luxe vastgoed.`);
  }
  extra.push(`Trovai begeleidt u als onafhankelijke private buyer's advisor — van eerste bezichtiging tot aan de notaris, discreet en volledig aan uw zijde.`);

  return paras.concat(extra).map((p) =>
    isHeading(p) ? `<p><strong>${htmlEscape(p)}</strong></p>` : `<p>${htmlEscape(p)}</p>`
  ).join("");
}

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

// Injecteert de volledige per-woning content in de listing.html-template.
// opts.preload (optioneel): { type: 'loca'|'curacao', data } -> embed voor de client
// zodat die niet opnieuw hoeft te fetchen.
export function renderListingHtml(html, d, opts = {}) {
  const head = buildHeadInjection(d);
  const cSlug = cityPath(d);
  const cityCrumb = cSlug && KNOWN_PAGES.has(cSlug)
    ? `<a href="/${cSlug}">${htmlEscape(d.city)}</a><span>/</span>`
    : "";
  const preloadScript = opts.preload
    ? `<script>window.__PRELOADED=${jsonScriptSafe(opts.preload)};window.__PRERENDERED=1;</script>`
    : "";

  let out = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:(?:url|title|description|image|type|site_name)["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");
  out = out.replace(/<\/head>/i, head + RELATED_CSS + preloadScript + "</head>");

  out = out
    .replace('<div id="loading">', '<div id="loading" style="display:none">')
    .replace('<div id="listing" class="fade-in">', '<div id="listing" class="fade-in" style="display:block">')
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
      `<div class="gallery" id="l-gallery"><div class="gallery-main"><img src="${htmlEscape(nImg(d.image, 800, 68))}" srcset="${htmlEscape(nSrcset(d.image, [480, 640, 800, 1280], 68))}" sizes="(max-width:900px) 100vw, 760px" alt="${htmlEscape(d.name + " — " + (d.city || d.region))}" width="1200" height="800" fetchpriority="high" decoding="async" style="width:100%;height:100%;object-fit:cover"></div></div>`,
    )
    .replace(/<\/main>/i, buildRelatedHtml(d) + "</main>");
  return out;
}
