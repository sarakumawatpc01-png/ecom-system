type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  return (
    <main>
      <h1>Category: {slug.replace(/-/g, ' ')}</h1>
      <p>Sample category page used for storefront checks and Lighthouse CI.</p>
    </main>
  );
}
