type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return (
    <main>
      <h1>Product: {slug.replace(/-/g, ' ')}</h1>
      <p>Sample product page used for storefront checks and Lighthouse CI.</p>
    </main>
  );
}
