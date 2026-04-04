// Trovai Admin - Pure API Mode (no localStorage for API leads)
let leads = [];
let apiLeads = [];
const ADMIN_TOKEN = localStorage.getItem('admin_token') || 'trovai2026';

// Load leads from API
async function loadLeads() {
  console.log('[Admin] Loading leads from API...');
  
  try {
    const response = await fetch('/api/get-leads', {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    if (!response.ok) {
      console.error('[Admin] API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    console.log('[Admin] API returned:', data);
    
    return (data.leads || []).map(lead => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      dest: lead.destination || 'unknown',
      budget: lead.budget ? parseInt(lead.budget.replace(/[€.\s]/g, '')) : 0,
      model: '25',
      status: lead.status || 'new',
      notes: lead.form_type === 'quiz' ? 'Via quiz' : 'Contact form',
      date: new Date(lead.created_at).toLocaleDateString('nl-NL'),
      commission: 0,
      source: 'api'
    }));
  } catch (error) {
    console.error('[Admin] Load error:', error);
    return [];
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async function() {
  console.log('[Admin] Page loaded, fetching leads...');
  
  // Load API leads
  apiLeads = await loadLeads();
  console.log(`[Admin] Loaded ${apiLeads.length} leads from API`);
  
  // Set global leads array (force it to exist)
  window.leads = apiLeads;
  console.log('[Admin] Set window.leads to', apiLeads.length, 'leads');
  
  // Trigger render if function exists
  if (typeof window.render === 'function') {
    window.render();
    console.log('[Admin] Rendered leads');
  } else {
    console.error('[Admin] render() function not found!');
  }
});

// Auto-refresh every 30 seconds
setInterval(async () => {
  console.log('[Admin] Auto-refresh...');
  const newLeads = await loadLeads();
  
  if (newLeads.length !== apiLeads.length) {
    console.log(`[Admin] New leads detected! ${apiLeads.length} → ${newLeads.length}`);
    apiLeads = newLeads;
    window.leads = apiLeads;
    if (typeof window.render === 'function') {
      window.render();
    }
  }
}, 30000);

console.log('[Admin] Tracker initialized');
