// Shown while a business page is being read: the dark bar, the gallery's shape and a title line.
export default function Loading() {
  return (
    <>
      <div className="h-[76px] bg-ink-2" aria-hidden />
      <main aria-busy="true" aria-label="Loading the business" className="container-x max-w-[1180px] py-6">
        <p role="status" className="text-[13.5px] text-muted">Loading the page…</p>
        <div className="mt-4 grid h-[340px] gap-2 md:grid-cols-[2fr_1fr]">
          <div className="animate-pulse rounded-[22px] bg-cream-2 motion-reduce:animate-none" />
          <div className="hidden gap-2 md:grid md:grid-rows-2"><div className="rounded-[22px] bg-cream-2" /><div className="rounded-[22px] bg-cream-2" /></div>
        </div>
        <div className="mt-8 h-10 w-2/3 max-w-[460px] animate-pulse rounded-full bg-cream-2 motion-reduce:animate-none" />
        <div className="mt-3 h-5 w-1/3 max-w-[260px] rounded-full bg-cream-2" />
      </main>
    </>
  );
}
