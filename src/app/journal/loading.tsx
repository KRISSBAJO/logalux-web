// Shown while the Journal is being read: the dark bar and the shape of a few article cards.
export default function Loading() {
  return (
    <>
      <div className="h-[76px] bg-ink-2" aria-hidden />
      <main aria-busy="true" aria-label="Loading the Journal" className="container-x py-10 pb-24">
        <p role="status" className="text-[13.5px] text-muted">Loading articles…</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-[300px] animate-pulse rounded-[20px] border border-line bg-white motion-reduce:animate-none" />)}
        </div>
      </main>
    </>
  );
}
