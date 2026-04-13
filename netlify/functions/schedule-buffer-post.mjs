// Trovai · schedule-buffer-post.mjs
// Handmatige trigger vanuit admin dashboard.
// POST /api/schedule-buffer-post
// Body: { text?, type?, topic?, scheduled_at?, preview? }

const MARKTDATA = {
  cotedazur: {
    hypotheekrente: '3,04%', hypotheekrente_looptijd: '10 jaar vast',
    prijsstijging_5jaar: '20%', bron: 'Knight Frank 2024',
    verhuur_opbrengst: '8.000 tot 25.000 euro per maand', verhuur_seizoen: 'mei en september',
    offmarket_percentage: '40%', offmarket_drempel: 'boven 2 miljoen euro',
    topgebieden: ['Nice', 'Cannes', 'Antibes', 'Mougins', 'Monaco-corridor'],
    fiscale_structuur: 'SCI (familiale holding) voor erfbelastingoptimalisatie',
    commissie: 'verkopende partij betaalt, koper betaalt niets aan Trovai',
  },
  curacao: {
    rendement: '6 tot 8 procent netto via Airbnb',
    instap_villa: 'vanaf 200.000 euro', instap_appartement: 'vanaf 150.000 euro',
    airbnb_voorbeeld: '22.000 euro per jaar (villa Jan Thiel)',
    belasting: 'geen vermogensbelasting', klimaat: '365 dagen zon, buiten de orkaanzone',
    rechtssysteem: 'Nederlands rechtssysteem', vluchtduur: '9 uur vanaf Amsterdam',
  },
};

const SYSTEEM_PROMPT = `Je schrijft LinkedIn posts voor Trovai. Trovai is een Nederlandse AI-service die kopers begeleidt bij het kopen van een woning aan de Cote d'Azur of op Curacao. De service is gratis voor de koper.

SCHRIJFREGELS (zonder uitzondering):
Schrijf in de wij-vorm als Trovai.
Gebruik geen emdashes. Gebruik een komma of punt in plaats van een emdash.
Gebruik geen asterisken of markdown opmaak.
Gebruik geen bulletpoints of genummerde lijsten.
Gebruik maximaal 2 emoji per post. Alleen als ze echt iets toevoegen.
Zet een lege regel tussen elke alinea.
Eerste zin stopt de scroll: een concreet getal, een onverwachte stelling, of een tegenstelling. Nooit een vraag als opener.
De eerste 3 regels moeten zo intrigerend zijn dat mensen op meer weergeven klikken.
Eindig altijd met een open, laagdrempelige vraag die mensen uitnodigt te reageren.
Geen verkooppraatjes. Geen DM ons. Geen klik op de link.
Maximaal 5 hashtags, specifiek en relevant.
Schrijf 150 tot 280 woorden.

VERBODEN:
Emdash (gebruik komma of punt)
in de huidige markt of laten we eerlijk zijn of het is geen geheim
unieke kans of nu is het moment
Externe links in de post tekst.`;

const INSTRUCTIES = {
  market_insight:     `Begin met een concreet, verrassend getal als eerste zin. Geef context in 3 tot 4 korte alineas. Geen lijstjes. Sluit af met een vraag.`,
  roi_berekening:     `Concrete ROI-berekening: instapprijs, huurinkomsten per jaar, netto rendement. Vergelijk kort met spaargeld. Vraag over rendement.`,
  mythe:              `Weerleg een misverstand met feiten. Begin met de mythe als stellende zin, dan de werkelijkheid in 2 tot 3 alineas met cijfers.`,
  marktupdate:        `Beknopte update over wat er nu beweegt. 2 tot 3 concrete signalen. Wat betekent dit voor een potentiele koper?`,
  vergelijking:       `Vergelijk Cote d'Azur en Curacao op een specifiek aspect. Beide kanten in 2 tot 3 zinnen. Geen conclusie, laat de lezer kiezen.`,
  aankoopproces:      `Aankoopproces in alineas, geen lijst. Begin met een verrassing. Noem dat de service gratis is voor de koper.`,
  verhuur_strategie:  `Begin met een concreet verhuurcijfer. Welke periodes lucratief? Hoe werkt beheer? Vraag: verhuur, eigen gebruik, of beide?`,
  thought_leadership: `Observatie over hoe de markt verandert. Concreet inzicht. Warm, deskundig, menselijk. Geen verkooppraatje.`,
};

async function genereer(type, topic) {
  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ontbreekt');
  const marktData = topic === 'both' ? MARKTDATA : { [topic]: MARKTDATA[topic] };
  const instructie = INSTRUCTIES[type] || INSTRUCTIES.market_insight;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20251022', max_tokens: 900, system: SYSTEEM_PROMPT,
      messages: [{ role: 'user', content: `Schrijf een LinkedIn post voor Trovai.\nTYPE: ${type}\nINSTRUCTIE: ${instructie}\nMARKTDATA: ${JSON.stringify(marktData, null, 2)}\nAlleen de post tekst. Geen aanhalingstekens, geen introductie.` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

async function haalProfiel(bufferKey) {
  const res = await fetch('https://api.bufferapp.com/1/profiles.json', { headers: { Authorization: `Bearer ${bufferKey}` } });
  if (!res.ok) throw new Error(`Buffer profiles ${res.status}`);
  const profielen = await res.json();
  return profielen.find(p => p.service === 'linkedin_page') ||
         profielen.find(p => p.service === 'linkedin') ||
         (() => { throw new Error('Geen LinkedIn profiel in Buffer'); })();
}

async function stuurNaarBuffer(bufferKey, profielId, tekst, scheduledAt) {
  const params = new URLSearchParams();
  params.append('text', tekst);
  params.append('profile_ids[]', profielId);
  if (scheduledAt) params.append('scheduled_at', scheduledAt);
  const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bufferKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) { const f = await res.text(); throw new Error(`Buffer create ${res.status}: ${f}`); }
  return res.json();
}

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Alleen POST' }), { status: 405, headers });

  const auth = req.headers.get('Authorization');
  const verwacht = 'Bearer ' + (Netlify.env.get('ADMIN_TOKEN') || 'trovai2026');
  if (auth !== verwacht) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  const BUFFER_KEY = Netlify.env.get('BUFFER_API_KEY');
  if (!BUFFER_KEY) return new Response(JSON.stringify({ error: 'BUFFER_API_KEY ontbreekt' }), { status: 500, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const { text: eigenTekst, type = 'market_insight', topic = 'cotedazur', scheduled_at, preview = false } = body;

    const postTekst = eigenTekst || await genereer(type, topic);

    if (preview) {
      return new Response(JSON.stringify({ success: true, text: postTekst, gegenereerd: !eigenTekst }), { status: 200, headers });
    }

    const profiel = await haalProfiel(BUFFER_KEY);
    const resultaat = await stuurNaarBuffer(BUFFER_KEY, profiel.id, postTekst, scheduled_at);
    const update = resultaat.updates?.[0];

    return new Response(JSON.stringify({
      success: true,
      buffer_id: update?.id,
      scheduled_at: update?.scheduled_at,
      text: postTekst,
      gegenereerd: !eigenTekst,
    }), { status: 200, headers });

  } catch (fout) {
    console.error('[schedule-buffer-post] Fout:', fout.message);
    return new Response(JSON.stringify({ error: fout.message }), { status: 500, headers });
  }
};

export const config = { path: '/api/schedule-buffer-post' };
