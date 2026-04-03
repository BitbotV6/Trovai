export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { name, email, phone, destination, budget, message, interest } = await req.json();
  const RESEND_API_KEY = Netlify.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'Not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  const dest = { cotedazur: 'Cote d Azur', curacao: 'Curacao', both: 'Beide bestemmingen' }[destination || interest] || destination || interest || 'Niet opgegeven';
  const confirmHtml = '<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#080A0F;padding:40px"><h1 style="color:#F4F2EE;font-size:26px;font-weight:400">Bedankt, ' + name + '.</h1><p style="color:rgba(244,242,238,0.65);font-size:15px">Uw aanvraag is ontvangen. Ons team neemt binnen 24 uur contact op.</p><p style="color:#C8A96A;font-size:13px;margin-top:20px">Bestemming: ' + dest + '</p><p style="color:rgba(244,242,238,0.3);font-size:11px;margin-top:32px">info@trovai.nl</p></div>';
  const notifHtml = '<div style="font-family:Arial,sans-serif;padding:24px"><h2>Nieuwe lead: ' + name + '</h2><p>Email: ' + email + '</p><p>WhatsApp: ' + (phone||'-') + '</p><p>Bestemming: ' + dest + '</p><p>Budget: ' + (budget||'-') + '</p><p>Bericht: ' + (message||'-') + '</p></div>';
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Trovai <info@trovai.nl>', to: [email], subject: 'Bedankt voor uw aanvraag, ' + name, html: confirmHtml }) });
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Trovai <info@trovai.nl>', to: ['roelofmethorst@gmail.com'], subject: 'Nieuwe Trovai lead: ' + name, html: notifHtml }) });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
export const config = { path: '/api/send-email' };
