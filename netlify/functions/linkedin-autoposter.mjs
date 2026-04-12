// ============================================================
// Trovai LinkedIn Autoposter v2.0
// Scheduled: maandag en donderdag om 07:00 UTC (09:00 NL)
//
// NIVEAU 1: Claude genereert verse post op basis van actuele context
// NIVEAU 2: Actuele listings + vastgoednieuws als input
// NIVEAU 3: SEMrush keyword data voor trending zoektermen
//
// Post wordt DIRECT gepubliceerd — geen queue, geen planning vooraf.
// Elke post is gebaseerd op wat er op dat moment speelt in de markt.
// ============================================================

const THEMAS = [
  { slug: 'intro',        titel: 'Wat is Trovai',             focus: 'Leg uit wat Trovai is en hoe het werkt. Persoonlijk en direct. Waarom het gebouwd is.' },
  { slug: 'off-market',   titel: 'Off-market vastgoed',       focus: 'Wat off-market betekent op de Côte d\'Azur. Waarom de mooiste villa\'s nooit publiek verschijnen. Hoe Trovai daar toegang toe heeft.' },
  { slug: 'cannes',       titel: 'Cannes vastgoedmarkt',      focus: 'Concreet over Cannes. Actuele prijzen, wijken, waarom het een stabiele investering is.' },
  { slug: 'curacao',      titel: 'Curaçao als investering',   focus: 'Waarom Curaçao onderschat wordt. Rendement, rechtssysteem, prijs. Gebruik actuele marktdata als die beschikbaar is.' },
  { slug: 'koopproces',   titel: 'Koopproces Frankrijk',      focus: 'Praktisch: hoe werkt een vastgoedkoop in Frankrijk. Compromis, notaris, kosten. Concreet en zonder jargon.' },
  { slug: 'gratis',       titel: 'Hoe Trovai geld verdient',  focus: 'Transparant uitleggen waarom Trovai gratis is voor kopers. Het commissiemodel. Alignement van belangen.' },
  { slug: 'nice',         titel: 'Nice vastgoedmarkt',        focus: 'Nice als alternatief voor Cannes. Betaalbaarder, eigen luchthaven, levendig het hele jaar. Actuele marktinfo verwerken.' },
  { slug: 'saint-tropez', titel: 'Golf van Saint-Tropez',     focus: 'Saint-Tropez, Ramatuelle, Gassin. Zomer vs jaar-rond. Prijzen en alternatieven.' },
  { slug: 'fiscaal',      titel: 'Belasting tweede woning',   focus: 'Hoe werkt belasting op een Franse tweede woning vanuit Nederland. Box 3, verdrag, taxe foncière.' },
  { slug: 'ai-matching',  titel: 'Hoe AI-matching werkt',    focus: 'Technisch maar toegankelijk: hoe matcht de Trovai AI jouw profiel aan 5.000+ woningen.' },
  { slug: 'mougins',      titel: 'Achterland Côte d\'Azur',  focus: 'Mougins, Valbonne, Grasse. Rust, privacy, 15 min van de kust. Meer voor je geld dan direct aan zee.' },
  { slug: 'monaco',       titel: 'Monaco en omgeving',       focus: 'Monaco en alternatieven: Roquebrune, Cap-Martin, Menton. Prestige zonder Monaco-prijzen.' },
  { slug: 'hypotheek',    titel: 'Hypotheek in Frankrijk',   focus: 'Kunnen Nederlanders een hypotheek krijgen in Frankrijk? Ja. Hoe werkt dat. Huidige rentes.' },
  { slug: 'cap-antibes',  titel: 'Cap d\'Antibes',           focus: 'Het meest exclusieve schiereiland van de Rivièra. Off-market markt, privacy, waarom het uniek is.' },
  { slug: 'eerlijk',      titel: 'Eerlijk over Trovai',      focus: 'Wat Trovai WEL doet en NIET doet. Transparant, zonder hype. Wat je mag verwachten.' },
];

async function bufferGQL(key, query, variables = {}) {
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ query, variables })
  });
  return r.json();
}

// NIVEAU 2: Haal actuele listings van trovai.nl
async function getActueleListings() {
  try {
    const r = await fetch('https://trovai.nl', { signal: AbortSignal.timeout(5000) });
    const html = await r.text();
    const prijsMatches = [...html.matchAll(/€\s*([\d.,]+(?:\.\d{3})*)/g)];
    const listings = prijsMatches.slice(0, 4).map(m => '€ ' + m[1]);
    return listings.length ? 'Actueel aanbod prijzen op trovai.nl: ' + listings.join(' · ') : '';
  } catch { return ''; }
}

// NIVEAU 2: Haal actueel vastgoednieuws
async function getVastgoedNieuws() {
  try {
    const r = await fetch('https://www.propertyweek.com/rss.aspx', { signal: AbortSignal.timeout(4000) });
    const xml = await r.text();
    const items = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].slice(1, 4);
    if (items.length) return 'Recent vastgoednieuws: ' + items.map(m => m[1]).join(' | ');
    return '';
  } catch { return ''; }
}

// NIVEAU 3: SEMrush keyword data
async function getSEMrushData(semrushKey) {
  if (!semrushKey || semrushKey === 'placeholder') return '';
  try {
    const keywords = ['villa kopen cote dazur', 'huis kopen frankrijk'];
    const results = [];
    for (const kw of keywords) {
      const url = `https://api.semrush.com/?type=phrase_this&key=${semrushKey}&phrase=${encodeURIComponent(kw)}&database=nl&export_columns=Ph,Nq&display_limit=1`;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const text = await r.text();
      const lines = text.trim().split('\n');
      if (lines[1]) {
        const cols = lines[1].split(';');
        if (cols[1] && parseInt(cols[1]) > 0) {
          results.push(`"${kw}": ${parseInt(cols[1]).toLocaleString('nl')} zoekopdrachten/maand`);
        }
      }
    }
    return results.length ? 'Actueel zoekvolume NL (SEMrush): ' + results.join(' | ') : '';
  } catch { return ''; }
}

// Bepaal thema op basis van dag van de week (roteert automatisch)
function bepaalThema() {
  const now = new Date();
  // Gebruik weeknummer × dag als index zodat het consistent roteert
  const weekNr = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const dagNr = now.getDay(); // 1=ma, 4=do
  const index = (weekNr * 2 + (dagNr === 1 ? 0 : 1)) % THEMAS.length;
  return THEMAS[index];
}

// NIVEAU 1: Genereer post via Claude
async function genereerPost(thema, context) {
  const anthropicKey = Netlify.env.get('ANTHROPIC_API_KEY');

  const vandaag = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const system = `Je bent de stem van Trovai (trovai.nl) op LinkedIn. Je schrijft in het Nederlands voor Nederlandse en Belgische kopers van luxe vastgoed op de Côte d'Azur en Curaçao.

STIJLREGELS:
- Schrijf vanuit Trovai als merk, niet vanuit een persoon ("ik")
- Geen hype, geen superlatieven
- Concrete feiten en cijfers waar mogelijk
- Verwerk actuele marktdata als die beschikbaar is — maak de post tijdsgebonden
- Eindig met een link naar trovai.nl of een specifieke pagina
- Maximaal 1.200 tekens
- Gebruik witregels voor leesbaarheid
- 3-5 relevante hashtags onderaan
- Noem GEEN partnernamen of derden — alleen Trovai als merk

VANDAAG: ${vandaag}`;

  const prompt = `Schrijf een LinkedIn post voor vandaag over: "${thema.titel}"

Focus: ${thema.focus}

${context.listings ? `\nActuele context:\n${context.listings}` : ''}
${context.nieuws ? `\n${context.nieuws}` : ''}
${context.semrush ? `\nZoekdata: ${context.semrush}` : ''}

Schrijf een complete, direct publiceerbare LinkedIn post. Verwerk de actuele context waar relevant.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await r.json();
  return data.content?.[0]?.text || null;
}

// Publiceer DIRECT naar LinkedIn via Buffer (geen scheduling)
async function publiceerDirect(bufferKey, channelId, tekst) {
  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id text } }
        ... on MutationError { message }
      }
    }`;

  return bufferGQL(bufferKey, mutation, {
    input: {
      text: tekst,
      channelId,
      schedulingType: 'automatic',
      mode: 'now'  // DIRECT publiceren — geen queue, geen planning
    }
  });
}

// Log naar Netlify Blobs
async function logResultaat(log) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('autoposter-logs');
    const key = new Date().toISOString().slice(0, 10);
    let bestaand = [];
    try { bestaand = await store.get(key, { type: 'json' }) || []; } catch {}
    if (!Array.isArray(bestaand)) bestaand = [];
    bestaand.push(log);
    await store.set(key, JSON.stringify(bestaand));
  } catch(e) {
    console.log('Log resultaat:', JSON.stringify(log));
  }
}

// HOOFDFUNCTIE
export default async (req) => {
  const bufferKey = Netlify.env.get('BUFFER_API_KEY');
  const channelId = Netlify.env.get('BUFFER_CHANNEL_ID');
  const semrushKey = Netlify.env.get('SEMRUSH_API_KEY') || '';

  if (!bufferKey || !channelId) {
    console.error('BUFFER_API_KEY of BUFFER_CHANNEL_ID ontbreekt');
    return;
  }

  const startTijd = new Date().toISOString();
  console.log('Trovai autoposter v2 gestart:', startTijd);

  try {
    // Bepaal thema op basis van datum
    const thema = bepaalThema();
    console.log('Thema:', thema.titel);

    // NIVEAU 2+3: Verzamel actuele context parallel
    const [listings, nieuws, semrush] = await Promise.all([
      getActueleListings(),
      getVastgoedNieuws(),
      getSEMrushData(semrushKey)
    ]);

    console.log('Context opgehaald:', {
      listings: listings ? listings.slice(0, 50) : 'geen',
      nieuws: nieuws ? 'ja' : 'geen',
      semrush: semrush ? 'ja' : 'geen'
    });

    // NIVEAU 1: Genereer actuele post
    const tekst = await genereerPost(thema, { listings, nieuws, semrush });

    if (!tekst) {
      console.error('Post generatie mislukt');
      await logResultaat({ datum: startTijd, succes: false, fout: 'Generatie mislukt', thema: thema.slug });
      return;
    }

    console.log('Post gegenereerd (' + tekst.length + ' tekens)');

    // Publiceer DIRECT
    const data = await publiceerDirect(bufferKey, channelId, tekst);
    const resultaat = data?.data?.createPost;
    const succes = !!resultaat?.post?.id;

    console.log('Gepubliceerd:', succes ? resultaat.post.id : resultaat?.message);

    await logResultaat({
      datum: startTijd,
      thema: thema.slug,
      thematitel: thema.titel,
      succes,
      postId: resultaat?.post?.id || null,
      postLengte: tekst.length,
      directGepubliceerd: true,
      context: { listings: !!listings, nieuws: !!nieuws, semrush: !!semrush },
      fout: succes ? null : resultaat?.message
    });

  } catch (err) {
    console.error('Autoposter fout:', err.message);
    await logResultaat({ datum: startTijd, succes: false, fout: err.message });
  }
};

// Maandag 07:00 UTC (09:00 NL) en donderdag 07:00 UTC
export const config = {
  schedule: '0 7 * * 1,4'
};
