// Orsia Jewels — Gold Rate Proxy
// GPE Advanced stores per-gram INR rates directly — read as-is

let cachedRates = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000;

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

  if (cachedRates && (Date.now() - cacheTime) < CACHE_TTL) {
    return res.status(200).json({ ...cachedRates, cached: true });
  }

  try {
    const token = await getAccessToken();

    const mfRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/metafields.json?namespace=DI-GoldPrice&key=metal_prices&owner_resource=shop`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );
    const mfData = await mfRes.json();
    const raw    = mfData.metafields && mfData.metafields[0];

    if (!raw || !raw.value) throw new Error('GPE metafield not found');

    let prices = {};
    try { prices = JSON.parse(raw.value); } catch(e) { throw new Error('Could not parse GPE value'); }

    // GPE Advanced stores INR per gram directly — read as-is
    const rate18k = parseFloat(prices.gold_price_18k);
    const rate14k = parseFloat(prices.gold_price_14k);
    const rate9k  = parseFloat(prices.gold_price_9k);

    if (!rate18k || rate18k < 1000) throw new Error('Invalid 18k rate: ' + rate18k);

    cachedRates = {
      rate18k:   Math.round(rate18k),
      rate14k:   Math.round(rate14k),
      rate9k:    Math.round(rate9k),
      fetchedAt: new Date().toISOString()
    };
    cacheTime = Date.now();

    console.log('Gold rates from GPE:', cachedRates);
    return res.status(200).json({ ...cachedRates, cached: false });

  } catch(err) {
    console.warn('GPE fetch failed:', err.message);
    return res.status(200).json({
      rate18k:  11320,
      rate14k:  8804,
      rate9k:   5660,
      cached:   false,
      fallback: true,
      error:    err.message
    });
  }
}
