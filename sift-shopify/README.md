# Sift - Intelligent Shopify Storefront Search

Sift is a hybrid search solution for Shopify storefronts that combines lexical full-text search with vector similarity search to deliver highly relevant product results.

## Features

- **Hybrid Search**: Combines PostgreSQL full-text search with pgvector similarity search
- **Shopify Integration**: Full OAuth flow, webhooks, and App Proxy support
- **Bulk Backfill**: GraphQL bulk operations for efficiently syncing large catalogs
- **Manual Overrides**: Pin, boost, demote, or exclude products from search results
- **A/B Testing**: Built-in control/treatment variant tracking for analytics
- **Real-time Sync**: Webhook-driven updates for products and inventory
- **Admin Dashboard**: Complete management UI with analytics and search testing

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Shopify       │────▶│   Sift API      │────▶│   PostgreSQL    │
│   (Webhooks)    │     │   (NestJS)      │     │   (pgvector)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
┌─────────────────┐     ┌────────▼────────┐     ┌─────────────────┐
│   Storefront    │────▶│   App Proxy     │     │   Redis         │
│   (Theme)       │     │   /proxy/search │     │   (BullMQ)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   Admin UI      │
                        │   (Next.js)     │
                        └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- A Shopify Partner account (for production use)

### Run Locally (Demo Mode)

1. Clone the repository and navigate to the project:

```bash
cd sift-shopify
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Start all services with a single command:

```bash
docker compose up --build
```

4. Access the applications:
   - **Admin UI**: http://localhost:3000
   - **API**: http://localhost:4000
   - **API Health**: http://localhost:4000/health

In demo mode, sample product data is automatically seeded, allowing you to test the full search functionality without Shopify credentials.

## Shopify App Setup

### 1. Create a Shopify App

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to Apps → Create app
3. Choose "Create app manually"
4. Note your **API Key** and **API Secret Key**

### 2. Configure App Settings

In your Shopify app settings:

**App URL:**
```
https://your-domain.com
```

**Allowed redirection URLs:**
```
https://your-domain.com/auth/callback
```

**App Proxy:**
- Subpath prefix: `apps`
- Subpath: `sift`
- Proxy URL: `https://your-domain.com/proxy`

### 3. Update Environment Variables

```bash
SHOPIFY_API_KEY=your_api_key_from_shopify
SHOPIFY_API_SECRET=your_api_secret_from_shopify
DEMO_MODE=false
APP_URL=https://your-domain.com
```

### 4. Required OAuth Scopes

The app requests these scopes by default:
- `read_products` - Access product data
- `read_inventory` - Access inventory levels
- `read_locations` - Access location data
- `read_metafields` - Access product metafields
- `read_product_listings` - Access product listings
- `read_publications` - Access publication data

## Installing on a Development Store

### 1. Start the Installation

Navigate to the install page and enter your shop domain:

```
http://localhost:3000/install
```

Or trigger installation via URL:

```
http://localhost:4000/auth/install?shop=your-store.myshopify.com
```

### 2. Authorize the App

You'll be redirected to Shopify to authorize the app. Accept the permissions request.

### 3. Trigger Initial Backfill

After installation, trigger a full catalog sync:

**Via Admin UI:**
1. Go to Dashboard → your shop
2. Click "Start Backfill"

**Via API:**
```bash
curl -X POST "http://localhost:4000/admin/backfill?shop=your-store.myshopify.com"
```

### 4. Monitor Sync Status

Check the sync status in the admin dashboard or via API:

```bash
curl "http://localhost:4000/admin/status?shop=your-store.myshopify.com"
```

## Adding Search to Your Theme

### 1. Copy Theme Assets

Copy the contents of the `theme/` directory to your Shopify theme:

- `snippets/sift-search.liquid` → Theme snippets
- `assets/sift-search.js` → Theme assets

### 2. Include the Snippet

Add to your theme (e.g., in `search.liquid` or a custom section):

```liquid
{% render 'sift-search' %}
```

### 3. Configure the JavaScript

The search script automatically uses the App Proxy endpoint:

```javascript
// The script calls: /apps/sift/search?q=query
```

## Testing Search

### Using the Admin Search Console

1. Navigate to http://localhost:3000/dashboard/search
2. Enter a search query
3. Select variant (control or treatment)
4. Optionally specify a region
5. View results with relevance scores

### Using the API Directly

```bash
# Search via App Proxy (requires signature in production)
curl "http://localhost:4000/proxy/search?shop=demo-store.myshopify.com&q=shirt"

# With optional parameters
curl "http://localhost:4000/proxy/search?shop=demo-store.myshopify.com&q=shirt&region=US&session_id=abc123"
```

### Response Format

```json
{
  "results": [
    {
      "variantId": "gid://shopify/ProductVariant/123",
      "productId": "gid://shopify/Product/456",
      "handle": "blue-cotton-shirt",
      "title": "Blue Cotton Shirt",
      "variantTitle": "Medium",
      "vendor": "Brand Co",
      "productType": "Shirts",
      "price": "29.99",
      "currency": "USD",
      "available": true,
      "inventoryQuantity": 50,
      "score": 0.892,
      "imageUrl": "https://cdn.shopify.com/...",
      "options": { "Size": "Medium", "Color": "Blue" }
    }
  ],
  "query": "shirt",
  "totalResults": 15,
  "variant": "treatment"
}
```

## Analytics

### Viewing Analytics

Navigate to http://localhost:3000/dashboard/analytics to see:

- Search volume over time
- Top queries
- Click-through rates by variant
- Conversion metrics (if purchase events are tracked)

### Recording Events

The search console allows simulating clicks and purchases:

1. Perform a search
2. Click a product card to record a click event
3. Use the purchase button to simulate a conversion

### API for Recording Events

```bash
# Record a click
curl -X POST "http://localhost:4000/analytics/click" \
  -H "Content-Type: application/json" \
  -d '{"searchEventId": "evt_123", "variantId": "gid://shopify/ProductVariant/123"}'

# Record a purchase
curl -X POST "http://localhost:4000/analytics/purchase" \
  -H "Content-Type: application/json" \
  -d '{"searchEventId": "evt_123", "variantId": "gid://shopify/ProductVariant/123", "revenue": 29.99}'
```

## Managing Overrides

### Override Types

- **Pin**: Force product to top of results for matching scope
- **Boost**: Increase relevance score (weight > 1.0)
- **Demote**: Decrease relevance score (weight < 1.0)
- **Exclude**: Remove from results entirely

### Scope Types

- **Query**: Applies when search matches specific query
- **Category**: Applies to searches within a product type
- **Global**: Applies to all searches

### Creating Overrides

**Via Admin UI:**
1. Navigate to http://localhost:3000/dashboard/overrides
2. Click "Add Override"
3. Configure scope, action, and weight

**Via API:**
```bash
curl -X POST "http://localhost:4000/admin/overrides" \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "your-store.myshopify.com",
    "scopeType": "query",
    "scopeValue": "summer",
    "variantId": "gid://shopify/ProductVariant/123",
    "action": "pin",
    "weight": 1.0
  }'
```

## Development

### Project Structure

```
sift-shopify/
├── docker-compose.yml
├── .env.example
├── README.md
├── apps/
│   ├── api/                 # NestJS Backend
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── main.ts
│   │       └── modules/
│   │           ├── auth/       # Shopify OAuth
│   │           ├── shopify/    # Shopify API client
│   │           ├── ingest/     # Webhook & backfill processing
│   │           ├── search/     # Hybrid search engine
│   │           ├── analytics/  # Event tracking
│   │           ├── overrides/  # Manual ranking overrides
│   │           └── health/     # Health checks
│   └── web/                 # Next.js Frontend
│       ├── Dockerfile
│       ├── package.json
│       └── app/
│           ├── page.tsx        # Marketing page
│           ├── install/        # Shop installation
│           └── dashboard/      # Admin dashboard
│               ├── page.tsx    # Overview
│               ├── search/     # Search testing
│               ├── analytics/  # Analytics charts
│               └── overrides/  # Override management
└── theme/                   # Shopify theme assets
    ├── snippets/
    │   └── sift-search.liquid
    └── assets/
        └── sift-search.js
```

### Running Without Docker

**API:**
```bash
cd apps/api
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

**Web:**
```bash
cd apps/web
npm install
npm run dev
```

### Running Tests

```bash
# API tests
cd apps/api
npm test

# Web tests
cd apps/web
npm test
```

## Security

### Webhook Verification

All incoming webhooks are verified using HMAC-SHA256:

```typescript
const hmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET);
hmac.update(rawBody);
const calculatedHmac = hmac.digest('base64');
// Compare with X-Shopify-Hmac-Sha256 header
```

### App Proxy Signature Verification

App Proxy requests include a signature that must be verified:

```typescript
// Parameters are sorted, concatenated, and hashed
const signature = crypto.createHmac('sha256', SHOPIFY_API_SECRET)
  .update(sortedParams)
  .digest('hex');
```

### Access Token Encryption

Access tokens are encrypted at rest using AES-256-GCM:

```typescript
// Encryption uses ENCRYPTION_KEY from environment
const encrypted = encrypt(accessToken, process.env.ENCRYPTION_KEY);
```

## Troubleshooting

### Webhooks Not Received

1. Ensure your app URL is publicly accessible
2. Check webhook registration in Shopify admin
3. Verify HMAC signature configuration
4. Check API logs for verification failures

### Search Returns No Results

1. Verify backfill completed successfully
2. Check that products have required fields (title, etc.)
3. Ensure embeddings were generated
4. Check search index status via `/admin/status`

### OAuth Errors

1. Verify redirect URL matches Shopify app settings exactly
2. Ensure API key and secret are correct
3. Check shop domain format (must end in .myshopify.com)

## License

MIT License - see LICENSE file for details.
