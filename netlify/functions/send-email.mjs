import { Netlify } from '@netlify/functions';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { name, email, phone, destination, budget, property_type, message, interest, form_type } = await req.json();

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const destLabel = {
    cotedazur: 'Cote d Azur',
    curacao: 'Curacao',
    both: 'Beide bestemmingen',
    unsure: 'Nog niet zeker'
  }[destination || interest] || destination || interest || 'Niet opgegeven';

  const confirmHtml = '<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#080A0F;padding:40px"><h1 style="color:#F4F2EE;font-size:26px;font-weight:400">Bedankt, ' + name + '.</h1><p style="color:rgba(244,242,238,0.65);font-size:15px">Uw aanvraag is ontvangen. Ons team neemt binnen 24 uur persoonlijk contact op.</p><p style="color:#C8A96A;font-size:13px;margin-top:20px">Bestemming: ' + destLabel + ' | Budget: ' + (budget||'-') + '</p><p style="color:rgba(244,242,238,0.3);font-size:11px;margin-top:32px">info@trovai.nl trovai.nl</p></div>';
  const notifHtml = '<div style="font-family:Arial,sans-serif;max-width:600px;padding:32px"><h2>Nieuwe lead via Trovai</h2><table style="width:100%;border-collapse:collapse;margin-top:16px"><tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;width:130px">Naam</td><td style="padding:10px;border-bottom:1px solid #eee">' + name + '</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">Email</td><td style="padding:10px;border-bottom:1px solid #eee">' + email + '</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">WhatsApp</td><td style="padding:10px;border-bottom:1px solid #eee">' + (phone||'-') + '</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">Bestemming</td><td style="padding:10px;border-bottom:1px solid #eee">' + destLabel + '</td></tr><tr><td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold">Budget</td><td style="padding:10px;border-bottom:1px solid #eee">' + (budget||'-') + '</td></tr><tr><td style="padding:10px;font-weight:bold;vertical-align:top">Bericht</td><td style="padding:10px">' + (message||'-') + '</td></tr></table></div>';

  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Trovai <info@trovai.nl>', to: [email], subject: 'Bedankt voor uw aanvraag, ' + name, html: confirmHtml }) });
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Trovai <info@trovai.nl>', to: ['roelofmethorst@gmail.com'], subject: 'Nieuwe Trovai lead: ' + name + ' - ' + destLabel, html: notifHtml }) });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
export const config = { path: '/api/send-email' };