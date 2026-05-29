// Trovai · listing-meta edge function
// Injects unique <title>, meta description, OG tags, JSON-LD and a
// <noscript> body block into the /listing/* page so crawlers see real
// per-listing content instead of the SPA skeleton.

const LOCA = "https://www.livingonthecotedazur.com/wp-json/wc/store/v1/products";

function jsonScriptSafe(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c").replace(/-->/g, "--\\>");
}

function htmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
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
  const priceFormatted = price > 0
    ? "€" + price.toLocaleString("nl-NL")
    : "Prijs op aanvraag";
  const description = stripTags(p.description || p.short_description || "");
  const image = (p.images && p.images[0] && p.images[0].src) ||
    "https://trovai.nl/og-image.svg";
  const category = (p.categories && p.categories[0] && p.categories[0].name) ||
    "Woning";
  return {
    name,
    city,
    region,
    country,
    beds,
    rooms,
    surface: sqm ? sqm + " m²" : "",
    land: land ? land + " m²" : "",
    construction,
    price,
    priceFormatted,
    description,
    image,
    category,
    canonical,
    region_slug: "cote-dazur",
    currency: "EUR",
  };
}

function normaliseCuracao(p, canonical) {
  const name = p.name || "Curaçao woning";
  const city = p.city || "";
  const region = p.region || "Curaçao";
  const country = p.country || "Curaçao";
  const surface = p.surface_sqm ? p.surface_sqm + " m²" : "";
  const price = parseInt(p.price || 0, 10);
  const priceFormatted = p.price_formatted ||
    (price > 0 ? "€" + price.toLocaleString("nl-NL") : "Prijs op aanvraag");
  const description = stripTags(p.description || "");
  const image = p.main_image ||
    (p.images && p.images[0]) ||
    "https://trovai.nl/og-image.svg";
  return {
    name,
    city,
    region,
    country,
    beds: p.beds ? String(p.beds) + " slaapkamers" : "",
    rooms: "",
    surface,
    land: "",
    construction: "",
    price,
    priceFormatted,
    description,
    image,
    category: "Curaçao woning",
    canonical,
    region_slug: "curacao",
    currency: p.currency || "EUR",
  };
}

function buildJsonLd(d) {
  const offers = {
    "@type": "Offer",
    priceCurrency: d.currency,
    availability: "https://schema.org/InStock",
    url: d.canonical,
    seller: {
      "@type": "Organization",
      name: "Trovai",
      url: "https://trovai.nl",
    },
  };
  if (d.price > 0) offers.price = d.price;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": d.canonical,
    name: d.name,
    description: d.description ||
      `${d.category} in ${d.city || d.region}. ${d.priceFormatted}.`,
    url: d.canonical,
    image: d.image,
    category: d.category,
    brand: { "@type": "Organization", name: "Trovai" },
    offers,
  };
}

function buildBreadcrumb(d) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Trovai", item: "https://trovai.nl/" },
    {
      "@type": "ListItem",
      position: 2,
      name: d.region,
      item: `https://trovai.nl/${d.region_slug}`,
    },
  ];
  let pos = 3;
  const cSlug = cityPath(d);
  if (cSlug) {
    items.push({
      "@type": "ListItem",
      position: pos++,
      name: d.city,
      item: `https://trovai.nl/${cSlug}`,
    });
  }
  items.push({
    "@type": "ListItem",
    position: pos,
    name: d.name,
    item: d.canonical,
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function buildHeadInjection(d) {
  const title = `${d.name} · ${d.priceFormatted} | Trovai`;
  const descSource = d.description ||
    `${d.category} in ${d.city || d.region}${d.beds ? ", " + d.beds : ""}${
      d.surface ? ", " + d.surface : ""
    }. ${d.priceFormatted}. Bekijk deze woning op Trovai.`;
  const metaDesc = descSource.replace(/\s+/g, " ").trim().slice(0, 156);
  const product = buildJsonLd({ ...d, description: metaDesc });
  const breadcrumb = buildBreadcrumb(d);
  return {
    title,
    metaDesc,
    head: `
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(metaDesc)}">
<link rel="canonical" href="${htmlEscape(d.canonical)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="product">
<meta property="og:url" content="${htmlEscape(d.canonical)}">
<meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(metaDesc)}">
<meta property="og:image" content="${htmlEscape(d.image)}">
<meta property="og:site_name" content="Trovai">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(title)}">
<meta name="twitter:description" content="${htmlEscape(metaDesc)}">
<meta name="twitter:image" content="${htmlEscape(d.image)}">
<script type="application/ld+json">${jsonScriptSafe(product)}</script>
<script type="application/ld+json">${jsonScriptSafe(breadcrumb)}</script>
`,
  };
}

function cityPath(d) {
  if (!d.city) return "";
  const slug = slugifyCity(d.city);
  return d.region_slug === "curacao" ? `curacao-${slug}` : slug;
}

function buildNoscriptBody(d, title) {
  const citySlug = cityPath(d);
  const descSnippet = d.description
    ? d.description.slice(0, 800)
    : `${d.category} in ${d.city || d.region}, ${d.country}.`;
  return `
<noscript>
  <article style="max-width:780px;margin:90px auto;padding:0 24px;font-family:system-ui,sans-serif;color:#F4F2EE;background:#080A0F">
    <nav aria-label="Kruimelpad" style="font-size:12px;color:#A8B5A4;margin-bottom:18px">
      <a href="/" style="color:#C8A96A">Trovai</a> /
      <a href="/${d.region_slug}" style="color:#C8A96A">${htmlEscape(d.region)}</a>${
    citySlug
      ? ` / <a href="/${citySlug}" style="color:#C8A96A">${htmlEscape(d.city)}</a>`
      : ""
  } /
      <span>${htmlEscape(d.name)}</span>
    </nav>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;line-height:1.2;margin:0 0 12px">${
    htmlEscape(d.name)
  }</h1>
    <p style="font-size:14px;color:#A8B5A4;margin:0 0 18px">
      ${htmlEscape(d.category)} in ${htmlEscape(d.city || d.region)}, ${
    htmlEscape(d.country)
  } &middot; <strong>${htmlEscape(d.priceFormatted)}</strong>
    </p>
    <ul style="list-style:none;padding:0;margin:0 0 24px;display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#A8B5A4">
      ${d.beds ? `<li><strong>Slaapkamers:</strong> ${htmlEscape(d.beds)}</li>` : ""}
      ${d.rooms ? `<li><strong>Kamers:</strong> ${htmlEscape(d.rooms)}</li>` : ""}
      ${d.surface ? `<li><strong>Woonoppervlak:</strong> ${htmlEscape(d.surface)}</li>` : ""}
      ${d.land ? `<li><strong>Perceel:</strong> ${htmlEscape(d.land)}</li>` : ""}
      ${d.construction ? `<li><strong>Bouwtype:</strong> ${htmlEscape(d.construction)}</li>` : ""}
    </ul>
    <p style="font-size:15px;line-height:1.7;color:rgba(244,242,238,0.85);margin:0 0 24px">${
    htmlEscape(descSnippet)
  }</p>
    <p style="font-size:14px;color:#A8B5A4;margin:0 0 12px">
      Trovai begeleidt internationale kopers bij de aankoop van vastgoed op de Côte d'Azur en op Curaçao. Onze advisering wordt aan verkoopzijde gefinancierd — volledige loyaliteit aan de koper.
    </p>
    <p style="font-size:14px">
      <a href="/${d.region_slug}" style="color:#C8A96A;margin-right:16px">Meer woningen in ${
    htmlEscape(d.region)
  }</a>
      ${
    citySlug
      ? `<a href="/${citySlug}" style="color:#C8A96A;margin-right:16px">Woningen in ${
        htmlEscape(d.city)
      }</a>`
      : ""
  }
      <a href="/#quiz" style="color:#C8A96A">Start de AI-match</a>
    </p>
  </article>
</noscript>
`;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = parts[parts.length - 1] || "";
  const isCuracao = /^cur-\d+/i.test(raw);
  const id = isCuracao
    ? raw.replace(/^cur-/i, "")
    : raw.replace(/[^\d]/g, "");

  const response = await context.next();
  if (!id || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }
  const html = await response.text();

  let listing = null;
  try {
    listing = isCuracao
      ? await fetchCuracao(url.origin, id)
      : await fetchLoca(id);
  } catch (_err) {
    listing = null;
  }
  if (!listing) {
    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  }

  const canonical = `https://trovai.nl${url.pathname}`;
  const normalised = isCuracao
    ? normaliseCuracao(listing, canonical)
    : normaliseLoca(listing, canonical);

  const { title, head } = buildHeadInjection(normalised);
  const noscriptBody = buildNoscriptBody(normalised, title);

  let newHtml = html
    .replace(/<title>[^<]*<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:(?:url|title|description|image|type|site_name)["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "");

  newHtml = newHtml.replace(/<\/head>/i, head + "</head>");
  newHtml = newHtml.replace(/<body([^>]*)>/i, `<body$1>${noscriptBody}`);

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Content-Type", "text/html; charset=UTF-8");
  newHeaders.set("Cache-Control", "public, max-age=1800, s-maxage=3600");

  return new Response(newHtml, {
    status: 200,
    headers: newHeaders,
  });
};

export const config = {
  path: "/listing/*",
};
