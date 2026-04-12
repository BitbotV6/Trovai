// Monitoring endpoint: trovai.nl/api/autoposter-log
export default async (req) => {
  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore('autoposter-logs');
    
    // Laatste 7 dagen
    const logs = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      try {
        const dagLog = await store.get(key, { type: 'json' });
        if (dagLog) logs.push(...(Array.isArray(dagLog) ? dagLog : [dagLog]));
      } catch {}
    }
    
    return new Response(JSON.stringify({ logs: logs.reverse(), totaal: logs.length }, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/autoposter-log' };
