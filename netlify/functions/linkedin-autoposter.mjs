// ============================================================
// Trovai LinkedIn Autoposter
// Scheduled: maandag en donderdag om 07:00 UTC (09:00 NL)
// 
// NIVEAU 1: AI genereert verse post op basis van thema-rotatie
// NIVEAU 2: Haalt actuele listings + nieuws op voor context
// NIVEAU 3: SEMrush keyword data voor trending zoektermen
// ============================================================

// Thema-rotatie — roteert automatisch elke post
const THEMAS = [
  { slug: 'intro',         titel: 'Wat is Trovai',              focus: 'Leg uit wat Trovai is en hoe het werkt. Persoonlijk, vanuit Roelof zijn perspectief. Waarom hij het gebouwd heeft.' },
  { slug: 'off-market',    titel: 'Off-market vastgoed',        focus: 'Leg uit wat off-market betekent op de Côte d\'Azur. Waarom de mooiste villa\'s nooit publiek verschijnen. Hoe Trovai daar toegang toe heeft.' },
  { slug: 'cannes',        titel: 'Cannes vastgoedmarkt',       focus: 'Concreet over de Cannes vastgoedmarkt. Prijzen, wijken, waarom het een stabiele investering is.' },
  { slug: 'curacao',       titel: 'Curaçao als investering',    focus: 'Waarom Curaçao onderschat wordt als vastgoedmarkt voor Nederlanders. Rendement, rechtssysteem, prijs.' },
  { slug: 'koopproces',    titel: 'Koopproces Frankrijk',       focus: 'Praktisch: hoe werkt een vastgoedkoop in Frankrijk. Compromis, notaris, kosten. Zonder jargon.' },
  { slug: 'gratis',        titel: 'Hoe Trovai geld verdient',   focus: 'Transparant uitleggen waarom Trovai gratis is voor kopers. Het commissiemodel. Alignement van belangen.' },
  { slug: 'nice',          titel: 'Nice vastgoedmarkt',         focus: 'Nice als alternatief voor Cannes. Betaalbaarder, eigen luchthaven, levendig het hele jaar.' },
  { slug: 'saint-tropez',  titel: 'Saint-Tropez en omgeving',  focus: 'De Golf van Saint-Tropez. Ramatuelle, Gassin. Zomer vs jaar-rond leven. Prijzen en alternatieven.' },
  { slug: 'fiscaal',       titel: 'Belasting tweede woning',    focus: 'Hoe werkt belasting op een Franse tweede woning vanuit Nederland. Box 3, verdrag, taxe foncière. Praktisch en eerlijk.' },
  { slug: 'ai-matching',   titel: 'Hoe AI-matching werkt',     focus: 'Technisch maar toegankelijk: hoe matcht de Trovai AI jouw profiel aan 5.000+ woningen. Wat maakt het anders dan zoeken op Funda.' },
  { slug: 'mougins',       titel: 'Achterland Côte d\'Azur',   focus: 'Mougins, Valbonne, Grasse. Rust, privacy, 15 min van de kust. Meer voor je geld dan direct aan zee.' },
  { slug: 'monaco',        titel: 'Monaco en omgeving',        focus: 'Monaco en alternatieven zoals Roquebrune, Cap-Martin, Menton. Prestige zonder Monaco-prijzen.' },
  { slug: 'hypotheek',     titel: 'Hypotheek in Frankrijk',    focus: 'Kunnen Nederlanders een hypotheek krijgen in Frankrijk? Ja. Hoe werkt dat. Huidige rentes, voorwaarden.' },
  { slug: 'cap-antibes',   titel: 'Cap d\'Antibes',            focus: 'Het meest exclusieve schiereiland van de Rivièra. Off-market markt, privacy, waarom het uniek is.' },
  { slug: 'eerlijk',       titel: 'Eerlijk over Trovai',       focus: 'Wat Trovai WEL doet en NIET doet. Transparant en zonder hype. Wat je mag verwachten.' },
];

async function bufferGQL(key, query, variables = {}) {
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ query, variables })
  });
  return r.json();
}

// NIVEAU 2: Haal actuele listings op van trovai.nl
async function getActueleListings() {
  try {
    const r = await fetch('https://trovai.nl', { signal: AbortSignal.timeout(5000) });
    const html = await r.text();
    // Extract listing namen en prijzen uit de HTML
    const matches = [...html.matchAll(/class="listing[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
    const listings = [];
    const prijsMatches = [...html.matchAll(/€\s*([\d.,]+(?:\.\d{3})*)/g)];
    if (prijsMatches.length > 0) {
      listings.push(...prijsMatches.slice(0, 3).map(m => '€ ' + m[1]));
    }
    return listings.length ? `Actueel aanbod op trovai.nl: ${listings.join(', ')}` : '';
  } catch {
    return '';
  }
}

// NIVEAU 2: Haal vastgoednieuws op via RSS
async function getVastgoedNieuws() {
  try {
    const feeds = [
      'https://www.fnaim.fr/feed/',
      'https://www.propertyweek.com/rss.aspx',
    ];
    for (const feed of feeds) {
      const r = await fetch(feed, { signal: AbortSignal.timeout(4000) });
      const xml = await r.text();
      const items = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].slice(1, 3);
      if (items.length) {
        return 'Recent vastgoednieuws: ' + items.map(m => m[1]).join(' | ');
      }
    }
    return '';
  } catch {
    return '';
  }
}

// NIVEAU 3: SEMrush keyword data
async function getSEMrushData(semrushKey) {
  if (!semrushKey || semrushKey === 'placeholder') return '';
  try {
    // SEMrush API: top keywords voor onze niche in NL
    const keywords = ['villa kopen cote dazur', 'huis kopen frankrijk', 'vastgoed curacao'];
    const results = [];
    for (const kw of keywords.slice(0, 2)) {
      const url = `https://api.semrush.com/?type=phrase_this&key=${semrushKey}&phrase=${encodeURIComponent(kw)}&database=nl&export_columns=Ph,Nq,Cp,Co&display_limit=1`;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const text = await r.text();
      const lines = text.trim().split('\n');
      if (lines[1]) {
        const cols = lines[1].split(';');
        if (cols[1]) results.push(`"${kw}": ${parseInt(cols[1]).toLocaleString('nl')} zoekopdrachten/maand`);
      }
    }
    return results.length ? 'SEMrush zoekvolume NL: ' + results.join(' | ') : '';
  } catch {
    return '';
  }
}

// Bepaal welk thema vandaag aan de beurt is
async function bepaalThema(bufferKey, channelId) {
  // Haal laatste 30 posts op om te zien welke themas al gebruikt zijn
  const query = `query { channels(ids: ["${channelId}"]) { posts(first: 30) { edges { node { text } } } } }`;
  try {
    const data = await bufferGQL(bufferKey, query);
    const posts = data?.data?.channels?.[0]?.posts?.edges || [];
    const gebruikteThemas = new Set();
    for (const { node } of posts) {
      for (const thema of THEMAS) {
        if (node.text && node.text.toLowerCase().includes(thema.slug.replace('-', ' '))) {
          gebruikteThemas.add(thema.slug);
        }
      }
    }
    // Kies het eerste thema dat nog niet recent gebruikt is
    const beschikbaar = THEMAS.filter(t => !gebruikteThemas.has(t.slug));
    return beschikbaar.length > 0 ? beschikbaar[0] : THEMAS[posts.length % THEMAS.length];
  } catch {
    return THEMAS[Math.floor(Math.random() * THEMAS.length)];
  }
}

// NIVEAU 1: Genereer post via Claude API
async function genereerPost(thema, context) {
  const anthropicKey = Netlify.env.get('ANTHROPIC_API_KEY');
  
  const systemPrompt = `Je bent Roelof Methorst, oprichter van Trovai (trovai.nl). Je schrijft LinkedIn posts in het Nederlands voor Nederlandse en Belgische kopers van luxe vastgoed op de Côte d'Azur en Curaçao.

STIJLREGELS:
- Schrijf altijd in de ik-vorm, persoonlijk en direct
- Geen hype, geen superlatieven, geen "geweldig" of "fantastisch"
- Concrete feiten en cijfers waar mogelijk
- Eindig altijd met een link naar trovai.nl of een specifieke pagina
- Maximaal 1.300 tekens (LinkedIn limiet)
- Gebruik witregels voor leesbaarheid
- 3-5 relevante hashtags onderaan
- Noem NOOIT Living on the Côte d'Azur of andere partnernamen
- Trovai is het enige merk

FORMAT:
- Sterke opening (eerste regel bepaalt of mensen doorklikken)
- Kernboodschap in 3-5 alinea's
- Concrete oproep tot actie
- Hashtags`;

  const userPrompt = `Schrijf een LinkedIn post over het thema: "${thema.titel}"

Focus: ${thema.focus}

${context.listings ? `\nActuele context:\n${context.listings}` : ''}
${context.nieuws ? `\n${context.nieuws}` : ''}
${context.semrush ? `\n${context.semrush}` : ''}

Schrijf een complete, publiceerklare LinkedIn post.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt
    })
  });
  
  const data = await r.json();
  return data.content?.[0]?.text || null;
}

// Publiceer post naar Buffer
async function publiceerNaarBuffer(bufferKey, channelId, tekst) {
  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess { post { id text } }
        ... on MutationError { message }
      }
    }`;
  
  // Plan voor volgende maandag of donderdag om 09:00 NL tijd
  const now = new Date();
  const dag = now.getDay(); // 0=zo, 1=ma, ..., 4=do
  let daysUntilNext;
  if (dag <= 1) daysUntilNext = 1 - dag; // volgende maandag
  else if (dag <= 4) daysUntilNext = 4 - dag; // volgende donderdag  
  else daysUntilNext = 8 - dag; // maandag volgende week
  
  const postDate = new Date(now);
  postDate.setDate(now.getDate() + Math.max(daysUntilNext, 1));
  postDate.setHours(7, 0, 0, 0); // 07:00 UTC = 09:00 NL

  const data = await bufferGQL(bufferKey, mutation, {
    input: {
      text: tekst,
      channelId,
      schedulingType: 'automatic',
      mode: 'customScheduled',
      dueAt: postDate.toISOString()
    }
  });
  
  return data?.data?.createPost;
}

// Log resultaat naar Netlify blob voor monitoring
async function logResultaat(log) {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('autoposter-logs');
    const key = new Date().toISOString().slice(0, 10);
    const bestaand = await store.get(key, { type: 'json' }) || [];
    bestaand.push(log);
    await store.set(key, JSON.stringify(bestaand));
  } catch {
    console.log('Log:', JSON.stringify(log));
  }
}

// HOOFDFUNCTIE
export default async (req) => {
  const bufferKey = Netlify.env.get('BUFFER_API_KEY');
  const channelId = Netlify.env.get('BUFFER_CHANNEL_ID');
  const semrushKey = Netlify.env.get('SEMRUSH_API_KEY') || 'placeholder';
  
  if (!bufferKey || !channelId) {
    console.error('BUFFER_API_KEY of BUFFER_CHANNEL_ID ontbreekt');
    return;
  }

  console.log('Trovai autoposter gestart:', new Date().toISOString());

  try {
    // Bepaal thema
    const thema = await bepaalThema(bufferKey, channelId);
    console.log('Thema geselecteerd:', thema.titel);

    // NIVEAU 2: Verzamel context parallel
    const [listings, nieuws, semrush] = await Promise.all([
      getActueleListings(),
      getVastgoedNieuws(),
      getSEMrushData(semrushKey)
    ]);
    
    console.log('Context:', { listings: !!listings, nieuws: !!nieuws, semrush: !!semrush });

    // NIVEAU 1: Genereer post via Claude
    const tekst = await genereerPost(thema, { listings, nieuws, semrush });
    
    if (!tekst) {
      console.error('Post generatie mislukt');
      await logResultaat({ datum: new Date().toISOString(), succes: false, fout: 'Generatie mislukt', thema: thema.slug });
      return;
    }

    console.log('Post gegenereerd, lengte:', tekst.length);

    // Publiceer naar Buffer
    const resultaat = await publiceerNaarBuffer(bufferKey, channelId, tekst);
    
    const succes = !!resultaat?.post?.id;
    console.log('Buffer resultaat:', succes ? 'ingepland: ' + resultaat.post.id : resultaat?.message);

    // Log voor monitoring
    await logResultaat({
      datum: new Date().toISOString(),
      thema: thema.slug,
      thematitel: thema.titel,
      succes,
      postId: resultaat?.post?.id,
      postLengte: tekst.length,
      contextGebruikt: { listings: !!listings, nieuws: !!nieuws, semrush: !!semrush },
      fout: succes ? null : resultaat?.message
    });

  } catch (err) {
    console.error('Autoposter fout:', err.message);
    await logResultaat({ datum: new Date().toISOString(), succes: false, fout: err.message });
  }
};

// Maandag 07:00 UTC en donderdag 07:00 UTC
export const config = {
  schedule: '0 7 * * 1,4'
};
