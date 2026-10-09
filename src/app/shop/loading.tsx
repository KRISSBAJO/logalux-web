// Shown while the shop is being read: the dark top and a grid of product-card shapes.
export default function Loading() {
  return (
    <>
      <div className="hero-glow h-[300px]" aria-hidden />
      <main aria-busy="true" aria-label="Loading the shop" className="container-x py-8 pb-24">
        <p role="status" className="text-[13.5px] text-muted">Loading products…</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <div key={n} className="h-[320px] animate-pulse rounded-[20px] border border-line bg-white motion-reduce:animate-none" />)}
        </div>
      </main>
    </>
  );
}
