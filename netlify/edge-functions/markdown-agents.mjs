// Trovai · markdown-agents.mjs
// "Markdown for Agents": requests met Accept: text/markdown krijgen een
// markdown-weergave van de HTML-pagina (Content-Type: text/markdown +
// X-Markdown-Tokens). Browsers zonder die header merken hier niets van:
// de functie geeft dan géén Response terug, zodat het normale (cachebare)
// statische pad ongemoeid blijft.
// Zie https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  euro: "€", copy: "©", middot: "·", mdash: "—",
  ndash: "–", rsquo: "’", lsquo: "‘", ldquo: "“",
  rdquo: "”", hellip: "…", eacute: "é", egrave: "è",
  ocirc: "ô", ccedil: "ç", agrave: "à", uuml: "ü",
  raquo: "»", laquo: "«", times: "×", rarr: "→",
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
        ? NAMED_ENTITIES[name.toLowerCase()]
        : m,
    );
}

function absUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export function htmlToMarkdown(html, pageUrl) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const metaDesc =
    (html.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/i) || [])[1] ||
    (html.match(/<meta\s+name=["']description["']\s+content='([^']*)'/i) || [])[1] || "";

  let body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];

  // Ruis weg: scripts, styles, svg, noscript, nav, forms.
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Koppen → markdown (blokniveau vóór inline).
  body = body.replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? "\n\n" + "#".repeat(parseInt(lvl, 10)) + " " + text + "\n\n" : " ";
  });

  // Links → [tekst](absolute url); ankers en lege labels vervallen.
  body = body.replace(/<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return " ";
    return "[" + text + "](" + absUrl(href, pageUrl) + ")";
  });

  // Lijstitems, nadruk, blokgrenzen.
  body = body
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|main|table|tr|ul|ol|blockquote|figure)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  body = decodeEntities(body)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const parts = ["# " + decodeEntities(title).trim()];
  if (metaDesc) parts.push("> " + decodeEntities(metaDesc).trim());
  parts.push("URL: " + pageUrl);
  parts.push(body);
  return parts.join("\n\n") + "\n";
}

export default async (request, context) => {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  // Geen markdown gevraagd → niets teruggeven, zodat het normale statische
  // (cachebare) pad volledig intact blijft.
  if (!accept.includes("text/markdown")) return;

  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";
  if (response.status !== 200 || !contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const md = htmlToMarkdown(html, request.url);

  return new Response(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=UTF-8",
      "Vary": "Accept",
      "X-Markdown-Tokens": String(Math.ceil(md.length / 4)),
      "Cache-Control": "public, max-age=3600",
    },
  });
};

export const config = {
  path: "/*",
  excludedPath: [
    "/api/*",
    "/admin/*",
    "/.well-known/*",
    "/*.xml", "/*.txt", "/*.json", "/*.md",
    "/*.js", "/*.css", "/*.svg", "/*.png", "/*.jpg", "/*.jpeg", "/*.webp", "/*.ico",
  ],
};
