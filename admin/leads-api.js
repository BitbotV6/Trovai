// Trovai Admin - Live Leads Integration
// Loads leads from /api/get-leads and merges with localStorage

async function loadLiveLeads() {
  const token = localStorage.getItem('admin_token') || 'trovai2026';
  
  try {
    const response = await fetch('/api/get-leads', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to load live leads:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.leads || [];
  } catch (error) {
    console.error('Error loading live leads:', error);
    return [];
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async function() {
  console.log('Loading live leads from API...');
  
  const liveLeads = await loadLiveLeads();
  
  console.log(`API returned ${liveLeads.length} leads`);
  
  // Convert API format to tracker format
  const convertedLeads = liveLeads.map(lead => ({
    id: lead.id || Date.now(),
    name: lead.name,
    email: lead.email,
    phone: lead.phone || '',
    dest: lead.destination || 'unknown',
    budget: lead.budget ? parseInt(lead.budget.replace(/[€.\s]/g, '')) : 0,
    model: '25', // Default commission model
    status: lead.status || 'new',
    notes: lead.form_type === 'quiz' ? 'Via quiz submission' : 'Via contact form',
    date: new Date(lead.created_at).toLocaleDateString('nl-NL'),
    commission: 0 // Will be calculated based on budget + model
  }));
  
  // Get local leads (only non-API leads, identified by string IDs starting with 'lead_')
  const localLeads = JSON.parse(localStorage.getItem('leads') || '[]');
  const manualLeads = localLeads.filter(l => typeof l.id === 'number');
  
  // Replace all API leads, keep only manual additions
  const mergedLeads = [...convertedLeads, ...manualLeads];
  
  console.log(`Loaded ${convertedLeads.length} API leads + ${manualLeads.length} manual leads = ${mergedLeads.length} total`);
  
  // Update storage and render
  localStorage.setItem('leads', JSON.stringify(mergedLeads));
  
  if (typeof leads !== 'undefined' && typeof render === 'function') {
    leads = mergedLeads;
    render();
    console.log('Rendered updated leads');
  }
});
