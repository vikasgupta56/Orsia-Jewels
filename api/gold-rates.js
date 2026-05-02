// Orsia Jewels — Gold Rate Proxy
// Reads from GPE metafield (DI-GoldPrice / metal_prices / gold_price_24k)
// GPE stores value as USD per troy oz — we convert to INR per gram per karat

let cachedRates = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min cache

async function getAccessToken() {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        grant_type:    'client_credentials'
      })
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

export default async function handler(req, res) {

  const rawDomain     = (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '');
  const allowedOrigin = `https://${rawDomain}`;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  // Return cached rates if fresh
  if (cachedRates && (Date.now() - cacheTime) < CACHE_TTL) {
    return res.status(200).json({ ...cachedRates, cached: true });
  }

  try {
    const token = await getAccessToken();

    // Fetch GPE shop metafield
    const mfRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/metafields.json?namespace=DI-GoldPrice&key=metal_prices&owner_resource=shop`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );
    const mfData = await mfRes.json();
    const raw    = mfData.metafields && mfData.metafields[0];

    if (!raw || !raw.value) throw new Error('GPE metafield not found');

    let prices = {};
    try { prices = JSON.parse(raw.value); } catch(e) { throw new Error('Could not parse GPE metafield value'); }

    // GPE stores gold_price_24k as USD per troy oz
    // Convert: per_gram_INR = usd_per_oz × 31.1035
    // (GPE already accounts for INR conversion internally — the value IS in INR per troy oz)
    const raw24k = parseFloat(prices.gold_price_24k);
    if (!raw24k || raw24k < 100) throw new Error('Invalid gold_price_24k: ' + raw24k);

    // Based on GPE's own formula: displayed_price = raw × 31.1034768
    // So per_gram = raw × 31.1035 (same as their liquid template)
    const per24g = raw24k * 31.1035;

    cachedRates = {
      rate18k:   Math.round(per24g * 0.750),
      rate14k:   Math.round(per24g * 0.585),
      rate9k:    Math.round(per24g * 0.375),
      per24g:    Math.round(per24g),
      source:    'GPE metafield',
      fetchedAt: new Date().toISOString()
    };
    cacheTime = Date.now();

    console.log('Gold rates from GPE:', cachedRates);
    return res.status(200).json({ ...cachedRates, cached: false });

  } catch(err) {
    console.warn('GPE metafield failed:', err.message, '— using fallback');
    return res.status(200).json({
      rate18k:  10454,
      rate14k:  8144,
      rate9k:   5229,
      per24g:   13939,
      source:   'fallback',
      cached:   false,
      fallback: true,
      error:    err.message
    });
  }
}
