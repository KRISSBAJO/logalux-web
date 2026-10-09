// Shown while the results are being read: the dark top of the page and the shape of a few result cards.
export default function Loading() {
  return (
    <>
      <div className="hero-glow h-[260px]" aria-hidden />
      <main aria-busy="true" aria-label="Loading results" className="container-x py-6 pb-24">
        <p role="status" className="text-[13.5px] text-muted">Finding professionals…</p>
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col gap-3.5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-[168px] animate-pulse rounded-[20px] border border-line bg-white motion-reduce:animate-none" />)}</div>
          <div className="hidden h-[calc(100vh-100px)] rounded-[22px] border border-line bg-[#EDE6DC] lg:block" />
        </div>
      </main>
    </>
  );
}
