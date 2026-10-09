"use client";

export default function BusinessError({ reset }: { reset: () => void }) {
 return <main style={{maxWidth:560,margin:"15vh auto",padding:24}}><h1>Business console unavailable</h1><p>We could not load your business account. Your session has not been cleared. Please try again.</p><button type="button" onClick={reset}>Try again</button></main>;
}
