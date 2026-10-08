/**
 * Structured data for search engines. The JSON is written into a script tag,
 * so the characters that could end the tag or start markup are escaped.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** A breadcrumb trail. Each step is a name and a full address. */
export function breadcrumbs(steps: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  };
}
