// Trovai · save-lead.mjs
// Saves lead to Netlify Blobs (persistent storage)

import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, headers 
    });
  }

  try {
    const body = await req.json();
    const { name, email, phone, destination, budget, property_type, intended_use, timeline, form_type } = body;

    // Generate lead ID
    const timestamp = Date.now();
    const leadId = `lead_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Create lead object
    const lead = {
      id: leadId,
      name,
      email,
      phone: phone || null,
      destination: destination || 'unknown',
      budget: budget || null,
      property_type: property_type || null,
      intended_use: intended_use || null,
      timeline: timeline || null,
      form_type: form_type || 'quiz',
      status: 'new',
      created_at: new Date().toISOString(),
      source: 'trovai.nl',
      notes: []
    };

    // Get blob store
    const store = getStore('leads');
    
    // Save individual lead
    await store.set(leadId, JSON.stringify(lead));

    // Update leads index
    let index = [];
    try {
      const indexData = await store.get('_index', { type: 'json' });
      if (indexData) index = indexData;
    } catch (e) {
      // Index doesn't exist yet, will be created
    }

    index.unshift({ id: leadId, created_at: lead.created_at, email: lead.email, name: lead.name });
    
    // Keep only last 1000 in index
    if (index.length > 1000) index = index.slice(0, 1000);
    
    await store.set('_index', JSON.stringify(index));

    return new Response(JSON.stringify({ 
      success: true, 
      lead_id: leadId,
      message: 'Lead saved successfully'
    }), { status: 200, headers });

  } catch (error) {
    console.error('save-lead error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to save lead',
      details: error.message
    }), { status: 500, headers });
  }
};

export const config = {
  path: '/api/save-lead'
};
