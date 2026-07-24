// Orsia Jewels — Secure Price Calculator (Solitaire + Side Diamonds)
// Rewritten to use the GraphQL Admin API (2025-01+) so we can attach a real
// variant_id to the draft order line item AND override its price via
// lineItem.priceOverride — this makes the checkout show the product image
// while still charging the calculated price. (REST draft_orders.json
// ignores a custom `price` field when `variant_id` is present, so REST
// can't do this — confirmed via Shopify's own API changelog + community
// reports before switching.)

const MAKING_CHARGE_PER_GRAM = 2500;
const VALID_PURITIES         = [9, 14, 18];
const CURRENCY_CODE          = process.env.SHOP_CURRENCY_CODE || 'INR';
const API_VERSION            = '2025-01'; // priceOverride requires 2025-01+

// Weight-only karat factors. Admin enters 18K weight; code derives other karats.
// Rates are NOT derived here — they come directly from the gold-rates proxy.
const KARAT_WEIGHT_FACTOR = { 18: 0.79, 14: 0.62, 9: 0.40 };

// Matches the front-end's r2() exactly — floors to 2 decimals, NOT round/toFixed.
// Keeping this identical on both sides is required so checkout price always
// matches what the customer saw on the PDP.
function r2(n) {
  return Math.floor(parseFloat(n) * 100) / 100;
}

// base18k = admin-entered 18K weight for this CT option (from product metafield)
// Derives 24K first (÷ 0.79), then scales to the selected karat
function getGoldWeight(base18k, purityKt) {
  const base24k  = r2(base18k) / KARAT_WEIGHT_FACTOR[18];       // ÷ 0.79 → 24K
  const factor   = KARAT_WEIGHT_FACTOR[purityKt] || KARAT_WEIGHT_FACTOR[18];
  return r2(base24k * factor);
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

// ── Shared GraphQL helper ────────────────────────────────────────────────
async function shopifyGraphQL(query, variables, token) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    }
  );
  const data = await res.json();
  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors));
    throw new Error(data.errors[0]?.message || 'GraphQL request failed');
  }
  return data.data;
}

function toProductGid(productId) {
  return String(productId).startsWith('gid://')
    ? productId
    : `gid://shopify/Product/${productId}`;
}

// ── Live gold rate fetch — returns per-karat rates directly from proxy ────────
// (External Vercel proxy — unrelated to Shopify's API, stays REST.)
async function getGoldRates() {
  try {
    const res = await fetch('https://orsia-jewels.vercel.app/api/gold-rates', {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    if (data.rate18k && data.rate18k > 1000) {
      console.log('Gold rates from proxy:', data);
      return { 18: data.rate18k, 14: data.rate14k, 9: data.rate9k };
    }
    throw new Error('Invalid rates from proxy');
  } catch(err) {
    console.warn('Gold rate proxy failed:', err.message);
    return { 18: 11320, 14: 8884, 9: 5732 };
  }
}

// ── Product metafields via GraphQL ──────────────────────────────────────
async function getProductMetafields(productId, token) {
  const query = `
    query GetProductMetafields($id: ID!) {
      product(id: $id) {
        metafields(namespace: "custom", first: 50) {
          edges {
            node { key value namespace }
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, { id: toProductGid(productId) }, token);
  const edges = data.product?.metafields?.edges || [];
  const fields = {};
  edges.forEach(({ node }) => {
    fields[node.key] = node.value;
    fields[`${node.namespace}.${node.key}`] = node.value;
  });
  return fields;
}

// ── First variant + its catalog price (for image + price-override decision) ─
async function getVariantForPrice(productId, token) {
  const query = `
    query GetFirstVariant($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node { id price }
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, { id: toProductGid(productId) }, token);
  const edge = data.product?.variants?.edges?.[0];
  if (!edge) return null;
  return { id: edge.node.id, price: parseFloat(edge.node.price) || 0 };
}

async function getDiamondMatrix(diamondType, token) {
  const handle = diamondType === 'lab' ? 'lab_diamond_matrix' : 'natural_diamond_matrix';

  const query = `
    query GetMatrix($type: String!) {
      metaobjects(type: $type, first: 250) {
        edges {
          node {
            fields { key value }
          }
        }
      }
    }
  `;

  const data = await shopifyGraphQL(query, { type: handle }, token);
  const edges = data.metaobjects?.edges || [];
  console.log(`Diamond matrix (${handle}): ${edges.length} rows fetched`);

  return edges.map(({ node }) => {
    const f = {};
    (node.fields || []).forEach(field => { f[field.key] = field.value; });
    return {
      quality: f.quality_label || '',
      ctMin:   parseFloat(f.ct_min || 0),
      ctMax:   parseFloat(f.ct_max || 0),
      price:   parseInt(f.price_per_ct || 0, 10)
    };
  });
}

function calcDiamondGroupPrice(matrix, quality, totalWt, count) {
  if (!totalWt) return 0;
  // Trim per-stone CT to 2dp before matrix lookup — must match front-end exactly,
  // otherwise a weight near a bucket boundary can select a different price row.
  const perCt = r2(count > 0 ? totalWt / count : totalWt);
  const row = matrix.find(r => {
    const ctMinR = r2(r.ctMin);
    const ctMaxR = r2(r.ctMax);
    return r.quality === quality && perCt >= ctMinR && perCt <= ctMaxR;
  });
  if (!row) return 0;
  return row.price * totalWt;
}

// ── Draft order creation via GraphQL ────────────────────────────────────
async function createDraftOrderGraphQL(lineItem, note, token) {
  const query = `
    mutation CreateDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          invoiceUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const data = await shopifyGraphQL(
    query,
    { input: { lineItems: [lineItem], note } },
    token
  );

  const result = data.draftOrderCreate;
  if (result.userErrors && result.userErrors.length > 0) {
    console.error('draftOrderCreate userErrors:', JSON.stringify(result.userErrors));
    throw new Error(result.userErrors.map(e => e.message).join('; '));
  }
  return result.draftOrder;
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
      purityKt, metalLabel, quality, diamondType,
      solWt, sideWt,
      ctIndex,                  // ← index of selected CT option (0-based), sent by front-end
      shape, ringSize, certType, engravingText
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

    const ctIdx = parseInt(ctIndex, 10) || 0;

    console.log('SHOPIFY_STORE:', process.env.SHOPIFY_STORE);
    const token = await getAccessToken();

    const meta = await getProductMetafields(productId, token);
    console.log('ALL metafields:', JSON.stringify(meta));

    // ── Read the 18K gold weight options list ──────────────────────────────
    // Metafield: custom.gold_weight_18kt_options  (type: list.number_decimal)
    // Admin enters 18K gross weights in grams, one per solitaire_ct_options entry.
    // Code derives: 24K = 18K ÷ 0.79, then 14K = 24K × 0.62, 9K = 24K × 0.40
    const goldWt18kOptionsRaw = meta.gold_weight_18kt_options
      || meta['custom.gold_weight_18kt_options']
      || '[]';

    let goldWt18kOptions = [];
    try {
      goldWt18kOptions = JSON.parse(goldWt18kOptionsRaw);
    } catch(e) {
      const n = parseFloat(goldWt18kOptionsRaw);
      if (n > 0) goldWt18kOptions = [n];
    }

    const base18k = parseFloat(goldWt18kOptions[ctIdx]) || 0;

    if (!base18k) {
      return res.status(400).json({
        error: 'Gold weight not configured for this CT option',
        debug: { ctIdx, goldWt18kOptions, debug_keys: Object.keys(meta) }
      });
    }

    const solCount  = parseInt(meta.solitaire_count  || meta['custom.solitaire_count']  || 0, 10);
    const sideCount = parseInt(meta.side_count        || meta['custom.side_count']        || 0, 10);

    const solWtFloat  = parseFloat(solWt)  || 0;
    const sideWtFloat = parseFloat(sideWt) || 0;
    const totalCt     = +(solWtFloat + sideWtFloat).toFixed(3);

    // ── Gold weight and rate for the selected purity ───────────────────────
    const goldRates = await getGoldRates();
    const goldWt    = getGoldWeight(base18k, purityInt);   // derives 24K then scales to karat
    const goldPrice = goldWt * goldRates[purityInt];

    const matrix    = await getDiamondMatrix(diamondType, token);
    const solPrice  = calcDiamondGroupPrice(matrix, quality, solWtFloat,  solCount);
    const sidePrice = calcDiamondGroupPrice(matrix, quality, sideWtFloat, sideCount);

    const making   = MAKING_CHARGE_PER_GRAM * goldWt;
    const subtotal = goldPrice + solPrice + sidePrice + making;
    const certPrice = certType ? 1000 : 0;
    // GST is no longer added here — Shopify's own tax settings (Settings →
    // Taxes and duties) apply GST automatically on the draft order based on
    // the customer's address, so the price sent to Shopify is tax-exclusive.
    const total    = Math.round(subtotal) + certPrice;

    console.log('Price calc:', {
      base18k, goldWt, goldRate: goldRates[purityInt],
      goldPrice, solPrice, sidePrice, making, total
    });

    // ── Friendly display values for order properties ───────────────────────
    // metalLabel arrives as the full label (e.g. "18K Yellow Gold") — pull
    // just the color word out of it for the "Metal Color" property.
    const colorMatch  = (metalLabel || '').match(/Yellow|White|Rose/i);
    const colorName   = colorMatch ? colorMatch[0] : 'Yellow';
    const diamondTypeLabel = diamondType === 'lab' ? 'Lab Grown Diamond' : 'Natural Diamond';

    const commonAttributes = [
      { key: 'Gold Purity',         value: purityInt + 'kt'              },
      { key: 'Metal Color',         value: colorName                     },
      { key: 'Gold Weight',         value: goldWt.toFixed(3) + 'g'      },
      { key: 'Diamond Type',        value: diamondTypeLabel              },
      { key: 'Diamond Quality',     value: quality                       },
      { key: 'Total CT',            value: totalCt + 'ct'               },
      ...(solWtFloat  > 0 ? [{ key: 'Solitaire Count',     value: solCount + ' pcs' }] : []),
      ...(solWtFloat  > 0 ? [{ key: 'Solitaire Weight',    value: solWtFloat + 'ct' }] : []),
      ...(sideWtFloat > 0 ? [{ key: 'Side Diamond Count',  value: sideCount + ' pcs' }] : []),
      ...(sideWtFloat > 0 ? [{ key: 'Side Diamond Weight', value: sideWtFloat + 'ct' }] : []),
      ...(ringSize      ? [{ key: 'Ring Size',       value: ringSize      }] : []),
      ...(shape         ? [{ key: 'Diamond Shape',   value: shape         }] : []),
      ...(certType      ? [{ key: 'Certificate',     value: certType      }] : []),
      ...(engravingText ? [{ key: 'Engraving Text',  value: engravingText }] : [])
    ];

    // ── Attach a real variant so checkout shows the product image ──────────
    // priceOverride works only on GraphQL (2025-01+) with a variantId set —
    // REST's draft_orders.json ignores a custom `price` when variant_id is
    // present, which is why this order-creation flow moved to GraphQL.
    const variant = await getVariantForPrice(productId, token);

    let lineItem;
    if (variant) {
      lineItem = {
        variantId: variant.id,
        quantity: 1,
        priceOverride: {
          amount: total.toFixed(2),
          currencyCode: CURRENCY_CODE
        },
        customAttributes: commonAttributes
      };
    } else {
      // No variant found — fall back to a custom line item (no image).
      lineItem = {
        title: productTitle,
        quantity: 1,
        originalUnitPriceWithCurrency: {
          amount: total.toFixed(2),
          currencyCode: CURRENCY_CODE
        },
        requiresShipping: true,
        customAttributes: commonAttributes
      };
    }

    const note = `Orsia — ${purityInt}kt / ${totalCt}ct / ${quality} / ${diamondType}`;
    const draftOrder = await createDraftOrderGraphQL(lineItem, note, token);

    if (!draftOrder) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    return res.status(200).json({
      checkoutUrl:     draftOrder.invoiceUrl,
      calculatedPrice: total,
      breakdown: {
        goldWeight18k:   base18k,
        goldWeightActual: goldWt,
        goldRate:      goldRates[purityInt],
        goldPrice:     Math.round(goldPrice),
        solPrice:      Math.round(solPrice),
        sidePrice:     Math.round(sidePrice),
        making:        Math.round(making),
        total
      }
    });

  } catch(err) {
    console.error('Orsia order error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
