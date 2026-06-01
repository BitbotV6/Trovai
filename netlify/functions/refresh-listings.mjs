// Trovai · refresh-listings.mjs
// Scheduled function: triggert dagelijks een Netlify-rebuild via een Build Hook,
// zodat de statisch voorgerenderde listings verse brondata (prijzen, status) krijgen.
// Vereist env var BUILD_HOOK_URL = de Build Hook-URL uit de Netlify-instellingen.

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    return new Response(JSON.stringify({ ok: false, reason: 'BUILD_HOOK_URL niet ingesteld' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const res = await fetch(hook, { method: 'POST' });
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = { schedule: '0 4 * * *' };
