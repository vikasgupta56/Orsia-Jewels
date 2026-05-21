// Orsia Jewels — Gold Rate Proxy
// Reads 24K rate from GPE, derives karat rates at: 18k=79%, 14k=62%, 9k=40%

let cachedRates = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000;

// Karat factors applied to 24K rate
const KARAT_FACTORS = { 18: 0.79, 14: 0.62, 9: 0.40 };

// Fallback 24K rate (~₹14,329/g as of mid-2025). Derived lower-karat fallbacks
// are auto-computed from this using the same factors.
const FALLBACK_24K = 14329;

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

    // ── Resolve the 24K rate ──────────────────────────────────────────────────
    // GPE Advanced may store gold_price_24k directly. If not, derive from
    // gold_price_18k using the inverse of our 79% factor (÷ 0.79).
    let rate24k = parseFloat(prices.gold_price_24k);

    if (!rate24k || rate24k < 1000) {
      const stored18k = parseFloat(prices.gold_price_18k);
      if (stored18k && stored18k > 1000) {
        // Back-derive: if GPE 18k was set assuming 75% purity (standard hallmark),
        // we resolve the 24K base and re-apply our own 79% factor downstream.
        rate24k = stored18k / KARAT_FACTORS[18];
        console.log('Derived 24K from GPE 18K:', stored18k, '→', rate24k);
      } else {
        throw new Error('No valid 24K or 18K rate found in GPE: ' + JSON.stringify({ gold_price_24k: prices.gold_price_24k, gold_price_18k: prices.gold_price_18k }));
      }
    }

    // ── Derive lower-karat rates ──────────────────────────────────────────────
    const rate18k = Math.round(rate24k * KARAT_FACTORS[18]);  // 79% of 24K
    const rate14k = Math.round(rate24k * KARAT_FACTORS[14]);  // 62% of 24K
    const rate9k  = Math.round(rate24k * KARAT_FACTORS[9]);   // 40% of 24K

    cachedRates = {
      rate24k:   Math.round(rate24k),
      rate18k,
      rate14k,
      rate9k,
      fetchedAt: new Date().toISOString()
    };
    cacheTime = Date.now();

    console.log('Gold rates (24K base):', cachedRates);
    return res.status(200).json({ ...cachedRates, cached: false });

  } catch(err) {
    console.warn('GPE fetch failed:', err.message);

    // Fallback: derive all rates from the hardcoded 24K base
    return res.status(200).json({
      rate24k:  FALLBACK_24K,
      rate18k:  Math.round(FALLBACK_24K * KARAT_FACTORS[18]),  // 11,320
      rate14k:  Math.round(FALLBACK_24K * KARAT_FACTORS[14]),  //  8,884
      rate9k:   Math.round(FALLBACK_24K * KARAT_FACTORS[9]),   //  5,732
      cached:   false,
      fallback: true,
      error:    err.message
    });
  }
}
