import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { requireRole } from '../../middleware/auth';
import { saveUploadedMedia } from '../../services/mediaStore';
import { scrapeMeesho, type ScrapedMeeshoProduct, type ScrapedMeeshoReview } from '../../services/meeshoScraper';
import { getSiteId, toPagination } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.use(requireRole('super_admin', 'site_admin'));

const urlSchema = z.object({
  source_url: z.string().url(),
  auto_publish: z.boolean().optional(),
  auto_queue_ai_rewrite: z.boolean().optional(),
  auto_queue_ai_image_generation: z.boolean().optional(),
  auto_approve_reviews: z.boolean().optional(),
  import_variants: z.boolean().optional(),
  minimum_review_rating: z.number().int().min(1).max(5).optional()
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const toPrice = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
};

const reviewText = (review: ScrapedMeeshoReview) => String(review.text || review.body || '');
const hasMeeshoKeyword = (review: ScrapedMeeshoReview) => /meesho/i.test(reviewText(review));

const queueImportAiJobs = async (siteId: string, productId: string, opts: { rewrite: boolean; image: boolean }) => {
  if (opts.rewrite) {
    await db.ai_jobs.createMany({
      data: [
        {
          site_id: siteId,
          entity_type: 'product',
          entity_id: productId,
          task_type: 'rewrite_description',
          status: 'queued',
          input_payload: { product_id: productId }
        },
        {
          site_id: siteId,
          entity_type: 'product',
          entity_id: productId,
          task_type: 'title_rewrite',
          status: 'queued',
          input_payload: { product_id: productId }
        },
        {
          site_id: siteId,
          entity_type: 'product',
          entity_id: productId,
          task_type: 'seo_meta',
          status: 'queued',
          input_payload: { product_id: productId }
        }
      ]
    });
  }
  if (opts.image) {
    await db.ai_jobs.create({
      data: {
        site_id: siteId,
        entity_type: 'product',
        entity_id: productId,
        task_type: 'generate_image',
        status: 'queued',
        input_payload: { product_id: productId }
      }
    });
  }
};

const importSingleProduct = async (
  siteId: string,
  payload: ScrapedMeeshoProduct,
  options: {
    autoPublish: boolean;
    autoApproveReviews: boolean;
    importVariants: boolean;
    minimumReviewRating: number;
    queueRewrite: boolean;
    queueImage: boolean;
  }
) => {
  const slugBase = slugify(payload.name || payload.original_name || `meesho-${Date.now()}`) || `meesho-${Date.now()}`;
  const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;
  const product = await db.products.create({
    data: {
      site_id: siteId,
      name: payload.name || payload.original_name || 'Imported Product',
      original_name: payload.original_name || payload.name || null,
      slug,
      description: payload.description || null,
      original_description: payload.original_description || payload.description || null,
      short_description: payload.short_description || null,
      sku: payload.sku || null,
      brand: payload.brand || null,
      price: toPrice(payload.price, 0),
      compare_price: payload.compare_price != null ? toPrice(payload.compare_price, 0) : null,
      currency: payload.currency || 'INR',
      stock_quantity: Number.isFinite(Number(payload.stock_quantity)) ? Number(payload.stock_quantity) : 0,
      status: options.autoPublish ? 'active' : 'draft',
      source: 'meesho',
      source_id: payload.source_id || null,
      source_url: payload.source_url || null,
      ai_description_status: 'pending'
    }
  } as any);

  let imagesDownloaded = 0;
  const productImages = Array.isArray(payload.images) ? payload.images : [];
  for (let i = 0; i < productImages.length; i += 1) {
    const imageUrl = productImages[i];
    if (!imageUrl) continue;
    try {
      const media = await saveUploadedMedia({
        siteId,
        filename: `meesho-product-${product.id}-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        sourceUrl: imageUrl
      });
      await db.product_images.create({
        data: {
          site_id: siteId,
          product_id: product.id,
          url: media.path,
          original_url: imageUrl,
          source: 'meesho',
          is_primary: i === 0,
          sort_order: i
        }
      } as any);
      imagesDownloaded += 1;
    } catch {
      // Skip failed image fetch/re-host.
    }
  }

  if (options.importVariants) {
    const variants = Array.isArray(payload.variants) ? payload.variants : [];
    for (const variant of variants) {
      await db.product_variants.create({
        data: {
          site_id: siteId,
          product_id: product.id,
          name: variant.name,
          sku: variant.sku || null,
          price: toPrice(variant.price, toPrice(payload.price, 0)),
          stock_qty: Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : 0,
          stock: Number.isFinite(Number(variant.stock)) ? Number(variant.stock) : 0,
          options: variant.options || {},
          image_url: variant.image_url || null
        }
      } as any);
    }
  }

  const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  const eligibleReviews = reviews.filter((review) => (review.rating || 0) >= options.minimumReviewRating);
  const skippedMeeshoReviews = eligibleReviews.filter(hasMeeshoKeyword).length;
  const importableReviews = eligibleReviews.filter((review) => !hasMeeshoKeyword(review));
  let importedReviews = 0;
  for (const review of importableReviews) {
    const createdReview = await db.reviews.create({
      data: {
        site_id: siteId,
        product_id: product.id,
        author_name: review.author_name || 'Verified Buyer',
        rating: Math.max(1, Math.min(5, Number(review.rating || 5))),
        title: review.title || null,
        body: reviewText(review) || null,
        original_body: reviewText(review) || null,
        source: 'meesho',
        source_id: review.source_id || null,
        status: options.autoApproveReviews ? 'approved' : 'pending',
        is_approved: options.autoApproveReviews,
        contains_meesho: false,
        is_flagged: false,
        approved_at: options.autoApproveReviews ? new Date() : null
      }
    } as any);
    importedReviews += 1;
    const reviewImages = Array.isArray(review.images) ? review.images : [];
    for (let i = 0; i < reviewImages.length; i += 1) {
      const reviewImageUrl = reviewImages[i];
      if (!reviewImageUrl) continue;
      try {
        const media = await saveUploadedMedia({
          siteId,
          filename: `meesho-review-${createdReview.id}-${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          sourceUrl: reviewImageUrl
        });
        await db.review_images.create({
          data: {
            site_id: siteId,
            review_id: createdReview.id,
            url: media.path,
            original_url: reviewImageUrl
          }
        } as any);
        imagesDownloaded += 1;
      } catch {
        // Skip failed image fetch/re-host.
      }
    }
  }

  await queueImportAiJobs(siteId, product.id, { rewrite: options.queueRewrite, image: options.queueImage });

  return {
    productId: product.id,
    reviewsFound: eligibleReviews.length,
    reviewsImported: importedReviews,
    reviewsSkipped: skippedMeeshoReviews,
    imagesDownloaded
  };
};

router.post('/url', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = urlSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const log = await db.meesho_import_log.create({
    data: {
      site_id: siteId,
      source_url: parsed.data.source_url,
      status: 'processing',
      started_at: new Date()
    }
  });
  try {
    const result = await scrapeMeesho(parsed.data.source_url);
    const products = Array.isArray(result.products) ? result.products : [];
    const options = {
      autoPublish: Boolean(parsed.data.auto_publish),
      autoApproveReviews: Boolean(parsed.data.auto_approve_reviews),
      importVariants: parsed.data.import_variants !== false,
      minimumReviewRating: parsed.data.minimum_review_rating || 1,
      queueRewrite: parsed.data.auto_queue_ai_rewrite !== false,
      queueImage: Boolean(parsed.data.auto_queue_ai_image_generation)
    };
    let productsImported = 0;
    let reviewsFound = 0;
    let reviewsImported = 0;
    let reviewsSkipped = 0;
    let imagesDownloaded = 0;
    for (const productPayload of products) {
      const imported = await importSingleProduct(siteId, productPayload, options);
      productsImported += 1;
      reviewsFound += imported.reviewsFound;
      reviewsImported += imported.reviewsImported;
      reviewsSkipped += imported.reviewsSkipped;
      imagesDownloaded += imported.imagesDownloaded;
    }
    await db.meesho_import_log.update({
      where: { id: log.id },
      data: {
        status: 'done',
        products_found: products.length,
        products_imported: productsImported,
        reviews_found: reviewsFound,
        reviews_imported: reviewsImported,
        reviews_skipped: reviewsSkipped,
        images_downloaded: imagesDownloaded,
        completed_at: new Date()
      }
    });
    return res.status(201).json({
      ok: true,
      data: { log_id: log.id, products_found: products.length, products_imported: productsImported, reviews_imported: reviewsImported }
    });
  } catch (error) {
    await db.meesho_import_log.update({
      where: { id: log.id },
      data: { status: 'failed', error_message: error instanceof Error ? error.message : 'Import failed', completed_at: new Date() }
    });
    return res.status(500).json({ ok: false, message: 'Import failed' });
  }
});

router.post('/bulk', async (req, res) => {
  const siteId = getSiteId(req);
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.map((url: unknown) => String(url)) : [];
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (urls.length === 0) return res.status(400).json({ ok: false, message: 'urls is required' });
  const queued: string[] = [];
  for (const url of urls) {
    const parsed = urlSchema.safeParse({ source_url: url });
    if (!parsed.success) continue;
    const log = await db.meesho_import_log.create({
      data: {
        site_id: siteId,
        source_url: parsed.data.source_url,
        status: 'queued'
      }
    });
    queued.push(log.id);
  }
  return res.status(201).json({ ok: true, data: { queued } });
});

router.get('/logs', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.meesho_import_log.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.meesho_import_log.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.get('/logs/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const item = await db.meesho_import_log.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, message: 'Log not found' });
  return res.json({ ok: true, data: item });
});

export default router;
