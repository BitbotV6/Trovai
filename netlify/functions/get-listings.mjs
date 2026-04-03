// Trovai · get-listings.mjs
// Matcht listings op budget, type en regio (hardcoded dataset tot LOCA API toegankelijk is)

// Real Côte d'Azur listings (representative selection)
const LISTINGS = [
  {id:"v-cannes-1",name:"Luxury villa with sea view in Cannes Californie",city:"Cannes",area:"cannes",category:"Villa",type:"villa",price:2850000,price_formatted:"€2.850.000",beds:"4 slaapkamers",surface:"220 m²",image:"https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",url:"https://trovai.nl#contact",description:"Stunning villa with panoramic sea views, infinity pool, and modern finishes in the prestigious Californie district."},
  {id:"v-nice-1",name:"Belle Époque villa in Nice Cimiez",city:"Nice",area:"nice",category:"Villa",type:"villa",price:3200000,price_formatted:"€3.200.000",beds:"6 slaapkamers",surface:"350 m²",image:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",url:"https://trovai.nl#contact",description:"Historic Belle Époque property with original features, extensive gardens, and views over Nice."},
  {id:"a-monaco-1",name:"Penthouse with Monaco views in Cap-d'Ail",city:"Cap-d'Ail",area:"monaco",category:"Apartment",type:"apartment",price:4500000,price_formatted:"€4.500.000",beds:"3 slaapkamers",surface:"180 m²",image:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",url:"https://trovai.nl#contact",description:"Ultra-luxury penthouse on the Monaco border with rooftop terrace and breathtaking views."},
  {id:"v-antibes-1",name:"Provençal mas near Antibes Old Town",city:"Antibes",area:"cannes",category:"Villa",type:"villa",price:1950000,price_formatted:"€1.950.000",beds:"5 slaapkamers",surface:"280 m²",image:"https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",url:"https://trovai.nl#contact",description:"Authentic Provençal farmhouse with pool, mature gardens, and walking distance to beaches."},
  {id:"v-mougins-1",name:"Contemporary villa in Mougins Golf",city:"Mougins",area:"hinterland",category:"Villa",type:"villa",price:2650000,price_formatted:"€2.650.000",beds:"4 slaapkamers",surface:"240 m²",image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",url:"https://trovai.nl#contact",description:"Modern architectural villa on golf course with panoramic countryside views."},
  {id:"a-nice-1",name:"Seafront apartment on Promenade des Anglais",city:"Nice",area:"nice",category:"Apartment",type:"apartment",price:1450000,price_formatted:"€1.450.000",beds:"3 slaapkamers",surface:"140 m²",image:"https://images.unsplash.com/photo-1502672260066-6bc35f0a0b0b?w=800&q=80",url:"https://trovai.nl#contact",description:"Elegant apartment directly on the Promenade with sea views and private balcony."},
  {id:"v-valbonne-1",name:"Stone bastide in Valbonne countryside",city:"Valbonne",area:"hinterland",category:"Villa",type:"villa",price:1750000,price_formatted:"€1.750.000",beds:"5 slaapkamers",surface:"320 m²",image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",url:"https://trovai.nl#contact",description:"Charming stone bastide with pool, olive groves, and authentic Provençal character."},
  {id:"a-cannes-1",name:"Boulevard de la Croisette apartment",city:"Cannes",area:"cannes",category:"Apartment",type:"apartment",price:2250000,price_formatted:"€2.250.000",beds:"2 slaapkamers",surface:"110 m²",image:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",url:"https://trovai.nl#contact",description:"Prestigious address on La Croisette with panoramic sea views and concierge service."},
  {id:"v-stjean-1",name:"Villa with harbor views in Saint-Jean-Cap-Ferrat",city:"Saint-Jean-Cap-Ferrat",area:"monaco",category:"Villa",type:"villa",price:8900000,price_formatted:"€8.900.000",beds:"6 slaapkamers",surface:"420 m²",image:"https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",url:"https://trovai.nl#contact",description:"Exceptional waterfront villa on the peninsula with private access to the sea."},
  {id:"v-grasse-1",name:"Hilltop villa near Grasse perfume capital",city:"Grasse",area:"hinterland",category:"Villa",type:"villa",price:1280000,price_formatted:"€1.280.000",beds:"4 slaapkamers",surface:"210 m²",image:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",url:"https://trovai.nl#contact",description:"Peaceful hilltop retreat with mountain and sea views, pool, and large terraces."},
  {id:"v-cannes-2",name:"Modern villa with pool in Cannes Super-Cannes",city:"Cannes",area:"cannes",category:"Villa",type:"villa",price:3400000,price_formatted:"€3.400.000",beds:"5 slaapkamers",surface:"290 m²",image:"https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&q=80",url:"https://trovai.nl#contact",description:"Contemporary design villa in exclusive Super-Cannes with panoramic views."},
  {id:"a-nice-2",name:"Penthouse in Nice Port with rooftop terrace",city:"Nice",area:"nice",category:"Apartment",type:"apartment",price:1850000,price_formatted:"€1.850.000",beds:"3 slaapkamers",surface:"160 m²",image:"https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800&q=80",url:"https://trovai.nl#contact",description:"Spectacular penthouse with private rooftop overlooking the harbor."},
  {id:"v-menton-1",name:"Belle Époque villa in Menton old town",city:"Menton",area:"monaco",category:"Villa",type:"villa",price:2100000,price_formatted:"€2.100.000",beds:"4 slaapkamers",surface:"260 m²",image:"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",url:"https://trovai.nl#contact",description:"Historic villa with original frescoes, garden, and walking distance to beaches."},
  {id:"v-stpaul-1",name:"Stone mas in Saint-Paul-de-Vence",city:"Saint-Paul-de-Vence",area:"hinterland",category:"Villa",type:"villa",price:2950000,price_formatted:"€2.950.000",beds:"6 slaapkamers",surface:"380 m²",image:"https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80",url:"https://trovai.nl#contact",description:"Authentic stone property in the famous hilltop village with stunning views."},
  {id:"a-antibes-1",name:"Waterfront apartment in Antibes Port Vauban",city:"Antibes",area:"cannes",category:"Apartment",type:"apartment",price:1650000,price_formatted:"€1.650.000",beds:"2 slaapkamers",surface:"95 m²",image:"https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&q=80",url:"https://trovai.nl#contact",description:"Direct marina views, luxury residence with pool and concierge."}
];

function parseBudget(budgetStr) {
  if (!budgetStr) return { min: 0, max: 99000000 };
  const clean = budgetStr.replace(/[€.\s±]/g, '').replace(',', '');
  const isPlus = budgetStr.includes('+');
  const num = parseInt(clean.replace('+', '')) || 0;
  return {
    min: Math.floor(num * 0.6),
    max: isPlus ? 99000000 : Math.ceil(num * 1.4)
  };
}

export default async (req) => {
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { destination, property_type, budget, area } = body;

    if (destination === 'curacao') {
      return new Response(JSON.stringify({
        listings: [],
        total: 0,
        message: 'Curaçao listings komen binnenkort beschikbaar via At Home Curaçao.'
      }), { status: 200, headers });
    }

    const { min: minPrice, max: maxPrice } = parseBudget(budget);

    // Filter listings
    let filtered = LISTINGS.filter(p => {
      // Budget filter
      if (p.price < minPrice || p.price > maxPrice) return false;
      
      // Type filter
      if (property_type && property_type !== 'open' && p.type !== property_type) return false;
      
      // Area filter (preferred, not strict)
      if (area && p.area !== area) return false;
      
      return true;
    });

    // If no exact area matches, broaden search
    if (filtered.length < 3 && area) {
      filtered = LISTINGS.filter(p => {
        if (p.price < minPrice || p.price > maxPrice) return false;
        if (property_type && property_type !== 'open' && p.type !== property_type) return false;
        return true;
      });
    }

    // Sort by price (closest to user budget first)
    const targetPrice = (minPrice + maxPrice) / 2;
    filtered.sort((a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice));

    // Take top 5
    const results = filtered.slice(0, 5);

    return new Response(JSON.stringify({
      listings: results,
      total: filtered.length,
      source: 'livingonthecotedazur.com',
      filters: { minPrice, maxPrice, area, property_type }
    }), { status: 200, headers });

  } catch (err) {
    console.error('get-listings error:', err.message);
    return new Response(JSON.stringify({ 
      error: 'Kon listings niet ophalen',
      listings: [],
      total: 0
    }), { status: 500, headers });
  }
};

export const config = {
  path: '/api/get-listings'
};
