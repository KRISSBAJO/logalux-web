export default function Loading() {
  return <main aria-busy="true" aria-label="Loading your account" className="container-x max-w-[1040px] py-12"><p role="status" className="text-muted">Loading your activity…</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map(n=><div key={n} className="h-32 animate-pulse rounded-2xl bg-cream-2 motion-reduce:animate-none"/>)}</div></main>;
}
