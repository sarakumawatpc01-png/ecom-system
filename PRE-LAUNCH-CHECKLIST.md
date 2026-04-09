# Pre-Launch Checklist (Part 20)

Use this checklist for every site before go-live.

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
- [ ] All pages have unique title tags
- [ ] All pages have unique meta descriptions
- [ ] Canonical tag present on all pages
- [ ] HTTPS enforced — no mixed content
- [ ] No pages return 404

## Schema
- [ ] Homepage schema validates
- [ ] Product page schema validates
- [ ] Category page schema validates
- [ ] FAQ schema validates
- [ ] Store pages LocalBusiness schema validates

## Content
- [ ] Every page has a unique H1
- [ ] No thin content unless product listing page
- [ ] Product images have descriptive alt text
- [ ] Internal links use descriptive anchor text
- [ ] AI-enhanced descriptions approved for all products
- [ ] Reviews imported, filtered, approved

## Analytics & Ads
- [ ] GA4 connected and purchase event verified
- [ ] GSC verified and sitemap submitted
- [ ] Meta Pixel page_view + purchase verified
- [ ] Google Ads conversion tracking verified
- [ ] OpenReplay receiving sessions

## E-commerce
- [ ] Test payment completes end-to-end
- [ ] Order confirmation email sends on test purchase
- [ ] Inventory decrements correctly on purchase
- [ ] Google Merchant feed accessible at `/api/:siteId/feed/google-merchant`
- [ ] GMC feed submitted

## Super Admin Connections
- [ ] Site appears in super admin with correct config
- [ ] AI model configured for `description_rewrite`
- [ ] GSC API connected for this site
- [ ] Ads accounts linked
- [ ] OpenReplay project key set in site config

## API Evidence Endpoint

- `GET /api/:siteId/prelaunch/checklist` returns machine-readable progress status for key automated checks.
