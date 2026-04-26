export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email, preference, timestamp } = await req.json();

    if (!email || !preference) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    const prefLabels = {
      call: '📞 Bel mij graag binnen 24 uur',
      whatsapp: '💬 WhatsApp is prima',
      email: '✉️ Email is voldoende, bel me niet'
    };

    // Stuur notificatie naar Patricia/team
    if (RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Trovai <info@trovai.nl>',
          to: ['info@trovai.nl'],
          subject: `🔔 Communicatievoorkeur: ${email}`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:8px">
  <h2 style="color:#080A0F;margin:0 0 16px">Voorkeur gewijzigd</h2>
  <p style="margin:0 0 24px;color:#666">Een lead heeft zijn/haar communicatievoorkeur aangegeven:</p>
  
  <div style="background:#fff;border:2px solid #C8A96A;border-radius:6px;padding:20px;margin-bottom:24px">
    <div style="font-size:18px;color:#C8A96A;margin-bottom:8px">${prefLabels[preference]}</div>
    <div style="font-size:14px;color:#333"><strong>Email:</strong> ${email}</div>
  </div>

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:10px;background:#fff;border-bottom:1px solid #eee;font-weight:bold;width:140px">Voorkeur</td>
      <td style="padding:10px;background:#fff;border-bottom:1px solid #eee">${prefLabels[preference]}</td>
    </tr>
    <tr>
      <td style="padding:10px;background:#f5f5f5;border-bottom:1px solid #eee;font-weight:bold">Email</td>
      <td style="padding:10px;background:#f5f5f5;border-bottom:1px solid #eee"><a href="mailto:${email}">${email}</a></td>
    </tr>
    <tr>
      <td style="padding:10px;background:#fff;border-bottom:1px solid #eee;font-weight:bold">Timestamp</td>
      <td style="padding:10px;background:#fff;border-bottom:1px solid #eee">${new Date(timestamp).toLocaleString('nl-NL')}</td>
    </tr>
  </table>

  <p style="margin:24px 0 0;color:#666;font-size:13px">
    ${preference === 'call' ? '⚡ Deze lead wil graag gebeld worden binnen 24 uur!' : preference === 'whatsapp' ? '💬 Deze lead staat open voor WhatsApp contact.' : '📧 Deze lead wil liever alleen email ontvangen (niet bellen).'}
  </p>
</div>`
        })
      });
    }

    // Optioneel: sla ook op in database/storage
    // Voor nu loggen we alleen via email notificatie

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Preference saved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error saving preference:', error);
    return new Response(JSON.stringify({ error: 'Failed to save preference' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/save-preference'
};
