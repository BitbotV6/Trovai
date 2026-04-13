// Trovai · generate-buffer-posts.mjs
//
// Volledig automatische LinkedIn content engine voor Trovai company page.
// Draait 3x per week: woensdag 16:00, donderdag 17:00, vrijdag 15:00 CET.
//
// POSTING REGELS (LinkedIn algoritme 2026):
//   - Geen externe links in post body (LinkedIn onderdrukt bereik)
//   - Link gaat altijd als eerste comment
//   - 3x per week max (niet dagelijks = hogere engagement per post)
//   - Optimale tijden: Wo 16:00, Do 17:00, Vr 15:00 CET

const MARKTDATA = {
  cotedazur: {
    hypotheekrente: '3,04%',
    hypotheekrente_looptijd: '10 jaar vast',
    prijsstijging_5jaar: '20%',
    bron: 'Knight Frank 2024',
    verhuur_opbrengst: '8.000 tot 25.000 euro per maand',
    verhuur_seizoen: 'mei en september',
    offmarket_percentage: '40%',
    offmarket_drempel: 'boven 2 miljoen euro',
    topgebieden: ['Nice', 'Cannes', 'Antibes', 'Mougins', 'Monaco-corridor'],
    fiscale_structuur: 'SCI (familiale holding) voor erfbelastingoptimalisatie',
    commissie: 'verkopende partij betaalt, koper betaalt niets aan Trovai',
    knight_frank: 'top 5 prime residentieel wereldwijd 2024',
  },
  curacao: {
    rendement: '6 tot 8 procent netto via Airbnb',
    instap_villa: 'vanaf 200.000 euro',
    instap_appartement: 'vanaf 150.000 euro',
    airbnb_voorbeeld: '22.000 euro per jaar (villa Jan Thiel)',
    belasting: 'geen vermogensbelasting',
    klimaat: '365 dagen zon, buiten de orkaanzone',
    rechtssysteem: 'Nederlands rechtssysteem',
    vluchtduur: '9 uur vanaf Amsterdam',
  },
};

const MATRIX = [
  [
    { type: 'market_insight',    topic: 'cotedazur', link: null },
    { type: 'roi_berekening',    topic: 'curacao',   link: null },
    { type: 'mythe',             topic: 'cotedazur', link: null },
    { type: 'marktupdate',       topic: 'both',      link: null },
    { type: 'vergelijking',      topic: 'both',      link: null },
  ],
  [
    { type: 'aankoopproces',     topic: 'cotedazur', link: { tekst: 'Meer weten? Vind jouw woning op trovai.nl', url: 'https://trovai.nl' } },
    { type: 'market_insight',    topic: 'curacao',   link: null },
    { type: 'roi_berekening',    topic: 'cotedazur', link: null },
    { type: 'mythe',             topic: 'curacao',   link: null },
    { type: 'verhuur_strategie', topic: 'both',      link: { tekst: 'Bekijk het aanbod op trovai.nl', url: 'https://trovai.nl' } },
  ],
  [
    { type: 'thought_leadership', topic: 'both',      link: null },
    { type: 'aankoopproces',      topic: 'curacao',   link: { tekst: 'Bekijk het aanbod op trovai.nl', url: 'https://trovai.nl' } },
    { type: 'marktupdate',        topic: 'cotedazur', link: null },
    { type: 'vergelijking',       topic: 'cotedazur', link: null },
    { type: 'thought_leadership', topic: 'curacao',   link: null },
  ],
];

const DUE_AT_UTC = { 3: 14, 4: 15, 5: 13 };

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
Emdash
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

function isoWeekNummer(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jaarStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - jaarStart) / 86400000) + 1) / 7);
}

function bepaalSlot() {
  const nu = new Date();
  const dag = nu.getUTCDay();
  const dagIndex = { 3: 0, 4: 1, 5: 2 };
  if (!(dag in dagIndex)) return null;
  const rotatieIndex = isoWeekNummer(nu) % 5;
  return { dagIndex: dagIndex[dag], utcDag: dag, content: MATRIX[dagIndex[dag]][rotatieIndex], rotatieIndex };
}

function bouwDueAt(utcDag) {
  const nu = new Date();
  const uur = DUE_AT_UTC[utcDag];
  const dueAt = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate(), uur, 0, 0));
  if (dueAt <= nu) return null;
  return dueAt.toISOString();
}

async function genereerPost(content) {
  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY niet geconfigureerd');
  const marktData = content.topic === 'both' ? MARKTDATA : { [content.topic]: MARKTDATA[content.topic] };
  const seizoen = (() => {
    const m = new Date().getMonth() + 1;
    if (m >= 4 && m <= 6) return 'lente en vroeg zomer, begin koopseizoen';
    if (m >= 7 && m <= 8) return 'hoogzomer, piek verhuurseizoen';
    if (m >= 9 && m <= 10) return 'nazomer, rustig koopmoment';
    return 'winter, onderhoud en voorbereiding';
  })();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20251022',
      max_tokens: 900,
      system: SYSTEEM_PROMPT,
      messages: [{ role: 'user', content: `Schrijf een LinkedIn post voor Trovai.\nTYPE: ${content.type}\nINSTRUCTIE: ${INSTRUCTIES[content.type]}\nMARKTDATA:\n${JSON.stringify(marktData, null, 2)}\nCONTEXT: Seizoen ${seizoen}, doelgroep Nederlanders en Belgen budget 150.000 tot 5 miljoen euro.\n${content.link ? 'Link komt in eerste comment, NIET in de post.' : 'Geen link.'}\nAlleen de post tekst, geen aanhalingstekens of introductie.` }],
    }),
  });
  if (!res.ok) { const f = await res.text(); throw new Error(`Claude ${res.status}: ${f}`); }
  const data = await res.json();
  return data.content[0].text.trim();
}

function valideer(tekst) {
  const fouten = [];
  if (tekst.includes('—')) fouten.push('emdash');
  if (tekst.includes('*')) fouten.push('asterisk');
  if (/in de huidige markt/i.test(tekst)) fouten.push('AI-cliche');
  if (tekst.includes('http://') || tekst.includes('https://')) fouten.push('externe link in post');
  const emojis = (tekst.match(/p{Emoji_Presentation}/gu) || []).length;
  const hashtags = (tekst.match(/#w+/g) || []).length;
  const woorden = tekst.split(/s+/).length;
  if (emojis > 2) fouten.push(emojis + ' emoji');
  if (hashtags > 5) fouten.push(hashtags + ' hashtags');
  if (woorden > 320) fouten.push('te lang ' + woorden);
  if (woorden < 80) fouten.push('te kort ' + woorden);
  return fouten;
}

async function planIn(bufferKey, profielId, tekst, dueAt) {
  const params = new URLSearchParams();
  params.append('text', tekst);
  params.append('profile_ids[]', profielId);
  params.append('scheduled_at', dueAt);
  const res = await fetch('https://api.bufferapp.com/1/updates/create.json', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bufferKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) { const f = await res.text(); throw new Error(`Buffer ${res.status}: ${f}`); }
  return res.json();
}

async function haalProfiel(bufferKey) {
  const res = await fetch('https://api.bufferapp.com/1/profiles.json', { headers: { Authorization: `Bearer ${bufferKey}` } });
  if (!res.ok) throw new Error(`Buffer profiles ${res.status}`);
  const profielen = await res.json();
  return profielen.find(p => p.service === 'linkedin_page') ||
         profielen.find(p => p.service === 'linkedin') ||
         (() => { throw new Error('Geen LinkedIn profiel in Buffer'); })();
}

async function slaCommentOp(updateId, link) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('buffer-comments');
    await store.set(`comment_${updateId}`, JSON.stringify({
      updateId, tekst: `${link.tekst}\n${link.url}`, url: link.url,
      aangemaakt: new Date().toISOString(), status: 'pending',
    }));
  } catch (e) { console.warn('[Buffer] Comment opslaan mislukt:', e.message); }
}

export default async (req) => {
  const BUFFER_KEY = Netlify.env.get('BUFFER_API_KEY');
  if (!BUFFER_KEY) { console.error('[Buffer] BUFFER_API_KEY ontbreekt'); return; }
  const slot = bepaalSlot();
  if (!slot) { console.log('[Buffer] Geen posting dag (alleen wo/do/vr)'); return; }
  const dueAt = bouwDueAt(slot.utcDag);
  if (!dueAt) { console.log('[Buffer] Posting tijd al voorbij voor vandaag'); return; }
  const dagLabel = ['wo', 'do', 'vr'][slot.dagIndex];
  console.log(`[Buffer] Start ${dagLabel} type:${slot.content.type} topic:${slot.content.topic} rotatie:${slot.rotatieIndex}`);
  try {
    const postTekst = await genereerPost(slot.content);
    const fouten = valideer(postTekst);
    if (fouten.length) console.warn(`[Buffer] Validatie: ${fouten.join(', ')}`);
    const profiel = await haalProfiel(BUFFER_KEY);
    console.log(`[Buffer] Profiel: ${profiel.formatted_username} (${profiel.service})`);
    const resultaat = await planIn(BUFFER_KEY, profiel.id, postTekst, dueAt);
    const updateId = resultaat.updates?.[0]?.id;
    console.log(`[Buffer] Ingepland ID:${updateId} tijd:${dueAt}`);
    console.log(`[Buffer] Preview: ${postTekst.substring(0, 120)}...`);
    if (slot.content.link && updateId) await slaCommentOp(updateId, slot.content.link);
  } catch (fout) {
    console.error('[Buffer] FOUT:', fout.message);
  }
};

export const config = { schedule: '0 14 * * 3,4,5' };
