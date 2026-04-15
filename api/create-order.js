// Orsia Jewels — Secure Price Calculator & Draft Order Creator
// Runs on Vercel servers — never exposed to browser

const DIAMOND_MATRIX = [
  // EF-VVS
  { quality: "EF-VVS",    ctMin: 0,     ctMax: 0.05,  price: 40000 },
  { quality: "EF-VVS",    ctMin: 0.051, ctMax: 0.1,   price: 42000 },
  { quality: "EF-VVS",    ctMin: 0.11,  ctMax: 0.2,   price: 44000 },
  { quality: "EF-VVS",    ctMin: 0.21,  ctMax: 0.3,   price: 50000 },
  { quality: "EF-VVS",    ctMin: 0.31,  ctMax: 1,     price: 60000 },
  // EF-VVS-VS
  { quality: "EF-VVS-VS", ctMin: 0,     ctMax: 0.05,  price: 37000 },
  { quality: "EF-VVS-VS", ctMin: 0.051, ctMax: 0.1,   price: 39000 },
  { quality: "EF-VVS-VS", ctMin: 0.11,  ctMax: 0.2,   price: 41000 },
  { quality: "EF-VVS-VS", ctMin: 0.21,  ctMax: 0.3,   price: 47000 },
  { quality: "EF-VVS-VS", ctMin: 0.31,  ctMax: 1,     price: 57000 },
  // EF-VS
  { quality: "EF-VS",     ctMin: 0,     ctMax: 0.05,  price: 34000 },
  { quality: "EF-VS",     ctMin: 0.051, ctMax: 0.1,   price: 36000 },
  { quality: "EF-VS",     ctMin: 0.11,  ctMax: 0.2,   price: 38000 },
  { quality: "EF-VS",     ctMin: 0.21,  ctMax: 0.3,   price: 44000 },
  { quality: "EF-VS",     ctMin: 0.31,  ctMax: 1,     price: 54000 },
  // EF-VS-SI
  { quality: "EF-VS-SI",  ctMin: 0,     ctMax: 0.05,  price: 31000 },
  { quality: "EF-VS-SI",  ctMin: 0.051, ctMax: 0.1,   price: 33000 },
  { quality: "EF-VS-SI",  ctMin: 0.11,  ctMax: 0.2,   price: 35000 },
  { quality: "EF-VS-SI",  ctMin: 0.21,  ctMax: 0.3,   price: 41000 },
  { quality: "EF-VS-SI",  ctMin: 0.31,  ctMax: 1,     price: 51000 },
  // EF-SI
  { quality: "EF-SI",     ctMin: 0,     ctMax: 0.05,  price: 28000 },
  { quality: "EF-SI",     ctMin: 0.051, ctMax: 0.1,   price: 30000 },
  { quality: "EF-SI",     ctMin: 0.11,  ctMax: 0.2,   price: 32000 },
  { quality: "EF-SI",     ctMin: 0.21,  ctMax: 0.3,   price: 38000 },
  { quality: "EF-SI",     ctMin: 0.31,  ctMax: 1,     price: 48000 },
  // EF-SI-I
  { quality: "EF-SI-I",   ctMin: 0,     ctMax: 0.05,  price: 25000 },
  { quality: "EF-SI-I",   ctMin: 0.051, ctMax: 0.1,   price: 27000 },
  { quality: "EF-SI-I",   ctMin: 0.11,  ctMax: 0.2,   price: 29000 },
  { quality: "EF-SI-I",   ctMin: 0.21,  ctMax: 0.3,   price: 35000 },
  { quality: "EF-SI-I",   ctMin: 0.31,  ctMax: 1,     price: 45000 },
  // FG-VVS
  { quality: "FG-VVS",    ctMin: 0,     ctMax: 0.05,  price: 38000 },
  { quality: "FG-VVS",    ctMin: 0.051, ctMax: 0.1,   price: 40000 },
  { quality: "FG-VVS",    ctMin: 0.11,  ctMax: 0.2,   price: 42000 },
  { quality: "FG-VVS",    ctMin: 0.21,  ctMax: 0.3,   price: 48000 },
  { quality: "FG-VVS",    ctMin: 0.31,  ctMax: 1,     price: 58000 },
  // FG-VVS-VS
  { quality: "FG-VVS-VS", ctMin: 0,     ctMax: 0.05,  price: 35000 },
  { quality: "FG-VVS-VS", ctMin: 0.051, ctMax: 0.1,   price: 37000 },
  { quality: "FG-VVS-VS", ctMin: 0.11,  ctMax: 0.2,   price: 39000 },
  { quality: "FG-VVS-VS", ctMin: 0.21,  ctMax: 0.3,   price: 45000 },
  { quality: "FG-VVS-VS", ctMin: 0.31,  ctMax: 1,     price: 55000 },
  // FG-VS
  { quality: "FG-VS",     ctMin: 0,     ctMax: 0.05,  price: 32000 },
  { quality: "FG-VS",     ctMin: 0.051, ctMax: 0.1,   price: 34000 },
  { quality: "FG-VS",     ctMin: 0.11,  ctMax: 0.2,   price: 36000 },
  { quality: "FG-VS",     ctMin: 0.21,  ctMax: 0.3,   price: 42000 },
  { quality: "FG-VS",     ctMin: 0.31,  ctMax: 1,     price: 52000 },
  // FG-VS-SI
  { quality: "FG-VS-SI",  ctMin: 0,     ctMax: 0.05,  price: 29000 },
  { quality: "FG-VS-SI",  ctMin: 0.051, ctMax: 0.1,   price: 31000 },
  { quality: "FG-VS-SI",  ctMin: 0.11,  ctMax: 0.2,   price: 33000 },
  { quality: "FG-VS-SI",  ctMin: 0.21,  ctMax: 0.3,   price: 39000 },
  { quality: "FG-VS-SI",  ctMin: 0.31,  ctMax: 1,     price: 49000 },
  // FG-SI
  { quality: "FG-SI",     ctMin: 0,     ctMax: 0.05,  price: 26000 },
  { quality: "FG-SI",     ctMin: 0.051, ctMax: 0.1,   price: 28000 },
  { quality: "FG-SI",     ctMin: 0.11,  ctMax: 0.2,   price: 30000 },
  { quality: "FG-SI",     ctMin: 0.21,  ctMax: 0.3,   price: 36000 },
  { quality: "FG-SI",     ctMin: 0.31,  ctMax: 1,     price: 46000 },
  // FG-SI-I
  { quality: "FG-SI-I",   ctMin: 0,     ctMax: 0.05,  price: 23000 },
  { quality: "FG-SI-I",   ctMin: 0.051, ctMax: 0.1,   price: 25000 },
  { quality: "FG-SI-I",   ctMin: 0.11,  ctMax: 0.2,   price: 27000 },
  { quality: "FG-SI-I",   ctMin: 0.21,  ctMax: 0.3,   price: 33000 },
  { quality: "FG-SI-I",   ctMin: 0.31,  ctMax: 1,     price: 43000 },
  // GH-VVS
  { quality: "GH-VVS",    ctMin: 0,     ctMax: 0.05,  price: 36000 },
  { quality: "GH-VVS",    ctMin: 0.051, ctMax: 0.1,   price: 38000 },
  { quality: "GH-VVS",    ctMin: 0.11,  ctMax: 0.2,   price: 40000 },
  { quality: "GH-VVS",    ctMin: 0.21,  ctMax: 0.3,   price: 46000 },
  { quality: "GH-VVS",    ctMin: 0.31,  ctMax: 1,     price: 56000 },
  // GH-VVS-VS
  { quality: "GH-VVS-VS", ctMin: 0,     ctMax: 0.05,  price: 33000 },
  { quality: "GH-VVS-VS", ctMin: 0.051, ctMax: 0.1,   price: 35000 },
  { quality: "GH-VVS-VS", ctMin: 0.11,  ctMax: 0.2,   price: 37000 },
  { quality: "GH-VVS-VS", ctMin: 0.21,  ctMax: 0.3,   price: 43000 },
  { quality: "GH-VVS-VS", ctMin: 0.31,  ctMax: 1,     price: 53000 },
  // GH-VS
  { quality: "GH-VS",     ctMin: 0,     ctMax: 0.05,  price: 30000 },
  { quality: "GH-VS",     ctMin: 0.051, ctMax: 0.1,   price: 32000 },
  { quality: "GH-VS",     ctMin: 0.11,  ctMax: 0.2,   price: 34000 },
  { quality: "GH-VS",     ctMin: 0.21,  ctMax: 0.3,   price: 40000 },
  { quality: "GH-VS",     ctMin: 0.31,  ctMax: 1,     price: 50000 },
  // GH-VS-SI
  { quality: "GH-VS-SI",  ctMin: 0,     ctMax: 0.05,  price: 27000 },
  { quality: "GH-VS-SI",  ctMin: 0.051, ctMax: 0.1,   price: 29000 },
  { quality: "GH-VS-SI",  ctMin: 0.11,  ctMax: 0.2,   price: 31000 },
  { quality: "GH-VS-SI",  ctMin: 0.21,  ctMax: 0.3,   price: 37000 },
  { quality: "GH-VS-SI",  ctMin: 0.31,  ctMax: 1,     price: 47000 },
  // GH-SI
  { quality: "GH-SI",     ctMin: 0,     ctMax: 0.05,  price: 24000 },
  { quality: "GH-SI",     ctMin: 0.051, ctMax: 0.1,   price: 26000 },
  { quality: "GH-SI",     ctMin: 0.11,  ctMax: 0.2,   price: 28000 },
  { quality: "GH-SI",     ctMin: 0.21,  ctMax: 0.3,   price: 34000 },
  { quality: "GH-SI",     ctMin: 0.31,  ctMax: 1,     price: 44000 },
  // GH-SI-I
  { quality: "GH-SI-I",   ctMin: 0,     ctMax: 0.05,  price: 21000 },
  { quality: "GH-SI-I",   ctMin: 0.051, ctMax: 0.1,   price: 23000 },
  { quality: "GH-SI-I",   ctMin: 0.11,  ctMax: 0.2,   price: 25000 },
  { quality: "GH-SI-I",   ctMin: 0.21,  ctMax: 0.3,   price: 31000 },
  { quality: "GH-SI-I",   ctMin: 0.31,  ctMax: 1,     price: 41000 },
  // HI-VVS
  { quality: "HI-VVS",    ctMin: 0,     ctMax: 0.05,  price: 33000 },
  { quality: "HI-VVS",    ctMin: 0.051, ctMax: 0.1,   price: 35000 },
  { quality: "HI-VVS",    ctMin: 0.11,  ctMax: 0.2,   price: 37000 },
  { quality: "HI-VVS",    ctMin: 0.21,  ctMax: 0.3,   price: 43000 },
  { quality: "HI-VVS",    ctMin: 0.31,  ctMax: 1,     price: 53000 },
  // HI-VVS-VS
  { quality: "HI-VVS-VS", ctMin: 0,     ctMax: 0.05,  price: 30000 },
  { quality: "HI-VVS-VS", ctMin: 0.051, ctMax: 0.1,   price: 32000 },
  { quality: "HI-VVS-VS", ctMin: 0.11,  ctMax: 0.2,   price: 34000 },
  { quality: "HI-VVS-VS", ctMin: 0.21,  ctMax: 0.3,   price: 40000 },
  { quality: "HI-VVS-VS", ctMin: 0.31,  ctMax: 1,     price: 50000 },
  // HI-VS
  { quality: "HI-VS",     ctMin: 0,     ctMax: 0.05,  price: 27000 },
  { quality: "HI-VS",     ctMin: 0.051, ctMax: 0.1,   price: 29000 },
  { quality: "HI-VS",     ctMin: 0.11,  ctMax: 0.2,   price: 31000 },
  { quality: "HI-VS",     ctMin: 0.21,  ctMax: 0.3,   price: 37000 },
  { quality: "HI-VS",     ctMin: 0.31,  ctMax: 1,     price: 47000 },
  // HI-VS-SI
  { quality: "HI-VS-SI",  ctMin: 0,     ctMax: 0.05,  price: 24000 },
  { quality: "HI-VS-SI",  ctMin: 0.051, ctMax: 0.1,   price: 26000 },
  { quality: "HI-VS-SI",  ctMin: 0.11,  ctMax: 0.2,   price: 28000 },
  { quality: "HI-VS-SI",  ctMin: 0.21,  ctMax: 0.3,   price: 34000 },
  { quality: "HI-VS-SI",  ctMin: 0.31,  ctMax: 1,     price: 44000 },
  // HI-SI
  { quality: "HI-SI",     ctMin: 0,     ctMax: 0.05,  price: 21000 },
  { quality: "HI-SI",     ctMin: 0.051, ctMax: 0.1,   price: 23000 },
  { quality: "HI-SI",     ctMin: 0.11,  ctMax: 0.2,   price: 25000 },
  { quality: "HI-SI",     ctMin: 0.21,  ctMax: 0.3,   price: 31000 },
  { quality: "HI-SI",     ctMin: 0.31,  ctMax: 1,     price: 41000 },
  // HI-SI-I
  { quality: "HI-SI-I",   ctMin: 0,     ctMax: 0.05,  price: 18000 },
  { quality: "HI-SI-I",   ctMin: 0.051, ctMax: 0.1,   price: 20000 },
  { quality: "HI-SI-I",   ctMin: 0.11,  ctMax: 0.2,   price: 22000 },
  { quality: "HI-SI-I",   ctMin: 0.21,  ctMax: 0.3,   price: 28000 },
  { quality: "HI-SI-I",   ctMin: 0.31,  ctMax: 1,     price: 38000 },
  // IJ-VVS
  { quality: "IJ-VVS",    ctMin: 0,     ctMax: 0.05,  price: 30000 },
  { quality: "IJ-VVS",    ctMin: 0.051, ctMax: 0.1,   price: 32000 },
  { quality: "IJ-VVS",    ctMin: 0.11,  ctMax: 0.2,   price: 34000 },
  { quality: "IJ-VVS",    ctMin: 0.21,  ctMax: 0.3,   price: 40000 },
  { quality: "IJ-VVS",    ctMin: 0.31,  ctMax: 1,     price: 50000 },
  // IJ-VVS-VS
  { quality: "IJ-VVS-VS", ctMin: 0,     ctMax: 0.05,  price: 27000 },
  { quality: "IJ-VVS-VS", ctMin: 0.051, ctMax: 0.1,   price: 29000 },
  { quality: "IJ-VVS-VS", ctMin: 0.11,  ctMax: 0.2,   price: 31000 },
  { quality: "IJ-VVS-VS", ctMin: 0.21,  ctMax: 0.3,   price: 37000 },
  { quality: "IJ-VVS-VS", ctMin: 0.31,  ctMax: 1,     price: 47000 },
  // IJ-VS
  { quality: "IJ-VS",     ctMin: 0,     ctMax: 0.05,  price: 24000 },
  { quality: "IJ-VS",     ctMin: 0.051, ctMax: 0.1,   price: 26000 },
  { quality: "IJ-VS",     ctMin: 0.11,  ctMax: 0.2,   price: 28000 },
  { quality: "IJ-VS",     ctMin: 0.21,  ctMax: 0.3,   price: 34000 },
  { quality: "IJ-VS",     ctMin: 0.31,  ctMax: 1,     price: 44000 },
  // IJ-VS-SI
  { quality: "IJ-VS-SI",  ctMin: 0,     ctMax: 0.05,  price: 21000 },
  { quality: "IJ-VS-SI",  ctMin: 0.051, ctMax: 0.1,   price: 23000 },
  { quality: "IJ-VS-SI",  ctMin: 0.11,  ctMax: 0.2,   price: 25000 },
  { quality: "IJ-VS-SI",  ctMin: 0.21,  ctMax: 0.3,   price: 31000 },
  { quality: "IJ-VS-SI",  ctMin: 0.31,  ctMax: 1,     price: 41000 },
  // IJ-SI
  { quality: "IJ-SI",     ctMin: 0,     ctMax: 0.05,  price: 18000 },
  { quality: "IJ-SI",     ctMin: 0.051, ctMax: 0.1,   price: 20000 },
  { quality: "IJ-SI",     ctMin: 0.11,  ctMax: 0.2,   price: 22000 },
  { quality: "IJ-SI",     ctMin: 0.21,  ctMax: 0.3,   price: 28000 },
  { quality: "IJ-SI",     ctMin: 0.31,  ctMax: 1,     price: 38000 },
  // IJ-SI-I
  { quality: "IJ-SI-I",   ctMin: 0,     ctMax: 0.05,  price: 15000 },
  { quality: "IJ-SI-I",   ctMin: 0.051, ctMax: 0.1,   price: 17000 },
  { quality: "IJ-SI-I",   ctMin: 0.11,  ctMax: 0.2,   price: 19000 },
  { quality: "IJ-SI-I",   ctMin: 0.21,  ctMax: 0.3,   price: 25000 },
  { quality: "IJ-SI-I",   ctMin: 0.31,  ctMax: 1,     price: 35000 },
];

const MAKING_CHARGE_PER_GRAM = 2500;
const GST_RATE               = 0.03;
const VALID_PURITIES         = [9, 14, 18];

// ── Lookup diamond price from matrix ────────────────────────────────────────
function lookupDiamondPrice(quality, totalCt) {
  const row = DIAMOND_MATRIX.find(r =>
    r.quality === quality &&
    totalCt >= r.ctMin &&
    totalCt <= r.ctMax
  );
  return row ? row.price : 0;
}

// ── Adjust gold weight by purity ─────────────────────────────────────────────
function getGoldWeight(base18kt, purityKt) {
  if (purityKt === 18) return base18kt;
  if (purityKt === 14) return +(base18kt * 0.90).toFixed(3);
  if (purityKt === 9)  return +(base18kt * 0.80).toFixed(3);
  return base18kt;
}

// ── Fetch live gold rates from GPE metafield ─────────────────────────────────
async function getGoldRates() {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/metafields.json?namespace=DI-GoldPrice&key=metal_prices`,
    {
      headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN }
    }
  );
  const data = await res.json();

  let prices = {};
  try {
    prices = JSON.parse(data.metafields[0]?.value || '{}');
  } catch (e) {
    prices = {};
  }

  // Fallback to sensible defaults if GPE hasn't synced yet
  return {
    18: parseFloat(prices.gold_price_18k) || 4736,
    14: parseFloat(prices.gold_price_14k) || 3520,
    9:  parseFloat(prices.gold_price_9k)  || 2800
  };
}

// ── Fetch product metafields (gold weight, diamond pcs) ──────────────────────
async function getProductMetafields(productId) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products/${productId}/metafields.json?namespace=custom`,
    {
      headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN }
    }
  );
  const data = await res.json();
  const fields = {};
  (data.metafields || []).forEach(m => { fields[m.key] = m.value; });
  return fields;
}

// ── Create Draft Order in Shopify ────────────────────────────────────────────
async function createDraftOrder(productTitle, totalPrice, purityKt, totalCt, quality, goldWeight, diamondPcs) {
  const perDiamondCt = diamondPcs > 0
    ? (totalCt / diamondPcs).toFixed(3)
    : totalCt;

  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/draft_orders.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        draft_order: {
          line_items: [
            {
              title:    productTitle,
              price:    totalPrice.toString(),
              quantity: 1,
              requires_shipping: true,
              properties: [
                { name: 'Gold Purity',         value: purityKt + 'kt'              },
                { name: 'Gold Weight',         value: goldWeight.toFixed(2) + 'g'  },
                { name: 'Diamond Total',       value: totalCt + 'ct'               },
                { name: 'Diamond Per Piece',   value: perDiamondCt + 'ct'          },
                { name: 'Diamond Quality',     value: quality                      },
                { name: 'Diamond Pieces',      value: diamondPcs + ' pcs'          }
              ]
            }
          ],
          note: `Orsia custom order — ${purityKt}kt / ${totalCt}ct / ${quality}`
        }
      })
    }
  );

  return await res.json();
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // CORS — allow requests from your Shopify store only
  const allowedOrigin = `https://${process.env.SHOPIFY_STORE_DOMAIN}`;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { productId, productTitle, purityKt, totalCt, quality } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!productId || !productTitle || !purityKt || !totalCt || !quality) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const purityInt = parseInt(purityKt, 10);
    const ctFloat   = parseFloat(totalCt);

    if (!VALID_PURITIES.includes(purityInt)) {
      return res.status(400).json({ error: 'Invalid purity — must be 9, 14, or 18' });
    }
    if (isNaN(ctFloat) || ctFloat <= 0 || ctFloat > 20) {
      return res.status(400).json({ error: 'Invalid CT value' });
    }
    if (typeof quality !== 'string' || quality.length > 20) {
      return res.status(400).json({ error: 'Invalid quality' });
    }

    // ── Get product data from Shopify ──────────────────────────────────────
    const meta         = await getProductMetafields(productId);
    const base18kt     = parseFloat(meta.gold_weight_18kt || 0);
    const diamondPcs   = parseInt(meta.diamond_pcs || 1, 10);

    if (!base18kt) {
      return res.status(400).json({ error: 'Product gold weight not configured in admin' });
    }

    // ── Get live gold rates from GPE ───────────────────────────────────────
    const goldRates    = await getGoldRates();
    const goldWt       = getGoldWeight(base18kt, purityInt);
    const goldRate     = goldRates[purityInt];

    // ── Calculate price — fully server side ───────────────────────────────
    const goldPrice    = goldWt * goldRate;
    const diamondPrice = lookupDiamondPrice(quality, ctFloat);
    const making       = MAKING_CHARGE_PER_GRAM * goldWt;
    const subtotal     = goldPrice + diamondPrice + making;
    const gst          = subtotal * GST_RATE;
    const total        = Math.round(subtotal + gst);

    if (diamondPrice === 0) {
      return res.status(400).json({ error: `No price found for quality "${quality}" at ${ctFloat}ct` });
    }

    // ── Create Draft Order ─────────────────────────────────────────────────
    const orderData = await createDraftOrder(
      productTitle,
      total,
      purityInt,
      ctFloat,
      quality,
      goldWt,
      diamondPcs
    );

    if (!orderData.draft_order) {
      console.error('Draft order creation failed:', orderData);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // ── Return checkout URL ────────────────────────────────────────────────
    return res.status(200).json({
      checkoutUrl:   orderData.draft_order.invoice_url,
      calculatedPrice: total,
      breakdown: {
        goldPrice:    Math.round(goldPrice),
        diamondPrice: Math.round(diamondPrice),
        making:       Math.round(making),
        gst:          Math.round(gst),
        total:        total
      }
    });

  } catch (err) {
    console.error('Orsia order error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
