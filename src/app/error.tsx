"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{reset:()=>void}) {
  return <main className="container-x py-20"><h1 className="serif text-4xl">Something didn’t load</h1><p role="alert" className="mt-4 max-w-lg text-muted">Please try again. If you were making a payment, check your account before paying again.</p><div className="mt-6 flex gap-3"><button onClick={reset} className="btn btn-ink">Try again</button><Link href="/account" className="btn btn-out">Check my account</Link><Link href="/help" className="btn btn-out">Get help</Link></div></main>;
}
