# MASTER SYSTEM PROMPT — MULTI-SITE E-COMMERCE & LOCAL BUSINESS PLATFORM
## Complete Build Specification v1.0

> This document is the single source of truth for building the entire platform.
> Every feature, workflow, API endpoint, database table, UI screen, AI integration,
> and deployment step is defined here. Read the entire document before writing a
> single line of code. Do not assume anything not written here.

---

# PART 1 — SYSTEM OVERVIEW

## What This System Is

A self-hosted, multi-site platform running on a single VPS that manages 6–15
e-commerce stores and local business websites simultaneously. Every site is
visually unique (different design, different branding) but shares one backend
API, one database, one payment system, one order management system, and one
super admin panel that controls everything.

The platform has five layers:

1. **Infrastructure layer** — VPS, Nginx, PostgreSQL, Redis, MinIO, PM2
2. **Shared API layer** — One Node/Express API serving all sites
3. **Super Admin Panel** — One Next.js dashboard controlling all sites
4. **Per-site Admin Panels** — Scoped Next.js dashboards per site
5. **Public Sites** — N unique Next.js frontends, one per site

## Core Design Principles

- Every site shares the same backend but has a completely unique frontend design
- The `site_id` UUID is the universal key that scopes all data to a specific site
- The super admin has zero restrictions — it sees and controls everything
- Per-site admins are fully sandboxed — they can only see their own site_id data
- All AI processing is queued via BullMQ and runs asynchronously — never blocking
- All media (images, videos) is stored in MinIO (self-hosted S3-compatible)
- All sensitive keys (API keys, payment keys) are stored encrypted in the DB
- Every public-facing page must pass Lighthouse ≥ 90 on all four categories

---

# PART 2 — INFRASTRUCTURE SETUP

## Server Requirements

- Ubuntu 24.04 LTS
- Minimum 8GB RAM, 4 vCPU, 200GB SSD
- Separate backup disk or Backblaze B2 bucket for DB backups

## Software Stack

```
Nginx              — reverse proxy, SSL termination, rate limiting
PM2                — Node.js process manager, auto-restart on crash
PostgreSQL 16      — primary database
Redis 7            — caching layer + BullMQ job queues
MinIO              — self-hosted S3-compatible object storage for all media
OpenReplay         — self-hosted session recording and heatmap engine
Uptime Kuma        — self-hosted uptime monitoring for all sites
Sentry (self-host) — error tracking across all apps
Certbot            — SSL certificate auto-renewal via cron
MeiliSearch        — full-text product search engine
```

## Port Allocation

```
80, 443     Nginx (public)
3001–3015   Next.js public sites (one port per site)
4000        Super admin panel
4001        Per-site admin panels (all sites share one admin app, scoped by site_id)
5000        Shared Express API
5432        PostgreSQL
6379        Redis
9000        MinIO API
9001        MinIO web console
7700        MeiliSearch
3100        OpenReplay
3200        Uptime Kuma
9090        Sentry (self-hosted)
```

## Nginx Configuration Rules

- Every public domain proxies to its assigned Next.js port
- All HTTP traffic 301-redirects to HTTPS
- Nginx handles SSL termination via Certbot certificates
- Security headers set at Nginx level for all sites:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Rate limiting: 100 requests/minute per IP on API routes
- Gzip compression enabled for all text responses

## PM2 Configuration

- All processes defined in a single `ecosystem.config.js` at `/projects/ecosystem.config.js`
- PM2 set to auto-start on server reboot via `pm2 startup`
- Each process has a max memory restart limit of 1GB
- Logs stored at `/projects/logs/[app-name].log`
- Log rotation configured — keep last 30 days, max 50MB per file

## Backup Strategy

- PostgreSQL full backup every night at 2:00 AM via cron
- Backups compressed with gzip and uploaded to Backblaze B2
- Keep last 30 daily backups, last 12 weekly backups, last 3 monthly backups
- MinIO media files synced to Backblaze B2 daily
- Backup restore script at `/projects/scripts/restore-backup.sh`
- Backup success/failure alert sent via email every morning at 6:00 AM

## SSL Auto-Renewal

```bash
# Cron job — runs daily at 3:00 AM
0 3 * * * certbot renew --quiet && nginx -s reload
```

---

# PART 3 — DATABASE SCHEMA (PostgreSQL)

## Core Tables

### sites
```sql
CREATE TABLE sites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain            TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','maintenance','disabled')),
  config            JSONB NOT NULL DEFAULT '{}',
  -- config contains: primaryColor, secondaryColor, logoUrl, faviconUrl,
  --   fontHeading, fontBody, ga4Id, gscPropertyId, razorpayKeyId,
  --   stripePublishableKey, smtpHost, smtpPort, smtpUser, gmb_url,
  --   nap (name/address/phone object), social (instagram/facebook/youtube),
  --   openreplay_project_key, meta_pixel_id, google_ads_customer_id
  pm2_process_name  TEXT,
  nginx_port        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','site_admin','editor','viewer')),
  is_active     BOOLEAN DEFAULT true,
  totp_secret   TEXT,
  totp_enabled  BOOLEAN DEFAULT false,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### user_site_access
```sql
-- Links site_admin/editor/viewer users to specific sites
CREATE TABLE user_site_access (
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  site_id   UUID REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, site_id)
);
```

### categories
```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id),
  parent_id   UUID REFERENCES categories(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  meta_title  TEXT,
  meta_desc   TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, slug)
);
```

### products
```sql
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               UUID NOT NULL REFERENCES sites(id),
  category_id           UUID REFERENCES categories(id),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  original_name         TEXT,       -- raw name from Meesho before AI rewrite
  description           TEXT,       -- AI-enhanced description
  original_description  TEXT,       -- raw description from Meesho
  short_description     TEXT,
  sku                   TEXT,
  mpn                   TEXT,
  brand                 TEXT,
  price                 DECIMAL(10,2) NOT NULL,
  compare_price         DECIMAL(10,2),
  cost_price            DECIMAL(10,2),
  currency              TEXT DEFAULT 'INR',
  stock_quantity        INTEGER DEFAULT 0,
  low_stock_threshold   INTEGER DEFAULT 5,
  track_inventory       BOOLEAN DEFAULT true,
  status                TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','inactive','out_of_stock')),
  is_featured           BOOLEAN DEFAULT false,
  weight                DECIMAL(8,2),
  dimensions            JSONB,      -- {length, width, height, unit}
  tags                  TEXT[],
  meta_title            TEXT,
  meta_desc             TEXT,
  source                TEXT DEFAULT 'manual' CHECK (source IN ('manual','meesho','import')),
  source_id             TEXT,       -- Meesho product ID
  source_url            TEXT,       -- original Meesho URL
  ai_description_status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  ai_image_status       TEXT DEFAULT 'pending',
  gmc_category          TEXT,       -- Google Product Category
  gtin                  TEXT,
  condition             TEXT DEFAULT 'new',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, slug)
);
```

### product_images
```sql
CREATE TABLE product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES sites(id),
  url           TEXT NOT NULL,        -- MinIO URL
  original_url  TEXT,                 -- source URL (Meesho)
  alt_text      TEXT,
  sort_order    INTEGER DEFAULT 0,
  is_primary    BOOLEAN DEFAULT false,
  source        TEXT DEFAULT 'manual' CHECK (source IN ('manual','meesho','ai_generated')),
  width         INTEGER,
  height        INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### product_variants
```sql
CREATE TABLE product_variants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  site_id      UUID NOT NULL REFERENCES sites(id),
  name         TEXT NOT NULL,          -- e.g. "Red / XL"
  sku          TEXT,
  price        DECIMAL(10,2),
  stock        INTEGER DEFAULT 0,
  options      JSONB NOT NULL,         -- {color: "Red", size: "XL"}
  image_url    TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### product_videos
```sql
CREATE TABLE product_videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  site_id      UUID NOT NULL REFERENCES sites(id),
  url          TEXT NOT NULL,          -- MinIO URL
  thumbnail    TEXT,
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual','ai_generated')),
  duration_sec INTEGER,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### reviews
```sql
CREATE TABLE reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  site_id          UUID NOT NULL REFERENCES sites(id),
  author_name      TEXT NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title            TEXT,
  body             TEXT,
  original_body    TEXT,               -- raw text from Meesho before filtering
  source           TEXT DEFAULT 'site' CHECK (source IN ('site','meesho','import')),
  source_id        TEXT,               -- Meesho review ID
  is_approved      BOOLEAN DEFAULT false,
  is_verified      BOOLEAN DEFAULT false,
  contains_meesho  BOOLEAN DEFAULT false,  -- flagged if "meesho" found in text
  helpful_count    INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  approved_at      TIMESTAMPTZ
);
```

### review_images
```sql
CREATE TABLE review_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES sites(id),
  url         TEXT NOT NULL,           -- MinIO URL (re-hosted, not Meesho CDN)
  original_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### orders
```sql
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  order_number      TEXT NOT NULL,
  customer_id       UUID REFERENCES customers(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','processing',
                                      'shipped','delivered','cancelled','refunded')),
  payment_status    TEXT DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','paid','partial','refunded')),
  payment_method    TEXT,
  payment_gateway   TEXT,             -- 'razorpay' or 'stripe'
  payment_id        TEXT,             -- gateway transaction ID
  subtotal          DECIMAL(10,2) NOT NULL,
  discount          DECIMAL(10,2) DEFAULT 0,
  shipping          DECIMAL(10,2) DEFAULT 0,
  tax               DECIMAL(10,2) DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL,
  currency          TEXT DEFAULT 'INR',
  shipping_address  JSONB NOT NULL,
  billing_address   JSONB,
  notes             TEXT,
  meta              JSONB,            -- UTM params, device, source
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, order_number)
);
```

### order_items
```sql
CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id),
  variant_id   UUID REFERENCES product_variants(id),
  name         TEXT NOT NULL,
  sku          TEXT,
  quantity     INTEGER NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  total        DECIMAL(10,2) NOT NULL,
  image_url    TEXT
);
```

### customers
```sql
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id),
  email         TEXT NOT NULL,
  phone         TEXT,
  name          TEXT NOT NULL,
  password_hash TEXT,
  is_guest      BOOLEAN DEFAULT false,
  total_orders  INTEGER DEFAULT 0,
  total_spent   DECIMAL(10,2) DEFAULT 0,
  meta          JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, email)
);
```

### blog_posts
```sql
CREATE TABLE blog_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES sites(id),
  author_id      UUID REFERENCES users(id),
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL,
  body           TEXT,
  excerpt        TEXT,
  hero_image_url TEXT,
  status         TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  published_at   TIMESTAMPTZ,
  scheduled_at   TIMESTAMPTZ,
  meta_title     TEXT,
  meta_desc      TEXT,
  tags           TEXT[],
  ai_status      TEXT DEFAULT 'human',  -- 'ai_draft','needs_review','approved'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, slug)
);
```

### redirects
```sql
CREATE TABLE redirects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id),
  from_path   TEXT NOT NULL,
  to_path     TEXT NOT NULL,
  type        INTEGER DEFAULT 301 CHECK (type IN (301, 302)),
  hits        INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, from_path)
);
```

### ai_jobs
```sql
CREATE TABLE ai_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES sites(id),
  job_type      TEXT NOT NULL,
  -- job_type values: 'rewrite_description', 'generate_image', 'generate_video',
  --   'enhance_review', 'seo_meta', 'seo_schema', 'seo_audit', 'content_brief'
  entity_type   TEXT,             -- 'product', 'category', 'blog_post', 'page'
  entity_id     UUID,
  status        TEXT DEFAULT 'queued'
                CHECK (status IN ('queued','processing','done','failed','needs_approval')),
  input         JSONB,            -- inputs to the AI model
  output        JSONB,            -- raw AI response
  model_used    TEXT,             -- which model processed this
  prompt_used   TEXT,             -- exact prompt sent
  tokens_used   INTEGER,
  error         TEXT,
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### ai_model_config
```sql
CREATE TABLE ai_model_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id),  -- NULL = global default
  provider    TEXT NOT NULL,
  -- provider values: 'openrouter','deepseek','sarvam','claude','openai','google'
  api_key_enc TEXT NOT NULL,    -- AES-256 encrypted API key
  model_id    TEXT NOT NULL,    -- e.g. 'claude-sonnet-4-6', 'gpt-4o', etc.
  task        TEXT NOT NULL,
  -- task values: 'description_rewrite','image_generation','video_generation',
  --   'seo_meta','seo_audit','content_brief','review_filter','translation',
  --   'title_rewrite','schema_generation','ad_copy','landing_page_copy'
  is_active   BOOLEAN DEFAULT true,
  parameters  JSONB DEFAULT '{}',  -- temperature, max_tokens, style_prompt, etc.
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, task)     -- one active model per task per site
);
```

### landing_pages
```sql
CREATE TABLE landing_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  blocks      JSONB NOT NULL DEFAULT '[]',  -- array of block definitions
  meta_title  TEXT,
  meta_desc   TEXT,
  status      TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, slug)
);
```

### ab_tests
```sql
CREATE TABLE ab_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),
  name            TEXT NOT NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  success_metric  TEXT NOT NULL,
  -- 'purchase','add_to_cart','form_submit','scroll_50','scroll_80','time_on_page'
  traffic_split   JSONB NOT NULL,    -- [{variant_id, percentage}]
  winner_id       UUID REFERENCES landing_pages(id),
  significance    DECIMAL(5,2),      -- statistical significance % when completed
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### ab_test_variants
```sql
CREATE TABLE ab_test_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id          UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  landing_page_id  UUID NOT NULL REFERENCES landing_pages(id),
  name             TEXT NOT NULL,
  traffic_pct      INTEGER NOT NULL,
  visitors         INTEGER DEFAULT 0,
  conversions      INTEGER DEFAULT 0,
  revenue          DECIMAL(10,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### meesho_import_log
```sql
CREATE TABLE meesho_import_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(id),
  source_url    TEXT NOT NULL,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','failed')),
  products_found    INTEGER DEFAULT 0,
  products_imported INTEGER DEFAULT 0,
  reviews_found     INTEGER DEFAULT 0,
  reviews_imported  INTEGER DEFAULT 0,
  reviews_skipped   INTEGER DEFAULT 0,  -- those containing "meesho"
  images_downloaded INTEGER DEFAULT 0,
  error             TEXT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);
```

### seo_audit_results
```sql
CREATE TABLE seo_audit_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID NOT NULL REFERENCES sites(id),
  page_url     TEXT NOT NULL,
  audit_type   TEXT NOT NULL,
  severity     TEXT CHECK (severity IN ('critical','warning','info')),
  issue        TEXT NOT NULL,
  suggestion   TEXT,
  auto_fix     BOOLEAN DEFAULT false,
  fixed        BOOLEAN DEFAULT false,
  fixed_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### heatmap_events (written by OpenReplay SDK, read by super admin)
-- OpenReplay stores this in its own DB; super admin reads via OpenReplay API.
-- We do NOT replicate this table — we just integrate with OpenReplay's API.

---

# PART 4 — SHARED EXPRESS API

## Location
`/projects/apps/api/`

## Framework & Libraries
```
express 4.x
prisma (ORM connected to PostgreSQL)
redis (ioredis client)
bullmq (job queues)
jsonwebtoken (JWT auth)
bcryptjs (password hashing)
crypto-js (AES encryption for API keys)
multer + sharp (file upload + WebP conversion)
minio (MinIO SDK for media storage)
node-cron (scheduled jobs)
axios (HTTP client for AI APIs and scraping)
zod (request validation)
winston (structured logging)
```

## Folder Structure
```
apps/api/
├── src/
│   ├── index.ts                  entry point
│   ├── middleware/
│   │   ├── auth.ts               JWT verification + role check
│   │   ├── siteScope.ts          inject site_id from JWT or subdomain
│   │   ├── cache.ts              Redis cache middleware
│   │   ├── rateLimit.ts          per-IP rate limiting
│   │   └── errorHandler.ts       global error handler
│   ├── routes/
│   │   ├── auth.ts               POST /auth/login, /auth/refresh, /auth/logout
│   │   ├── sites.ts              CRUD for sites (super admin only)
│   │   ├── products.ts           CRUD products
│   │   ├── categories.ts         CRUD categories
│   │   ├── orders.ts             orders management
│   │   ├── customers.ts          customers management
│   │   ├── reviews.ts            reviews management
│   │   ├── blog.ts               blog posts
│   │   ├── media.ts              upload, list, delete media
│   │   ├── import/
│   │   │   └── meesho.ts         Meesho data import pipeline
│   │   ├── ai/
│   │   │   ├── config.ts         AI model configuration
│   │   │   ├── jobs.ts           AI job queue management
│   │   │   ├── image.ts          image generation
│   │   │   ├── video.ts          video generation
│   │   │   └── copywriting.ts    description/meta rewriting
│   │   ├── seo/
│   │   │   ├── audit.ts          SEO audit runner
│   │   │   ├── agent.ts          AI SEO agent jobs
│   │   │   ├── schema.ts         JSON-LD schema generation
│   │   │   └── gsc.ts            Google Search Console integration
│   │   ├── analytics.ts          GA4 + GSC aggregated data
│   │   ├── ads.ts                Google Ads + Meta Ads data
│   │   ├── landingPages.ts       landing page CRUD
│   │   ├── abTests.ts            A/B test management
│   │   ├── redirects.ts          redirect rules
│   │   ├── heatmaps.ts           OpenReplay API proxy
│   │   ├── notifications.ts      email + push notifications
│   │   └── feed/
│   │       └── googleMerchant.ts per-site GMC XML/JSON feed
│   ├── services/
│   │   ├── ai/
│   │   │   ├── router.ts         AI model router — picks model for task
│   │   │   ├── openrouter.ts     OpenRouter API client
│   │   │   ├── deepseek.ts       DeepSeek API client
│   │   │   ├── sarvam.ts         Sarvam API client
│   │   │   ├── claude.ts         Anthropic API client
│   │   │   ├── openai.ts         OpenAI API client
│   │   │   └── google.ts         Google AI API client (Gemini/Imagen/Veo)
│   │   ├── meeshoScraper.ts      Meesho data extraction service
│   │   ├── imageProcessor.ts     Sharp-based image processing + MinIO upload
│   │   ├── seoAudit.ts           automated SEO audit logic
│   │   ├── schemaBuilder.ts      generates all JSON-LD schemas
│   │   ├── sitemapBuilder.ts     generates sitemap.xml for each site
│   │   ├── emailService.ts       transactional email via SMTP
│   │   └── searchIndex.ts        MeiliSearch product indexing
│   ├── queues/
│   │   ├── aiQueue.ts            BullMQ queue for AI processing jobs
│   │   ├── imageQueue.ts         BullMQ queue for image generation
│   │   ├── videoQueue.ts         BullMQ queue for video generation
│   │   ├── seoQueue.ts           BullMQ queue for SEO agent tasks
│   │   └── emailQueue.ts         BullMQ queue for email sending
│   └── workers/
│       ├── aiWorker.ts           processes aiQueue jobs
│       ├── imageWorker.ts        processes imageQueue jobs
│       ├── videoWorker.ts        processes videoQueue jobs
│       ├── seoWorker.ts          processes seoQueue jobs
│       └── emailWorker.ts        processes emailQueue jobs
```

## Authentication System

### JWT Structure
```json
{
  "sub": "user_uuid",
  "role": "super_admin|site_admin|editor|viewer",
  "sites": ["site_uuid_1", "site_uuid_2"],  // empty array = all sites (super_admin)
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Auth Endpoints
```
POST /auth/login
  body: { email, password, totp_code? }
  returns: { access_token (15min), refresh_token (30d) }

POST /auth/refresh
  body: { refresh_token }
  returns: { access_token }

POST /auth/logout
  invalidates refresh token in Redis

GET /auth/me
  returns current user profile

POST /auth/totp/setup
  generates TOTP QR code for 2FA setup

POST /auth/totp/verify
  verifies TOTP code and enables 2FA
```

### Role Permissions Matrix
```
Endpoint category         super_admin  site_admin  editor  viewer
─────────────────────────────────────────────────────────────────
Sites CRUD                    ✓            ✗          ✗       ✗
Users CRUD                    ✓            ✗          ✗       ✗
AI config                     ✓            ✓          ✗       ✗
Products CRUD                 ✓            ✓          ✓       ✗
Orders read                   ✓            ✓          ✓       ✓
Orders update                 ✓            ✓          ✗       ✗
Blog CRUD                     ✓            ✓          ✓       ✗
Analytics read                ✓            ✓          ✓       ✓
Redirects CRUD                ✓            ✓          ✗       ✗
Landing pages CRUD            ✓            ✓          ✓       ✗
A/B tests                     ✓            ✓          ✗       ✗
Infrastructure                ✓            ✗          ✗       ✗
```

## All API Endpoints

### Sites (super admin only)
```
GET    /api/sites                list all sites
POST   /api/sites                create new site
GET    /api/sites/:id            get site details + config
PUT    /api/sites/:id            update site config
DELETE /api/sites/:id            soft-delete site
PUT    /api/sites/:id/status     set active/maintenance/disabled
POST   /api/sites/:id/cache/purge purge Redis cache for site
```

### Products
```
GET    /api/:siteId/products           list with filters, pagination, search
POST   /api/:siteId/products           create product
GET    /api/:siteId/products/:slug     get by slug (public + admin)
PUT    /api/:siteId/products/:id       update product
DELETE /api/:siteId/products/:id       soft-delete
POST   /api/:siteId/products/bulk      bulk update (price, status, category)
GET    /api/:siteId/products/:id/images list images
POST   /api/:siteId/products/:id/images upload image (converts to WebP, stores in MinIO)
DELETE /api/:siteId/products/:id/images/:imageId
POST   /api/:siteId/products/:id/videos upload video
GET    /api/:siteId/products/:id/variants
POST   /api/:siteId/products/:id/variants
```

### Orders
```
GET    /api/:siteId/orders             list with filters (status, date, customer)
GET    /api/:siteId/orders/:id         order detail with items
PUT    /api/:siteId/orders/:id/status  update order status
POST   /api/:siteId/orders/:id/refund  initiate refund via payment gateway
GET    /api/:siteId/orders/export      CSV export
POST   /api/:siteId/orders/webhook/razorpay   Razorpay payment webhook
POST   /api/:siteId/orders/webhook/stripe     Stripe payment webhook
```

### Reviews
```
GET    /api/:siteId/reviews            list with filters (product, status, rating)
PUT    /api/:siteId/reviews/:id/approve
PUT    /api/:siteId/reviews/:id/reject
DELETE /api/:siteId/reviews/:id
GET    /api/:siteId/reviews/flagged    reviews containing "meesho" keyword
```

### Meesho Import
```
POST   /api/:siteId/import/meesho/url       queue import from Meesho product/category URL
POST   /api/:siteId/import/meesho/bulk      queue bulk import from list of URLs
GET    /api/:siteId/import/meesho/logs      import history
GET    /api/:siteId/import/meesho/logs/:id  specific import log with details
```

### AI Jobs
```
GET    /api/:siteId/ai/jobs                 list all AI jobs with status
GET    /api/:siteId/ai/jobs/:id             job detail with input/output
POST   /api/:siteId/ai/jobs/:id/approve     approve AI output → apply to entity
POST   /api/:siteId/ai/jobs/:id/reject      reject + optionally re-queue
POST   /api/:siteId/ai/rewrite/product/:id  queue description rewrite for product
POST   /api/:siteId/ai/rewrite/batch        queue bulk rewrite for all products with pending status
POST   /api/:siteId/ai/image/generate       queue image generation for product
POST   /api/:siteId/ai/video/generate       queue video generation for product
```

### AI Model Config
```
GET    /api/ai/config                       list all configured models
POST   /api/ai/config                       add model config
PUT    /api/ai/config/:id                   update model config
DELETE /api/ai/config/:id                   remove model config
POST   /api/ai/config/test                  test API key + model connection
GET    /api/ai/providers                    list all supported providers + their models
```

### SEO
```
GET    /api/:siteId/seo/audit              run full SEO audit (queued)
GET    /api/:siteId/seo/audit/results      list audit results
PUT    /api/:siteId/seo/audit/:id/fix      apply suggested fix
GET    /api/:siteId/seo/meta/:pageType/:id get current meta tags for page
PUT    /api/:siteId/seo/meta/:pageType/:id update meta tags
GET    /api/:siteId/seo/schema/:pageType/:id get JSON-LD schema for page
PUT    /api/:siteId/seo/schema/:pageType/:id override JSON-LD schema
POST   /api/:siteId/seo/sitemap/regenerate force regenerate sitemap.xml
GET    /api/:siteId/seo/gsc/performance    GSC impressions/clicks/position
GET    /api/:siteId/seo/gsc/keywords       top keywords from GSC
GET    /api/:siteId/seo/opportunities      AI-identified ranking opportunities
```

### Feed
```
GET    /api/:siteId/feed/google-merchant   returns XML feed for Google Merchant Center
```

### Landing Pages + A/B Tests
```
GET    /api/:siteId/landing-pages
POST   /api/:siteId/landing-pages
GET    /api/:siteId/landing-pages/:id
PUT    /api/:siteId/landing-pages/:id
DELETE /api/:siteId/landing-pages/:id
POST   /api/:siteId/landing-pages/:id/duplicate
POST   /api/:siteId/ab-tests               create test with variants
PUT    /api/:siteId/ab-tests/:id/start
PUT    /api/:siteId/ab-tests/:id/pause
PUT    /api/:siteId/ab-tests/:id/complete  declare winner
GET    /api/:siteId/ab-tests/:id/results   live conversion data per variant
POST   /api/:siteId/ab-tests/:id/track     track conversion event (called by frontend)
```

### Analytics
```
GET    /api/analytics/overview             cross-site: revenue, orders, traffic
GET    /api/:siteId/analytics/overview     per-site overview
GET    /api/:siteId/analytics/vitals       Core Web Vitals (via GSC CrUX API)
GET    /api/:siteId/analytics/funnel       conversion funnel data
```

### Ads
```
GET    /api/ads/overview                   cross-site: spend, ROAS, clicks all platforms
GET    /api/:siteId/ads/google             Google Ads campaign performance
GET    /api/:siteId/ads/meta               Meta Ads campaign performance
GET    /api/:siteId/ads/recommendations    AI-generated ad optimization suggestions
POST   /api/:siteId/ads/utms               save UTM parameter set
GET    /api/:siteId/ads/utms               list saved UTM sets
```

### Heatmaps (OpenReplay proxy)
```
GET    /api/:siteId/heatmaps/pages         list pages with heatmap data
GET    /api/:siteId/heatmaps/:pageUrl      heatmap data for specific page
GET    /api/:siteId/heatmaps/sessions      session recordings list
GET    /api/:siteId/heatmaps/funnels       conversion funnel data
GET    /api/:siteId/heatmaps/alerts        rage click + error alerts
```

### Infrastructure (super admin only)
```
GET    /api/infra/sites/status             PM2 status of all sites
POST   /api/infra/sites/:id/restart        restart PM2 process
POST   /api/infra/sites/:id/rebuild        trigger Next.js rebuild
GET    /api/infra/server/metrics           CPU, RAM, disk usage
GET    /api/infra/backups                  list recent backups
POST   /api/infra/backups/trigger          manual backup now
GET    /api/infra/logs/:appName            last 500 lines of PM2 log
```

---

# PART 5 — MEESHO DATA IMPORT PIPELINE

## How It Works

The admin pastes a Meesho product URL or category URL into the super admin import screen.
The system queues an import job. A worker processes it step by step:

### Step 1 — Scrape product data
- Use Playwright (headless browser) to render the Meesho page and extract:
  - Product name, description, price, MRP, category, brand
  - All product images (download original URLs)
  - All variants (size, color, etc.)
  - All reviews (text, rating, author name, date, images)

### Step 2 — Filter reviews
- For every review, check if the body text contains the word "meesho" (case-insensitive)
- If it does: set `contains_meesho = true`, do NOT import (skip entirely)
- If it does not: include in import queue

### Step 3 — Download and re-host all media
- Download every product image from Meesho CDN
- Download every review image from Meesho CDN
- Process each image through Sharp: resize to max 2000px, convert to WebP, strip metadata
- Upload to MinIO under path: `/sites/{siteId}/products/{productId}/images/`
- Review images: `/sites/{siteId}/reviews/{reviewId}/images/`
- Never serve Meesho CDN URLs directly — always re-host on MinIO

### Step 4 — Store raw data in DB
- Insert product with `source = 'meesho'`, `ai_description_status = 'pending'`
- Insert all images with `source = 'meesho'`
- Insert filtered reviews with `is_approved = false` (require manual approval)
- Insert review images

### Step 5 — Queue AI processing jobs
- For each imported product, queue:
  - `rewrite_description` job (AI copywriting)
  - `rewrite_title` job (AI title enhancement)
  - `generate_seo_meta` job (AI meta title + description)
  - `generate_image` job (if image generation enabled for this site)
- All jobs go into the BullMQ `aiQueue`

### Step 6 — Update import log
- Record products_imported, reviews_imported, reviews_skipped counts
- Set status to 'done'
- Send notification to admin

## Import UI in Super Admin

Screen: **Import > Meesho Import**

Fields:
- URL input: paste one Meesho URL (product or category page)
- Bulk import: textarea for multiple URLs, one per line
- Site selector: which site to import into
- Options:
  - Auto-queue AI description rewrite: toggle (default on)
  - Auto-queue AI image generation: toggle (default off)
  - Auto-approve reviews (skip manual review): toggle (default off)
  - Import variants: toggle (default on)
  - Minimum review rating to import: dropdown (1★ to 4★, default: all)
- Import button → shows live progress bar with counts

---

# PART 6 — AI MODEL MANAGEMENT SYSTEM

## Overview

Every AI task in the system is routed through a central AI router service.
The router looks up the AI model configuration for the given task and site,
then calls the appropriate provider's API client. All configuration is managed
from the super admin panel under **AI Studio > Model Configuration**.

## Supported Providers and Their Models

### OpenRouter
- Access to 200+ models via a single API key
- In the super admin, when OpenRouter is selected as provider,
  show a searchable model dropdown populated from the OpenRouter /models endpoint
- Allow multiple OpenRouter configurations for DIFFERENT tasks
- Example: use `anthropic/claude-3.5-sonnet` for copywriting,
  `meta-llama/llama-3.1-70b-instruct` for SEO meta tags
- API base: `https://openrouter.ai/api/v1`
- Header required: `HTTP-Referer: [your domain]`

### DeepSeek
- Models: `deepseek-chat`, `deepseek-coder`, `deepseek-reasoner`
- Best for: SEO content, structured outputs, code generation
- API base: `https://api.deepseek.com`

### Sarvam AI
- Models: `sarvam-2b`, `sarvam-m` (multilingual — Hindi/Indian languages)
- Best for: Hindi product descriptions, regional language content
- API base: `https://api.sarvam.ai`
- Special: also has translation capabilities (English ↔ Hindi ↔ regional)

### Anthropic (Claude)
- Models: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Best for: long-form copywriting, SEO content, nuanced product descriptions
- API base: `https://api.anthropic.com`

### OpenAI (ChatGPT)
- Models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o1-mini`
- Image generation: `dall-e-3`, `dall-e-2`
- Best for: general copywriting, image generation
- API base: `https://api.openai.com`

### Google AI
- Text models: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
- Image generation: `imagen-3` (via Vertex AI)
- Video generation: `veo-2` (via Vertex AI)
- API base: `https://generativelanguage.googleapis.com` (text)
           `https://us-central1-aiplatform.googleapis.com` (Vertex AI for images/video)
- Note: Imagen and Veo require Google Cloud project + Vertex AI API enabled

## Task-to-Model Assignment

The following tasks can each have an assigned model (independently configurable):

```
Task ID                   Description
──────────────────────────────────────────────────────────────────
description_rewrite       Rewrite product descriptions from Meesho
title_rewrite             Enhance product titles
seo_meta                  Generate meta title + description per page
seo_audit                 Analyze pages for SEO issues
content_brief             Generate blog content briefs
schema_generation         Generate/validate JSON-LD schema
review_filter             Secondary filter pass on reviews
translation               Translate content to Hindi/regional
ad_copy                   Generate Google/Meta ad copy
landing_page_copy         Generate landing page copy for builder
image_generation          Generate product images from prompts/source
video_generation          Generate product videos
image_background_removal  Remove background from product images
```

## AI Model Configuration UI (Super Admin: AI Studio > Model Config)

Layout: Table with one row per task

Columns:
- Task name (human-readable label)
- Provider (dropdown: OpenRouter / DeepSeek / Sarvam / Claude / OpenAI / Google)
- Model (dynamic dropdown — populated based on selected provider)
- API Key (masked input — shows last 4 chars only after saving)
- Status (green = connected + tested / red = error)
- Parameters button → opens modal with: temperature, max_tokens, custom system prompt
- Test button → runs a test completion and shows response
- Save button

Special behavior for OpenRouter:
- After selecting OpenRouter as provider, show a second "Model search" input
- Fetch live model list from OpenRouter `/api/v1/models` and populate a searchable dropdown
- Show model context length, pricing per 1M tokens next to each model option
- Allow user to pin favorite models to the top of the list

API Key Management:
- API keys entered in the UI are AES-256 encrypted before storing in `ai_model_config.api_key_enc`
- Encryption key is stored as environment variable `API_KEY_ENCRYPTION_SECRET`
- Keys are never returned in full via API — only last 4 characters for verification
- Each provider's API key can be set globally (applies to all sites) or overridden per site

## AI Image Generation Workflow

### Input sources for image generation:
1. **From Meesho source image** — use the downloaded product image as a reference/base
2. **From text prompt only** — user writes a custom prompt
3. **From product description** — AI generates a prompt from the product description automatically

### Image generation providers:
- **OpenAI DALL-E 3** — best for lifestyle product shots, creative compositions
- **Google Imagen 3** — photorealistic product images, white background shots
- **Stable Diffusion via OpenRouter** — cost-effective bulk generation

### Image generation settings (per product or bulk):
- Background style: white product shot / lifestyle scene / gradient / custom color
- Number of images to generate: 1–5
- Aspect ratio: 1:1 / 4:3 / 16:9
- Style prompt additions: e.g. "professional product photography, studio lighting"
- Negative prompt: e.g. "watermark, text, blurry, low quality"

### Image generation workflow:
1. Admin selects products → clicks "Generate AI Images"
2. System queues image generation job in BullMQ imageQueue
3. Worker calls selected image generation API
4. Generated images downloaded → processed through Sharp (resize, compress, WebP)
5. Uploaded to MinIO
6. Job status set to `needs_approval`
7. Admin reviews in AI Jobs > Image Approvals — sees side-by-side: original vs generated
8. Admin clicks Approve (replaces product image) or Reject (discard)
9. Approved images set as product images with `source = 'ai_generated'`

## AI Video Generation Workflow

### Input sources:
1. **From product images** — use existing product images as frames/references
2. **From text description** — describe the scene and product
3. **Uploaded video** — admin uploads their own video directly

### Video generation provider:
- **Google Veo 2** — primary provider for high-quality product videos
  - Input: text prompt + optional reference image
  - Output: 5–30 second video clips
  - Resolution: up to 1080p
  - Access via: Google Vertex AI API

### Video management UI (Super Admin: AI Studio > Video):
- Per-product video section in the product editor
- "Generate AI Video" button → opens modal:
  - Prompt field (pre-filled from product description)
  - Reference image picker (pick from existing product images)
  - Duration: 5s / 10s / 15s / 30s
  - Style: product showcase / lifestyle / unboxing / close-up detail
  - Generate button
- "Upload Video" button → upload MP4/MOV directly
- Video library shows all videos for the product
- Set primary video (shown on product page)
- Delete video

### Video storage:
- All videos stored in MinIO under: `/sites/{siteId}/products/{productId}/videos/`
- Thumbnails auto-extracted at 1 second mark via FFmpeg
- Original + compressed (720p) versions stored

---

# PART 7 — AI SEO AGENT

## What It Does

Runs as a scheduled background service (cron-based) that continuously monitors
all sites, finds ranking opportunities, detects issues, and queues fixes.
It never auto-publishes content — all outputs go to an approval queue.
High-confidence technical fixes (broken schema, missing canonical) can be set
to auto-apply without approval (configurable per site).

## Scheduled Jobs

```
Every night at 1:00 AM:
  - Pull GSC data for all sites (impressions, clicks, position per URL)
  - Identify pages ranking positions 4–20 (easy win zone)
  - For each position 4–20 page: generate improved title tag + meta description
  - Queue as 'seo_meta' AI jobs with status 'needs_approval'

Every Sunday at 2:00 AM:
  - Crawl all public pages of all sites
  - Check: missing meta tags, missing H1, duplicate titles, thin content (<300 words)
  - Check: broken internal links (404 responses)
  - Check: images missing alt text
  - Check: missing canonical tags
  - Check: schema validation (parse JSON-LD, validate structure)
  - Log all issues to seo_audit_results table
  - Auto-fix: missing canonical (if URL is unambiguous)
  - Auto-fix: invalid schema (if fix is deterministic)
  - Queue: title/description rewrites for flagged pages

Every Monday at 6:00 AM:
  - Crawl top 3 ranking competitor pages per target keyword
  - Compare: word count, heading structure, schema types, FAQ presence
  - Generate gap analysis report
  - Queue content brief jobs for missing keyword coverage

First day of each month:
  - Generate full SEO performance report per site
  - Metrics: rank changes, traffic changes, new pages indexed, fixes applied
  - Email report to site admin(s)
```

## AI SEO Agent UI (Super Admin: AI SEO Agent)

### Approval Inbox tab
- List of pending AI-generated changes
- Each item shows:
  - Page URL
  - Change type (title rewrite / meta rewrite / schema fix / content brief)
  - Before value (current live)
  - After value (AI suggestion)
  - Confidence score (%)
  - Approve button → applies change and deploys
  - Edit & Approve button → opens inline editor before applying
  - Reject button → dismisses
  - Bulk approve checkbox + "Approve selected" button

### Scheduled Jobs tab
- Toggle on/off each scheduled job type
- Configure time for each job
- "Run now" button for any job
- Last run timestamp + result summary

### Competitor Monitor tab
- Add competitor domains per site
- Per keyword: shows your URL vs competitor URL with comparison table
- Metrics: word count, schema types, FAQ count, images count
- "Create content brief" button for any gap

### Keyword Opportunities tab
- GSC data visualization: scatter plot of position vs impressions
- Highlight zone: position 4–20 with >100 monthly impressions = priority targets
- For each opportunity: current page, current position, suggested improvement
- "Queue title rewrite" button per row

### Weekly Report tab
- Archive of all weekly reports
- Charts: rank movement over time per keyword
- New issues found vs issues fixed over time

---

# PART 8 — HEATMAPS & SESSION INTELLIGENCE

## OpenReplay Setup

Deploy OpenReplay Community Edition on the VPS at port 3100.
Install OpenReplay tracker script on every site via a shared script tag in
the Next.js root layout. Each site gets its own OpenReplay project key
(stored in `sites.config.openreplay_project_key`).

## Super Admin Heatmaps Module

### Pages Heatmap tab
- Dropdown: select site → select page URL
- Three heatmap views:
  - Click heatmap: red/yellow/green heat overlay on page screenshot
  - Scroll depth: shows % of users who reached each section
  - Move heatmap: cursor movement trails
- Device filter: all / desktop / mobile / tablet
- Date range picker
- "AI Insights" button → sends heatmap data to AI, returns plain-English summary
  Example output: "73% of mobile users scroll past the hero but stop before
  the Add to Cart button. Consider moving the CTA above the product description."

### Session Recordings tab
- List of recorded sessions with filters:
  - Converted (completed purchase) vs bounced
  - Device type, browser
  - Traffic source (organic, paid, direct)
  - Duration (> 30s, > 2min, etc.)
  - Rage clicks (filter sessions with rage click events)
- Click any session → play recording directly in super admin
- Tag sessions: "interesting", "UX issue", "bug found"

### Conversion Funnels tab
- Visual funnel builder: define steps (landing page → product → cart → checkout → thank you)
- Shows drop-off % at each step
- Click any step → see heatmap of that page
- Per funnel: filter by traffic source, device, date range

### Rage Click Alerts tab
- Auto-detected elements with ≥ 3 rapid clicks by multiple users
- Shows: element (CSS selector + screenshot highlight), # sessions affected
- "Flag for fix" button → creates a task in AI improvement queue

### AI Conversion Insights tab
- Weekly AI-generated report combining:
  - Heatmap data
  - Funnel drop-off points
  - Session recording patterns
  - A/B test results
- Plain-English recommendations: "Users on mobile are clicking the size guide
  link but it opens in same tab, losing their product context. Add target=_blank."
- Each insight has: "Create landing page variant" button, "Create task" button

---

# PART 9 — ADS COMMAND CENTRE

## Data Sources

### Google Ads
- Connect via Google Ads API (OAuth 2.0)
- Fetch: campaigns, ad groups, ads, keywords, spend, conversions, ROAS
- Refresh every 6 hours via scheduled job
- Store aggregated stats in Redis (not in PostgreSQL — too volatile)

### Meta Ads (Facebook/Instagram)
- Connect via Meta Marketing API (access token per ad account)
- Fetch: campaigns, ad sets, ads, spend, impressions, clicks, conversions
- Refresh every 6 hours

## Super Admin Ads Module

### Performance Dashboard tab
- Date range selector (today / 7d / 30d / custom)
- Site selector (all sites or specific site)
- Cards row: Total spend / Total revenue from ads / Blended ROAS / CPA
- Table: per site breakdown with columns:
  - Site name, Google spend, Meta spend, total spend
  - Ad-attributed revenue, ROAS, CPA
  - Top performing campaign
  - Budget utilization (% of monthly budget spent)
- Chart: spend vs revenue over time (line chart, dual axis)

### AI Recommendations tab
- Automatically generated insights, refreshed daily:
  - "Site X: Keyword 'Y' ranks #3 organically. You are paying ₹8,400/month
    bidding on it in Google Ads. Recommend pausing — estimated monthly saving ₹8,400."
  - "Site X Meta campaign 'Z': ROAS dropped from 4.2x to 1.8x in last 7 days.
    Check landing page — bounce rate increased from 42% to 71%."
  - "Site Y: Women 25–34 converting at 6.1x ROAS vs 1.2x for Men 18–24.
    Recommend reallocating 40% budget from Men to Women audience."
- Each recommendation has: Expected impact / Confidence / "Open in Google Ads" button
  or "Open in Meta Ads Manager" button (deep link to exact campaign)

### Budget Tracker tab
- Monthly budget set per site per platform
- Progress bars showing burn rate
- Forecast: "At current spend rate, Google Ads budget exhausted in 12 days"
- Alert settings: notify when budget is 50%, 75%, 90% consumed

### UTM Builder tab
- Form fields: campaign name, source, medium, content, term
- Auto-generates UTM URL
- QR code for the URL (for offline/print use)
- Save to library with campaign name
- History of all UTM sets, filterable by site and date

### Attribution Dashboard tab
- Shows complete customer journey: first touch → last touch → conversion
- Cross-site attribution: customer touched Site A ad, bought on Site B
- UTM parameter tracking in order `meta` JSONB field
- Sources breakdown: organic search / paid search / paid social / direct / referral

---

# PART 10 — LANDING PAGE BUILDER & A/B TESTER

## Landing Page Builder

### Block Types Available
Every landing page is composed of blocks. Available block types:

```
Hero blocks:
  - hero_fullscreen: full-width image/video background, headline, CTA button
  - hero_split: image left + text right (or reverse)
  - hero_minimal: centered headline + subheadline + CTA, no image

Product blocks:
  - product_featured: large image + description + add-to-cart
  - product_grid: 2/3/4 column product grid with filters
  - product_carousel: horizontal scroll of products

Social proof blocks:
  - reviews_grid: 3-column review cards
  - reviews_carousel: scrolling review cards
  - trust_badges: SSL / free shipping / returns icons
  - stats_bar: "10,000+ happy customers | 4.8★ rating | Free returns"

Content blocks:
  - text_block: rich text editor
  - features_list: icon + title + description, 3–6 items
  - faq_accordion: FAQ with expand/collapse, auto-adds FAQPage schema
  - comparison_table: two products or plans side by side
  - how_it_works: numbered steps with images
  - video_embed: product video player

CTA blocks:
  - cta_banner: full-width colored banner with button
  - countdown_timer: live countdown + CTA (for sales/offers)
  - form_block: email capture / WhatsApp opt-in / contact form

Navigation blocks:
  - announcement_bar: top bar with promo message
  - breadcrumb: auto-generated breadcrumb
  - sticky_cta: floating button that follows scroll
```

### Builder UI (Super Admin: Landing Pages > Builder)

Layout: three-column editor
- Left column: block library (drag blocks from here)
- Center column: live page preview (drag-and-drop to reorder blocks)
- Right column: block settings panel (edit the selected block's content/style)

Block settings panel includes:
- Content fields (text, images, button labels, colors)
- Spacing controls (padding top/bottom, margin)
- Visibility: show on desktop / mobile / both
- Animation: fade in / slide up / none
- Background: color picker / image upload / video background

SEO settings panel (below block editor):
- Meta title input
- Meta description input
- Canonical URL
- noindex toggle (for test variants you don't want indexed)
- JSON-LD schema auto-generated from page content (editable)

Mobile preview toggle: switch between desktop and mobile view in real-time.

AI Assist button: "Generate page copy with AI"
- Input: product name + target keyword + audience description + desired tone
- Output: AI fills in all text blocks (headline, subheadline, features, CTA text, FAQ)
- Uses the model configured for `landing_page_copy` task
- Admin reviews and edits before saving

### A/B Test Manager (Super Admin: Landing Pages > A/B Tests)

#### Creating a test
1. Click "New A/B Test"
2. Test name (internal label)
3. Select site
4. Success metric: purchase / add_to_cart / form_submit / scroll_50 / scroll_80
5. Add variants: minimum 2, maximum 5
   - For each variant: select existing landing page OR create new one
   - Set traffic percentage per variant (must sum to 100%)
6. Connect ad sources (optional):
   - Google Ads campaign IDs that will drive traffic to this test
   - Meta Ads campaign IDs
   - UTM parameters for tracking
7. Set minimum sample size before declaring winner (default: 1,000 visitors/variant)
8. Click "Start Test"

#### Live test dashboard
Per active test:
- Status indicator (running / paused / completed)
- Visitors per variant (live counter)
- Conversion rate per variant
- Revenue per visitor per variant
- Statistical significance meter (% confidence) — color coded:
  - Gray: < 80% significance (too early)
  - Yellow: 80–94% (trending)
  - Green: ≥ 95% (ready to declare winner)
- Heatmap button per variant (opens OpenReplay heatmap for that page)
- Pause / Resume / End test buttons
- "Declare winner" button (enabled only at ≥ 95% significance)

#### When a winner is declared:
- Winning variant's landing page becomes the permanent page at the URL
- Losing variants archived (not deleted)
- A/B test report saved:
  - Winning variant details
  - Final conversion rates all variants
  - Total visitors per variant
  - Revenue difference
  - What was different about the winner (AI-generated summary)
- Notification sent to admin

---

# PART 11 — SUPER ADMIN PANEL (Full Specification)

## Tech Stack
```
Next.js 14 App Router
TypeScript
Tailwind CSS
shadcn/ui component library
Recharts (charts and data visualization)
React DnD or dnd-kit (drag and drop for landing page builder)
React Hook Form + Zod (all forms)
SWR (data fetching + real-time updates)
date-fns (date formatting)
```

## Design System

### Color Palette
- Background: #0F0F0F (near black) — dark theme by default
- Surface: #1A1A1A (cards, panels)
- Surface elevated: #242424 (modals, dropdowns)
- Border: #2E2E2E
- Primary: #6366F1 (indigo — action buttons, active states)
- Primary hover: #4F46E5
- Success: #22C55E
- Warning: #F59E0B
- Danger: #EF4444
- Text primary: #F1F1F1
- Text secondary: #9CA3AF
- Text muted: #6B7280

### Typography
- Font: Inter (loaded via next/font — never from Google Fonts CDN)
- Headings: font-weight 600
- Body: font-weight 400, 14px, line-height 1.6
- Code: JetBrains Mono via next/font

### Layout
- Left sidebar navigation: 240px wide, fixed, collapsible to 64px (icon-only mode)
- Top header: 56px, site selector dropdown, notifications bell, user avatar
- Main content: fills remaining width with 24px padding all sides
- Max content width: 1400px (centered)

### Sidebar Navigation Structure
```
Dashboard (overview all sites)
│
├── Sites
│   ├── All Sites
│   └── Add New Site
│
├── AI Studio                    ← NEW
│   ├── Model Configuration
│   ├── Job Queue
│   ├── Image Generation
│   ├── Video Generation
│   └── Copywriting Jobs
│
├── Import
│   └── Meesho Import
│
├── Products
│   ├── All Products
│   ├── Categories
│   ├── Inventory
│   └── Media Library
│
├── Orders
│   ├── All Orders
│   ├── Refunds
│   └── Shipping Config
│
├── Customers
│
├── Reviews
│   ├── Pending Approval
│   ├── Approved
│   └── Flagged (contains "meesho")
│
├── Content
│   ├── Blog Posts
│   ├── Pages
│   └── Content Calendar
│
├── SEO
│   ├── AI SEO Agent             ← NEW
│   ├── Meta Manager
│   ├── Schema Editor
│   ├── Redirects
│   ├── Sitemap
│   ├── robots.txt
│   └── Audit Results
│
├── Heatmaps & Sessions          ← NEW
│   ├── Page Heatmaps
│   ├── Session Recordings
│   ├── Conversion Funnels
│   └── AI Insights
│
├── Ads                          ← NEW
│   ├── Performance Dashboard
│   ├── AI Recommendations
│   ├── Budget Tracker
│   ├── UTM Builder
│   └── Attribution
│
├── Landing Pages                ← NEW
│   ├── All Landing Pages
│   ├── Builder
│   └── A/B Tests
│
├── Analytics
│   ├── Overview
│   ├── Core Web Vitals
│   └── Revenue Reports
│
├── Infrastructure               (super_admin only)
│   ├── Server Status
│   ├── Cache Manager
│   ├── Deploy Manager
│   ├── Backup & Restore
│   └── Logs
│
├── Users & Permissions          (super_admin only)
│   ├── Admin Users
│   ├── Roles
│   └── Activity Log
│
└── Settings
    ├── Email / SMTP
    ├── Payment Gateways
    ├── Shipping
    └── Webhooks
```

## Site Selector (Top Header)

Always visible dropdown in the top header bar.
Options: "All Sites" + individual site names with status indicator dots.
Selecting a site scopes all data shown in every panel to that site.
Selecting "All Sites" shows cross-site aggregated data.
The selected site is stored in a global context and persisted in localStorage.

## Dashboard Screen (Main Overview)

When "All Sites" selected:
- Cards row: Total revenue today / Total orders today / Active sites / Pending AI jobs
- Revenue chart: all sites combined, last 30 days (line chart)
- Sites status table: each site with uptime status / last order / traffic / Lighthouse score
- Recent activity feed: last 20 actions across all sites (order placed, product imported, etc.)

When a specific site selected:
- Cards: Today's revenue / Today's orders / Active products / Pending approvals
- Revenue + traffic chart: last 30 days
- Top products by revenue
- Recent orders table
- SEO snapshot: top 5 keywords by position, any critical SEO issues

---

# PART 12 — PER-SITE ADMIN PANELS

## Overview
All sites share ONE admin Next.js app deployed at port 4001.
The site context is determined by:
1. The `site_id` in the admin user's JWT (for site_admin role)
2. A URL parameter `/admin/[siteId]/...` (for super_admin accessing a specific site's admin)

## What Per-Site Admin Can Do
- Same features as super admin but scoped to their site only
- Cannot see other sites' data
- Cannot manage users across sites
- Cannot access infrastructure module
- Cannot access AI model global configuration
- CAN configure AI models for their own site (override global defaults)

## Per-Site Admin Navigation
```
Dashboard
Products (their site only)
Categories
Orders
Customers
Reviews
Blog
SEO
  ├── AI SEO Agent (their site only)
  ├── Meta Manager
  ├── Schema Editor
  └── Redirects
Heatmaps
Landing Pages
Analytics
Settings (their site: SMTP, payment keys, branding, shipping)
```

---

# PART 13 — NEXT.JS PUBLIC SITES

## Philosophy
Every site is built as a completely unique Next.js 14 App Router application.
No template. Different design, different component structure, different aesthetic.
But every site follows the SAME technical rules below — non-negotiable.

## What Every Site Must Have (Mandatory)

### Packages
Every site imports these shared packages from the monorepo:
```
@packages/seo      — generateMetadata helper, all schema builders, sitemap utils
@packages/db       — Prisma client with all DB query functions
@packages/api-client — typed fetch wrapper for the shared Express API
```

### Environment Variables (per site .env)
```
SITE_ID=                     UUID from sites table
SITE_DOMAIN=                 e.g. mysite.com
API_BASE=                    https://api.yourdomain.com
NEXT_PUBLIC_SITE_ID=         same as SITE_ID (for client components)
NEXT_PUBLIC_API_BASE=        same as API_BASE (for client components)
NEXT_PUBLIC_RAZORPAY_KEY=    public key for checkout
NEXT_PUBLIC_GA4_ID=          GA4 measurement ID
NEXT_PUBLIC_OPENREPLAY_KEY=  OpenReplay project key for this site
```

### App Router Page Structure
```
app/
├── layout.tsx            root layout: fonts, GA4 script, OpenReplay script, global SEO defaults
├── page.tsx              homepage
├── sitemap.ts            auto-generated sitemap
├── robots.ts             auto-generated robots.txt
├── [category]/
│   └── page.tsx          category listing page
├── products/
│   └── [slug]/
│       └── page.tsx      product detail page
├── blog/
│   ├── page.tsx          blog listing
│   └── [slug]/
│       └── page.tsx      blog post page
├── store/
│   └── [city]/
│       └── page.tsx      local store page
├── about/page.tsx
├── contact/page.tsx
├── search/page.tsx
├── cart/page.tsx         client component, no SEO indexing
├── checkout/page.tsx     client component, no SEO indexing
├── account/page.tsx      client component, no SEO indexing
└── lp/
    └── [slug]/
        └── page.tsx      landing pages from builder
```

### SEO Requirements (mandatory for every page)

**generateMetadata() on every page:**
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: `${primaryKeyword} – ${secondaryKeyword} | ${siteName}`,
    description: `${uniqueDescription}`,  // 150–160 chars, includes CTA verb
    robots: { index: true, follow: true },
    alternates: { canonical: `https://${domain}${path}` },
    openGraph: {
      title, description, url, type,
      images: [{ url: heroImage, width: 1200, height: 630, alt }]
    },
    twitter: { card: 'summary_large_image', title, description, images }
  }
}
```

**sitemap.ts**: lists all products, categories, blog posts, store pages.
Excludes: /cart, /checkout, /account, /thank-you, /lp/* (unless test is done)

**robots.ts**:
```
Allow: /
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /api
Sitemap: https://[domain]/sitemap.xml
```

**Every page has exactly one H1** containing the primary keyword naturally.
**Heading order**: H1 → H2 → H3. Never skip.
**Every image**: descriptive alt text, explicit width+height, WebP format, next/image
**Above-fold images**: `priority={true}` on next/image
**Below-fold images**: `loading="lazy"` on next/image
**Fonts**: next/font only. Never Google Fonts CDN link tags.
**Internal links**: descriptive anchor text always.
**Canonical**: set on every page, including filter/sort combinations (point to base URL).
**Filter/sort pages**: `<meta name="robots" content="noindex, follow">`

**JSON-LD Schema per page type**:

Homepage:
- Organization (name, url, logo, sameAs social, contactPoint, address, NAP)
- WebSite (name, url, potentialAction SearchAction)

Product page:
- Product (name, description, image array min 3, brand, sku, mpn)
- Offer (price, currency, availability, url, priceValidUntil)
- AggregateRating (only if real reviews exist)
- BreadcrumbList

Category page:
- ItemList (all products on page as ListItem)
- BreadcrumbList
- FAQPage (minimum 5 Q&A pairs)

Blog post:
- Article (headline, author Person, datePublished, dateModified, image, publisher)
- FAQPage (if FAQ section present)
- BreadcrumbList

Store/location page:
- LocalBusiness (name, address PostalAddress, telephone, openingHours, geo, hasMap, image)
- BreadcrumbList

**Core Web Vitals targets**:
- LCP < 2.5s
- CLS < 0.1
- INP < 200ms
- Lighthouse ≥ 90 all categories

**Performance rules**:
- No heavy JS on initial load
- Lazy load all below-fold components with dynamic import + Suspense
- Use next/image for all images
- Preconnect to CDN domains
- No render-blocking third-party scripts — all via next/script strategy="afterInteractive"

**Security headers** (set in next.config.js headers()):
- Strict-Transport-Security
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### Product Page Requirements
- Product name as H1
- At minimum 3 product images (carousel on desktop, swipe on mobile)
- Price with original/compare price strikethrough if on sale
- Stock status (In Stock / Out of Stock / Only X left)
- Variant selector (color/size) — uses URL path, not query params
- Add to Cart button above the fold on mobile
- Trust badges row (free shipping / returns / secure payment)
- Product description (AI-enhanced, minimum 300 words)
- Specifications table
- Reviews section with aggregate rating (star display + count)
- Individual reviews with author, date, rating, body, images
- FAQ section (minimum 5 Q&A, marked up with FAQPage schema)
- Related products (same category, 4–6 products)
- "Notify me when available" CTA if out of stock
- "Last updated" date displayed
- Review images displayed in review cards

### Category Page Requirements
- Category name as H1
- 150+ word intro paragraph above the product grid
- Product grid (2 col mobile / 3 col tablet / 4 col desktop)
- Filter sidebar: price range, color, size, brand
- Sort options: relevance / price low-high / price high-low / newest / top rated
- Pagination OR infinite scroll
- Breadcrumb navigation
- Related categories section (3–5 links, descriptive anchor text)
- SEO footer paragraph (additional keyword-rich content below the grid)
- FAQ section (5 Q&A)

### Checkout Flow
- Cart page: item list, quantities, totals, coupon input
- Checkout page: address form, delivery options, payment
- Payment: Razorpay for INR / Stripe for other currencies
- Thank you page: order confirmation (noindex)
- Order confirmation email sent on purchase

### Search
- Search bar in header (all pages)
- Search results page at /search?q=[query]
- Results served by MeiliSearch via API
- No-results state with category suggestions

---

# PART 14 — MONOREPO STRUCTURE

```
/projects/
├── package.json              root workspace config
├── turbo.json                Turborepo pipeline config
├── ecosystem.config.js       PM2 process definitions for all apps
│
├── packages/
│   ├── seo/
│   │   ├── src/
│   │   │   ├── generateMetadata.ts     base metadata generator
│   │   │   ├── schemas/
│   │   │   │   ├── organization.ts     Organization JSON-LD builder
│   │   │   │   ├── product.ts          Product JSON-LD builder
│   │   │   │   ├── category.ts         ItemList + BreadcrumbList builder
│   │   │   │   ├── article.ts          Article JSON-LD builder
│   │   │   │   ├── localBusiness.ts    LocalBusiness JSON-LD builder
│   │   │   │   ├── faq.ts              FAQPage JSON-LD builder
│   │   │   │   └── website.ts          WebSite + SearchAction builder
│   │   │   └── sitemapBuilder.ts       sitemap generation utility
│   │   └── package.json
│   │
│   ├── db/
│   │   ├── prisma/
│   │   │   └── schema.prisma           Prisma schema (all tables defined above)
│   │   ├── src/
│   │   │   ├── client.ts               Prisma client singleton
│   │   │   └── queries/                typed query functions per entity
│   │   └── package.json
│   │
│   └── api-client/
│       ├── src/
│       │   ├── products.ts             typed fetch functions for product API
│       │   ├── categories.ts
│       │   ├── orders.ts
│       │   ├── blog.ts
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── api/                            Shared Express API (see Part 4)
│   │
│   ├── super-admin/                    Super Admin Panel (see Part 11)
│   │
│   ├── site-[name-1]/                  First unique public site
│   │   ├── app/                        Next.js 14 App Router
│   │   ├── components/                 unique to this site
│   │   ├── public/
│   │   ├── .env
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── site-[name-2]/                  Second unique public site
│
└── scripts/
    ├── new-site.sh                     scaffold new site from terminal
    ├── deploy-site.sh                  rebuild + restart PM2 for a site
    ├── backup.sh                       PostgreSQL + MinIO backup to B2
    └── restore-backup.sh               restore from backup
```

---

# PART 15 — DEPLOYMENT WORKFLOW

## Adding A New Site (Terminal Workflow)

### Step 1 — Fill out site brief
Create a file `/projects/briefs/[site-name].md` using the site brief template:
```
Site name:
Domain:
Niche:
Target customer:
USP:
Design aesthetic:
Primary color:
Top 5 keywords:
City/region targeting:
Physical store locations:
Payment gateway: razorpay / stripe
GA4 ID:
Meta Pixel ID:
Google Ads Customer ID:
GMB URL:
NAP (address, phone):
Social links:
```

### Step 2 — Register in database
```sql
INSERT INTO sites (domain, name, slug, config, nginx_port, pm2_process_name)
VALUES ('newsite.com', 'New Site', 'new-site', '{}', 3005, 'site-new-site');
```

### Step 3 — Build with AI in terminal
Hand the site brief to an AI coding agent with the following instruction:
```
Build a complete Next.js 14 App Router e-commerce site based on this brief.
The site must:
- Import @packages/seo, @packages/db, @packages/api-client from the monorepo
- Set SITE_ID=[uuid] in .env
- Connect to shared API at API_BASE=https://api.[yourdomain].com
- Have a completely unique design matching the aesthetic described
- Pass Lighthouse ≥ 90 on all four categories
- Implement every SEO requirement defined in this document
- Never use a template or clone another site's design
```

### Step 4 — Configure Nginx
Add server block to `/etc/nginx/sites-available/[site-name].conf`:
```nginx
server {
    server_name newsite.com www.newsite.com;
    location / { proxy_pass http://localhost:3005; proxy_set_header Host $host; }
}
```
```bash
ln -s /etc/nginx/sites-available/newsite.com.conf /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

### Step 5 — SSL
```bash
certbot --nginx -d newsite.com -d www.newsite.com
```

### Step 6 — Build and start
```bash
cd /projects/apps/site-new-site
npm run build
pm2 start npm --name "site-new-site" -- start -- -p 3005
pm2 save
```

### Step 7 — Post-launch checklist
- Submit sitemap to Google Search Console
- Create GA4 property and add measurement ID to site config
- Add site to OpenReplay (get project key, add to site config)
- Connect to Google Ads and Meta Ads in Ads Command Centre
- Run first SEO audit from super admin
- Verify all schema validates in Google Rich Results Test

---

# PART 16 — MONITORING & CI/CD

## Uptime Kuma Setup

Monitor these URLs per site:
- Homepage
- A product page
- A category page
- API health endpoint: `/api/health`

Alert channels: email + optional Telegram bot
Check interval: every 1 minute
Alert after: 2 consecutive failures

## Lighthouse CI

```javascript
// .lighthouserc.js (in every public site's root)
module.exports = {
  ci: {
    collect: { url: ['/', '/products/[sample-slug]', '/[sample-category]'] },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      }
    }
  }
}
```

Run on every git push to main. Block deploy if any score < 90.

## Sentry Error Tracking

- Every Next.js site and the API have Sentry initialized
- Capture: unhandled errors, API 500 responses, failed AI jobs
- Alert: email for any new error type
- Weekly digest: top 10 errors by frequency

## Google Search Console Integration

- Each site connected to its own GSC property
- GSC API OAuth credentials stored in site config
- Super admin pulls GSC data every 6 hours via cron
- Alerts set in GSC for: manual actions, coverage errors, Core Web Vitals failures

---

# PART 17 — GOOGLE MERCHANT CENTER FEED

## Feed Endpoint
```
GET /api/:siteId/feed/google-merchant
Content-Type: application/xml
```

## Feed Fields (per product)
```xml
<item>
  <g:id>product-uuid</g:id>
  <g:title>AI-enhanced product title</g:title>
  <g:description>AI-enhanced description (max 5000 chars)</g:description>
  <g:link>https://[domain]/products/[slug]</g:link>
  <g:image_link>https://[minio]/primary-image.webp</g:image_link>
  <g:additional_image_link>...</g:additional_image_link>  <!-- repeat for all images -->
  <g:availability>in stock | out of stock | preorder</g:availability>
  <g:price>999.00 INR</g:price>
  <g:sale_price>799.00 INR</g:sale_price>  <!-- if compare_price set -->
  <g:brand>[brand]</g:brand>
  <g:mpn>[mpn]</g:mpn>
  <g:condition>new</g:condition>
  <g:google_product_category>[gmc_category from product]</g:google_product_category>
  <g:product_type>[site category path]</g:product_type>
  <g:shipping>...</g:shipping>
</item>
```

Feed is cached in Redis for 1 hour. Auto-regenerated when any product is updated.

---

# PART 18 — EMAIL SYSTEM

## Transactional Emails (per site)
All emails use SMTP credentials stored in site config (SMTP host, port, user, pass).
Templates are HTML emails with the site's branding (logo, colors from site config).

### Email Types
```
order_confirmation    Sent on successful payment. Contains: order number, items, total, address.
order_shipped         Sent when status changes to 'shipped'. Contains: tracking link.
order_delivered       Sent when status changes to 'delivered'. Contains: review request link.
password_reset        Sent on password reset request.
review_request        Sent 7 days after delivery requesting a review.
back_in_stock         Sent to subscribers when product restocks.
low_stock_alert       Sent to site admin when product hits low_stock_threshold.
weekly_seo_report     Sent every Monday to admin. AI SEO agent summary.
backup_status         Sent every morning. Backup success or failure.
```

### Email Queue
All emails go through BullMQ emailQueue to prevent blocking.
Retry: 3 attempts with exponential backoff.
Failed emails logged to DB with error message.

---

# PART 19 — SECURITY REQUIREMENTS

- All passwords hashed with bcrypt (cost factor 12)
- All API keys stored AES-256 encrypted in DB
- JWT access tokens expire in 15 minutes
- Refresh tokens expire in 30 days, stored in Redis, invalidated on logout
- 2FA (TOTP) available for all admin users, mandatory for super_admin
- Rate limiting: 100 req/min per IP on API, 5 failed login attempts = 15 min lockout
- All file uploads: validate MIME type + file extension, reject executables
- All user inputs: sanitized via zod validation before DB write
- SQL injection: impossible via Prisma ORM (parameterized queries)
- XSS: React + Next.js server-side rendering prevents most vectors
- CORS: API only accepts requests from known admin/site domains
- MinIO: private bucket — all media served through signed URLs or CDN
- Activity log: every admin action logged with user_id, action, entity, timestamp

---

# PART 20 — COMPLETE PRE-LAUNCH CHECKLIST

Run this for every new site before going live:

## Infrastructure
- [ ] PM2 process running and auto-restarts on crash
- [ ] Nginx proxy config correct, HTTPS enforced
- [ ] SSL certificate valid, auto-renewal configured
- [ ] Uptime Kuma monitoring active for this site
- [ ] Sentry error tracking initialized in this site
- [ ] OpenReplay tracking snippet installed and receiving sessions

## SEO
- [ ] Lighthouse SEO ≥ 90 on homepage, product page, category page
- [ ] Lighthouse Performance ≥ 90 on mobile
- [ ] sitemap.xml accessible and contains all public pages
- [ ] robots.txt accessible and blocks /cart /checkout /account /api
- [ ] All pages have unique title tags (run Screaming Frog scan)
- [ ] All pages have unique meta descriptions
- [ ] Canonical tag present on all pages
- [ ] HTTPS enforced — no mixed content
- [ ] No pages return 404

## Schema
- [ ] Homepage: Organization + WebSite validates in Rich Results Test
- [ ] Product page: Product + Offer + AggregateRating validates
- [ ] Category page: ItemList + BreadcrumbList validates
- [ ] FAQ sections: FAQPage schema validates
- [ ] Store pages: LocalBusiness schema validates

## Content
- [ ] Every page has a unique H1
- [ ] No page has thin content (< 300 words) unless pure product listing
- [ ] All product images have descriptive alt text
- [ ] All internal links use descriptive anchor text
- [ ] AI-enhanced descriptions approved for all products
- [ ] Reviews imported, filtered (no "meesho" mentions), approved

## Analytics & Ads
- [ ] GA4 property created, connected, purchase event fires correctly
- [ ] Google Search Console verified, sitemap submitted
- [ ] Meta Pixel installed and firing page_view + purchase events
- [ ] Google Ads conversion tracking verified
- [ ] OpenReplay receiving sessions

## E-commerce
- [ ] Razorpay/Stripe test payment completes successfully end-to-end
- [ ] Order confirmation email sends on test purchase
- [ ] Inventory decrements correctly on purchase
- [ ] Google Merchant Center feed accessible at /api/[siteId]/feed/google-merchant
- [ ] GMC feed submitted to Google Merchant Center

## Super Admin Connections
- [ ] Site appears in super admin with correct config
- [ ] AI model configured for description_rewrite task
- [ ] GSC API connected for this site
- [ ] Ads accounts linked (Google Ads + Meta)
- [ ] OpenReplay project key set in site config

---

END OF MASTER SYSTEM PROMPT
VERSION 1.0 — COMPLETE
