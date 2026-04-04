// Trovai · send-pdf-email.mjs
// Stuurt een rijke HTML email met de geselecteerde listings naar de koper
// Resend ondersteunt geen PDF bijlagen via server-side generatie zonder headless browser,
// dus we sturen een prachtige HTML email die eruitziet als een PDF-rapport.
// De koper kan dit opslaan/printen als PDF vanuit zijn email client.

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const { name, email, destination, budget, property_type, area, listings } = await req.json();

    const RESEND_KEY = Netlify.env.get('RESEND_API_KEY');
    if (!RESEND_KEY) throw new Error('RESEND_API_KEY niet geconfigureerd');
    if (!email) throw new Error('Geen emailadres opgegeven');

    const destLabel = destination === 'cotedazur' ? "Côte d'Azur" : destination === 'curacao' ? 'Curaçao' : 'Côte d\'Azur & Curaçao';
    const typeLabel = { villa: 'Villa', apartment: 'Appartement', estate: 'Domaine / Estate', open: 'Alle types' }[property_type] || property_type;
    const areaLabel = { nice: 'Nice & omgeving', cannes: 'Cannes & Antibes', monaco: 'Monaco & Menton', hinterland: 'Hinterland' }[area] || area || destLabel;

    const listingsHtml = (listings || []).map((l, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e8e4dc;border-radius:4px;overflow:hidden;background:#ffffff;">
        <tr>
          ${l.image ? `<td width="200" valign="top" style="padding:0;vertical-align:top;">
            <img src="${l.image}" alt="${l.name}" width="200" height="150" style="display:block;object-fit:cover;width:200px;height:150px;">
          </td>` : ''}
          <td valign="top" style="padding:20px 24px;vertical-align:top;">
            <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#C8A96A;margin-bottom:6px;font-family:Georgia,serif;">
              ${l.city || destLabel} · ${l.category || typeLabel} · Match ${i + 1} van ${listings.length}
            </div>
            <div style="font-family:Georgia,serif;font-size:17px;color:#1a1a18;margin-bottom:8px;line-height:1.35;">${l.name}</div>
            <div style="font-size:20px;font-family:Georgia,serif;color:#C8A96A;margin-bottom:10px;">${l.price_formatted}</div>
            ${(l.beds || l.surface) ? `<div style="font-size:12px;color:#888;margin-bottom:10px;">${[l.beds, l.surface].filter(Boolean).join(' · ')}</div>` : ''}
            ${l.description ? `<div style="font-size:13px;color:#555;line-height:1.65;margin-bottom:14px;">${l.description.substring(0, 140)}${l.description.length > 140 ? '...' : ''}</div>` : ''}
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#C8A96A;border-radius:2px;">
                <a href="https://trovai.nl/listing/${l.id}" style="display:inline-block;padding:9px 20px;font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#080A0F;text-decoration:none;">Bekijk details →</a>
              </td>
            </tr></table>
          </td>
        </tr>
      </table>`).join('');

    const curacaoHtml = destination === 'curacao' ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e8e4dc;border-radius:4px;background:#f8f7f4;padding:24px;">
        <tr><td style="padding:24px;text-align:center;">
          <div style="font-family:Georgia,serif;font-size:16px;color:#1a1a18;margin-bottom:8px;">Uw Curaçao selectie volgt persoonlijk</div>
          <div style="font-size:13px;color:#888;line-height:1.65;">Onze Curaçao partner At Home Curaçao stelt binnen 24 uur een persoonlijke selectie samen op basis van uw profiel.</div>
        </td></tr>
      </table>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Uw Trovai Vastgoedselectie</title></head>
<body style="margin:0;padding:0;background:#f0ede6;font-family:Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede6;padding:40px 20px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

  <tr><td style="background:#080A0F;padding:36px 48px;border-radius:4px 4px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><span style="font-family:Georgia,serif;font-size:24px;font-style:italic;color:#ffffff;">Trovai</span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#C8A96A;margin-left:2px;vertical-align:middle;margin-bottom:4px;"></span></td>
      <td align="right"><span style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Persoonlijke Vastgoedselectie</span></td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:40px 48px;">
    <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#C8A96A;margin-bottom:14px;">Uw Trovai AI Matching Rapport</div>
    <div style="font-family:Georgia,serif;font-size:26px;color:#1a1a18;margin-bottom:16px;line-height:1.25;">Goedemiddag, ${name || 'geachte zoeker'}</div>
    <div style="font-size:14px;color:#666;line-height:1.8;margin-bottom:28px;">
      Op basis van uw profiel heeft Trovai AI de beste matches geselecteerd uit meer dan 2.800 woningen op de ${destLabel}.
      Hieronder vindt u uw persoonlijke selectie — samengesteld op basis van uw wensen.
    </div>
    <table cellpadding="0" cellspacing="0" style="background:#f8f7f4;border:1px solid #e8e4dc;border-radius:3px;width:100%;"><tr>
      <td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Bestemming</td>
          <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Type</td>
          <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Budget</td>
          <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Regio</td>
        </tr><tr>
          <td style="font-size:13px;color:#1a1a18;font-weight:600;padding-top:4px;">${destLabel}</td>
          <td style="font-size:13px;color:#1a1a18;font-weight:600;padding-top:4px;">${typeLabel}</td>
          <td style="font-size:13px;color:#1a1a18;font-weight:600;padding-top:4px;">${budget || '—'}</td>
          <td style="font-size:13px;color:#1a1a18;font-weight:600;padding-top:4px;">${areaLabel}</td>
        </tr></table>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 48px;">
    <div style="height:1px;background:#e8e4dc;"></div>
    <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#C8A96A;padding:20px 0 16px;">
      ${(listings || []).length > 0 ? `${listings.length} Geselecteerde woningen` : 'Uw selectie'}
    </div>
  </td></tr>

  <tr><td style="background:#ffffff;padding:0 48px 32px;">
    ${listingsHtml || curacaoHtml || '<p style="color:#888;font-size:14px;">Uw persoonlijke selectie wordt samengesteld — u hoort binnen 24 uur van ons.</p>'}
  </td></tr>

  <tr><td style="background:#f8f7f4;padding:36px 48px;border-top:1px solid #e8e4dc;">
    <div style="font-family:Georgia,serif;font-size:16px;color:#1a1a18;margin-bottom:8px;">Interesse in een of meerdere woningen?</div>
    <div style="font-size:13px;color:#888;margin-bottom:20px;line-height:1.65;">Trovai begeleidt u gratis — de commissie wordt betaald door de verkoper.</div>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#C8A96A;border-radius:2px;margin-right:12px;">
        <a href="mailto:info@trovai.nl?subject=Interesse in mijn Trovai selectie" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#080A0F;text-decoration:none;">Email ons →</a>
      </td>
      <td width="12"></td>
      <td style="border:1px solid #C8A96A;border-radius:2px;">
        <a href="https://wa.me/31611380562?text=Hallo, ik heb mijn Trovai selectie ontvangen en heb interesse." style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#C8A96A;text-decoration:none;">WhatsApp</a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#080A0F;padding:28px 48px;border-radius:0 0 4px 4px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-family:Georgia,serif;font-size:15px;font-style:italic;color:#ffffff;">Trovai.</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">info@trovai.nl · trovai.nl · +31 6 11 38 05 62</div>
      </td>
      <td align="right" valign="middle">
        <div style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.1em;text-transform:uppercase;">Gratis voor kopers</div>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Trovai <info@trovai.nl>',
        to: [email],
        subject: `Uw persoonlijke Trovai selectie — ${destLabel}`,
        html
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error('Resend fout: ' + err);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    console.error('send-pdf-email error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: '/api/send-pdf-email' };
