// Trovai · deploy-succeeded.mjs (event-triggered)
// Draait automatisch na elke geslaagde productie-deploy en pusht alle
// sitemap-URL's naar IndexNow (Bing/Yandex/Naver/Seznam). Google gebruikt
// IndexNow niet; daarvoor is de sitemap-resubmit in GSC de route.
// Let op (esbuild): geen regex-literals in dit bestand — string-parsing only.

const HOST = "trovai.nl";
const SITE = "https://trovai.nl";
const KEY = "380679a0dc3f7c4aa46248f26443dca3";

function extractLocs(xml) {
  const urls = [];
  let pos = 0;
  for (;;) {
    const start = xml.indexOf("<loc>", pos);
    if (start === -1) break;
    const end = xml.indexOf("</loc>", start);
    if (end === -1) break;
    const loc = xml.slice(start + 5, end).trim();
    if (loc.startsWith(SITE)) urls.push(loc);
    pos = end + 6;
  }
  return urls;
}

export default async () => {
  let urls = [];
  try {
    const res = await fetch(`${SITE}/sitemap.xml`);
    if (res.ok) urls = extractLocs(await res.text());
  } catch {
    urls = [];
  }
  if (urls.length === 0) {
    return new Response(JSON.stringify({ ok: false, reason: "sitemap leeg/onbereikbaar" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  let status = 0;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList: urls,
      }),
    });
    status = res.status;
  } catch {
    status = -1;
  }

  return new Response(
    JSON.stringify({ ok: status === 200 || status === 202, indexnowStatus: status, submitted: urls.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
