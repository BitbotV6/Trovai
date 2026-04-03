// Trovai · get-leads.mjs
// Retrieves leads from Netlify Blobs storage

import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, headers 
    });
  }

  try {
    // Basic auth check (password in env var)
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = 'Bearer ' + (process.env.ADMIN_TOKEN || 'trovai2026');
    
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers 
      });
    }

    const store = getStore('leads');
    
    // Get index
    let index = [];
    try {
      const indexData = await store.get('_index', { type: 'json' });
      if (indexData) index = indexData;
    } catch (e) {
      // No leads yet
      return new Response(JSON.stringify({ leads: [], total: 0 }), { 
        status: 200, headers 
      });
    }

    // Get full lead data for each entry
    const leads = [];
    for (const entry of index.slice(0, 100)) { // Max 100 most recent
      try {
        const leadData = await store.get(entry.id, { type: 'json' });
        if (leadData) leads.push(leadData);
      } catch (e) {
        console.error(`Failed to load lead ${entry.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ 
      leads,
      total: index.length
    }), { status: 200, headers });

  } catch (error) {
    console.error('get-leads error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve leads',
      leads: [],
      total: 0
    }), { status: 500, headers });
  }
};

export const config = {
  path: '/api/get-leads'
};
