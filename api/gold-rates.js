// Orsia Jewels — Gold Rate Proxy
// Browser fetches this endpoint instead of calling metals.live directly
// Adds CORS, caching, and hides the source API from the browser

// Simple in-memory cache — avoids hammering the source API
let cachedRates = null;
let cacheTime   = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {

  // CORS — allow your store only
  const rawDomain     = (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '');
  const allowedOrigin = `https://${rawDomain}`;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300'); // browser can cache 5 min

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Return cached rates if fresh
    if (cachedRates && (Date.now() - cacheTime) < CACHE_TTL) {
      return res.status(200).json({ ...cachedRates, cached: true });
    }

    // Fetch fresh rates
    const metalRes = await fetch('https://api.metals.live/v1/spot/gold', {
      headers: { 'Accept': 'application/json' }
    });
    const metalData = await metalRes.json();
    const usdPerOz  = metalData[0]?.price;
    if (!usdPerOz || usdPerOz <= 0) throw new Error('Invalid gold price');

    const fxRes  = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const fxData = await fxRes.json();
    const inrRate = fxData?.usd?.inr;
    if (!inrRate || inrRate <= 0) throw new Error('Invalid exchange rate');

    const per24g = (usdPerOz * inrRate) / 31.1035;

    cachedRates = {
      rate18k:    Math.round(per24g * 0.750),
      rate14k:    Math.round(per24g * 0.585),
      rate9k:     Math.round(per24g * 0.375),
      per24g:     Math.round(per24g),
      fetchedAt:  new Date().toISOString()
    };
    cacheTime = Date.now();

    console.log('Gold rates fetched:', cachedRates);
    return res.status(200).json({ ...cachedRates, cached: false });

  } catch(err) {
    console.warn('Gold rate fetch failed:', err.message);
    // Return fallback so widget always gets a number
    return res.status(200).json({
      rate18k:   5400,
      rate14k:   4200,
      rate9k:    2700,
      per24g:    7200,
      cached:    false,
      fallback:  true,
      error:     err.message
    });
  }
}
