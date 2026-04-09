import { db } from '../lib/db';

const scoreClamp = (value: number) => Math.max(0, Math.min(100, value));

export const runSeoAudit = async (siteId: string) => {
  const [products, blogs] = await Promise.all([
    db.products.findMany({
      where: { site_id: siteId, is_deleted: false },
      select: { id: true, slug: true, name: true, description: true, seo_title: true, seo_description: true }
    }),
    db.blog_posts.findMany({
      where: { site_id: siteId },
      select: { id: true, slug: true, title: true, content: true, meta_title: true, meta_desc: true, status: true }
    })
  ]);

  const issues: string[] = [];
  const suggestions: string[] = [];

  const productMissingSeo = products.filter((product) => !product.seo_title || !product.seo_description).length;
  const productThinDescription = products.filter((product) => (product.description || '').trim().length < 120).length;
  const duplicateProductTitles =
    products.length -
    new Set(products.map((product) => (product.seo_title || product.name || '').trim().toLowerCase()).filter(Boolean)).size;

  const publishedBlogs = blogs.filter((post) => post.status === 'published');
  const blogMissingMeta = publishedBlogs.filter((post) => !post.meta_title || !post.meta_desc).length;
  const blogThinContent = publishedBlogs.filter((post) => (post.content || '').trim().length < 300).length;

  if (productMissingSeo > 0) issues.push(`${productMissingSeo} product pages are missing SEO title or description.`);
  if (productThinDescription > 0) issues.push(`${productThinDescription} product pages have thin descriptions.`);
  if (duplicateProductTitles > 0) issues.push(`${duplicateProductTitles} product pages have duplicate SEO titles.`);
  if (blogMissingMeta > 0) issues.push(`${blogMissingMeta} published blog pages are missing meta tags.`);
  if (blogThinContent > 0) issues.push(`${blogThinContent} published blog pages have thin content.`);

  if (productMissingSeo > 0) suggestions.push('Queue SEO meta rewrite jobs for products missing metadata.');
  if (productThinDescription > 0) suggestions.push('Enrich low-content product descriptions with AI rewrite jobs.');
  if (duplicateProductTitles > 0) suggestions.push('Generate unique title tags for duplicate product pages.');
  if (blogMissingMeta > 0) suggestions.push('Generate missing blog meta title and description fields.');
  if (blogThinContent > 0) suggestions.push('Queue content briefs for thin blog posts.');

  const deductions =
    productMissingSeo * 4 + productThinDescription * 2 + duplicateProductTitles * 3 + blogMissingMeta * 3 + blogThinContent * 2;
  const score = scoreClamp(100 - deductions);

  return { score, issues, suggestions };
};
