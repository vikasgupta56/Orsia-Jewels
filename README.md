# Orsia Jewels — Price Calculator (Vercel)

Secure serverless function that:
1. Receives customer selections from the product page widget
2. Fetches live gold rates from GPE metafields
3. Calculates the correct price server-side
4. Creates a Shopify Draft Order at that price
5. Returns the checkout URL to the customer

---

## Setup Instructions

### Step 1 — Create Shopify Private App Token

1. Shopify Admin → Settings → Apps → Develop apps
2. Click "Create an app" → name it "Orsia Price Calculator"
3. Go to Configuration → Admin API scopes → enable:
   - `read_products`
   - `write_draft_orders`
   - `read_metafields`
4. Click Save → Install app
5. Copy the "Admin API access token" (starts with shpat_)
   ⚠️ You only see this once — copy it immediately

### Step 2 — Deploy to Vercel

1. Create a free account at vercel.com
2. Install Vercel CLI:
   ```
   npm install -g vercel
   ```
3. Inside this folder, run:
   ```
   vercel deploy
   ```
4. Follow the prompts — choose "No" for existing project, create new

### Step 3 — Add Environment Variables in Vercel

1. Go to vercel.com → your project → Settings → Environment Variables
2. Add these three variables:

   | Name | Value |
   |------|-------|
   | SHOPIFY_STORE | your-store.myshopify.com |
   | SHOPIFY_STORE_DOMAIN | your-actual-domain.com |
   | SHOPIFY_TOKEN | shpat_xxxxxxxxxx |

3. After adding, go to Deployments → Redeploy

### Step 4 — Update your Shopify liquid file

Replace `YOUR-APP.vercel.app` in the liquid file with your actual Vercel URL.
Your Vercel URL looks like: `orsia-price-calculator.vercel.app`

The fetch call in your liquid file should be:
```
https://orsia-price-calculator.vercel.app/api/create-order
```

### Step 5 — Test

1. Visit any product page
2. Select purity + CT + quality
3. Click Calculate
4. Click Buy Now
5. Confirm you land on Shopify checkout at the correct price

---

## File Structure

```
orsia-vercel/
├── api/
│   └── create-order.js   ← Main function (all logic lives here)
├── .env.example          ← Template for environment variables
├── .gitignore            ← Prevents .env from being committed
├── package.json          ← Project config
├── vercel.json           ← Vercel config
└── README.md             ← This file
```

---

## Updating Diamond Prices

If your diamond matrix prices change, edit `api/create-order.js` —
find the `DIAMOND_MATRIX` array at the top and update the price values.
Then redeploy:
```
vercel deploy --prod
```

## Updating Making Charges

Find `MAKING_CHARGE_PER_GRAM` at the top of `api/create-order.js`
and change the value. Then redeploy.

---

## Security

- Browser never sends the price — only selections (purity, CT, quality)
- All calculation happens server-side on Vercel
- Shopify token never exposed to browser
- CORS restricted to your store domain only
- All inputs validated before processing
