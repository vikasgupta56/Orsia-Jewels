// Orsia Jewels — Secure Price Calculator (Solitaire + Side Diamonds)

const MAKING_CHARGE_PER_GRAM = 2500;
const GST_RATE               = 0.03;
const VALID_PURITIES         = [9, 14, 18];

function getGoldWeight(base18kt, purityKt) {
  if (purityKt === 18) return base18kt;
  if (purityKt === 14) return +(base18kt * 0.90).toFixed(3);
  if (purityKt === 9)  return +(base18kt * 0.80).toFixed(3);
  return base18kt;
}

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

// ── Live gold rate fetch — no app dependency ─────────────────────────────
// Uses metals.live (free, no key) + currency conversion
// Falls back to hardcoded defaults if API is unavailable
async function getGoldRates() {
  try {
    // Step 1: Get gold spot price in USD per troy oz
    const metalRes = await fetch('https://api.metals.live/v1/spot/gold', {
      headers: { 'Accept': 'application/json' }
    });
    const metalData = await metalRes.json();
    const usdPerOz  = metalData[0]?.price;
    if (!usdPerOz || usdPerOz <= 0) throw new Error('Invalid gold price');

    // Step 2: Get USD → INR exchange rate
    const fxRes  = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const fxData = await fxRes.json();
    const inrRate = fxData?.usd?.inr;
    if (!inrRate || inrRate <= 0) throw new Error('Invalid exchange rate');

    // Step 3: Derive per-gram rates for each karat
    // 1 troy oz = 31.1035 grams
    const per24ktGram = (usdPerOz * inrRate) / 31.1035;

    const rates = {
      18: Math.round(per24ktGram * 0.750),  // 18/24
      14: Math.round(per24ktGram * 0.585),  // 14/24
      9:  Math.round(per24ktGram * 0.375)   // 9/24
    };

    console.log('Live gold rates fetched:', rates, '| USD/oz:', usdPerOz, '| INR/USD:', inrRate);
    return rates;

  } catch(err) {
    console.warn('Gold rate fetch failed, using fallback:', err.message);
    // Fallback — update these periodically as a safety net
    return { 18: 5400, 14: 4200, 9: 2700 };
  }
}

async function getProductMetafields(productId, token) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/products/${productId}/metafields.json`,
    { headers: { 'X-Shopify-Access-Token': token } }
  );
  const data = await res.json();
  const fields = {};
  (data.metafields || []).forEach(m => {
    fields[m.key] = m.value;
    fields[`${m.namespace}.${m.key}`] = m.value;
  });
  return fields;
}

async function getDiamondMatrix(diamondType, token) {
  const handle = diamondType === 'lab' ? 'lab_diamond_matrix' : 'natural_diamond_matrix';
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/metaobjects.json?type=${handle}&limit=250`,
    { headers: { 'X-Shopify-Access-Token': token } }
  );
  const data = await res.json();
  return (data.metaobjects || []).map(obj => {
    const f = {};
    (obj.fields || []).forEach(field => { f[field.key] = field.value; });
    return {
      quality: f.quality_label || '',
      ctMin:   parseFloat(f.ct_min || 0),
      ctMax:   parseFloat(f.ct_max || 0),
      price:   parseInt(f.price_per_ct || 0, 10)
    };
  });
}

// Formula: SolRate/SideRate × totalWt
// n/N used only to find per-diamond CT for matrix lookup
// Final price = rate from matrix × total weight (not × count)
function calcDiamondGroupPrice(matrix, quality, totalWt, count) {
  if (!totalWt) return 0;
  const perCt = count > 0 ? totalWt / count : totalWt;
  const row = matrix.find(r =>
    r.quality === quality && perCt >= r.ctMin && perCt <= r.ctMax
  );
  if (!row) return 0;
  return row.price * totalWt;
}

export default async function handler(req, res) {

  const rawDomain    = (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '');
  const allowedOrigin = `https://${rawDomain}`;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      productId, productTitle,
      purityKt, quality, diamondType,
      solWt, sideWt,
      shape
    } = req.body;

    if (!productId || !productTitle || !purityKt || !quality || !diamondType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const purityInt = parseInt(purityKt, 10);
    if (!VALID_PURITIES.includes(purityInt)) {
      return res.status(400).json({ error: 'Invalid purity' });
    }
    if (!['lab', 'natural'].includes(diamondType)) {
      return res.status(400).json({ error: 'Invalid diamond type' });
    }

    console.log('SHOPIFY_STORE:', process.env.SHOPIFY_STORE);
    const token = await getAccessToken();

    const meta         = await getProductMetafields(productId, token);
    console.log('ALL metafields:', JSON.stringify(meta));

    const base18kt   = parseFloat(meta.gold_weight_18kt   || meta['custom.gold_weight_18kt']   || 0);
    const solCount   = parseInt( meta.solitaire_count     || meta['custom.solitaire_count']     || 0, 10);
    const sideCount  = parseInt( meta.side_count          || meta['custom.side_count']          || 0, 10);

    if (!base18kt) {
      return res.status(400).json({ error: 'Product gold weight not configured', debug_keys: Object.keys(meta) });
    }

    const solWtFloat  = parseFloat(solWt)  || 0;
    const sideWtFloat = parseFloat(sideWt) || 0;
    const totalCt     = +(solWtFloat + sideWtFloat).toFixed(3);

    const goldRates = await getGoldRates();
    const goldWt    = getGoldWeight(base18kt, purityInt);
    const goldPrice = goldWt * goldRates[purityInt];

    const matrix    = await getDiamondMatrix(diamondType, token);
    const solPrice  = calcDiamondGroupPrice(matrix, quality, solWtFloat,  solCount);
    const sidePrice = calcDiamondGroupPrice(matrix, quality, sideWtFloat, sideCount);

    const making   = MAKING_CHARGE_PER_GRAM * goldWt;
    const subtotal = goldPrice + solPrice + sidePrice + making;
    const gst      = subtotal * GST_RATE;
    const total    = Math.round(subtotal + gst);

    console.log('Price calc:', { goldPrice, solPrice, sidePrice, making, gst, total });

    const orderRes = await fetch(
      `https://${process.env.SHOPIFY_STORE}/admin/api/2025-01/draft_orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_order: {
            line_items: [{
              title:    productTitle,
              price:    total.toString(),
              quantity: 1,
              requires_shipping: true,
              properties: [
                { name: 'Gold Purity',         value: purityInt + 'kt'              },
                { name: 'Gold Weight',         value: goldWt.toFixed(2) + 'g'      },
                { name: 'Diamond Type',        value: diamondType                   },
                { name: 'Diamond Quality',     value: quality                       },
                { name: 'Total CT',            value: totalCt + 'ct'               },
                { name: 'Solitaire Count',     value: solCount + ' pcs'            },
                { name: 'Solitaire Weight',    value: solWtFloat + 'ct'            },
                { name: 'Side Diamond Count',  value: sideCount + ' pcs'           },
                { name: 'Side Diamond Weight', value: sideWtFloat + 'ct'           },
                { name: 'Diamond Shape',        value: shape || 'Not specified'       }
              ]
            }],
            note: `Orsia — ${purityInt}kt / ${totalCt}ct / ${quality} / ${diamondType}`
          }
        })
      }
    );
    const orderData = await orderRes.json();

    if (!orderData.draft_order) {
      return res.status(500).json({ error: 'Failed to create order', details: orderData });
    }

    return res.status(200).json({
      checkoutUrl:     orderData.draft_order.invoice_url,
      calculatedPrice: total,
      breakdown: {
        goldPrice:  Math.round(goldPrice),
        solPrice:   Math.round(solPrice),
        sidePrice:  Math.round(sidePrice),
        making:     Math.round(making),
        gst:        Math.round(gst),
        total
      }
    });

  } catch(err) {
    console.error('Orsia order error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
