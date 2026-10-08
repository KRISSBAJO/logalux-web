"use client";

/** Opens the print dialog of the browser, which can also save the page as a PDF. */
export function PrintButton() {
  return <button type="button" className="btn btn-ink" onClick={() => window.print()}>Print or save as PDF</button>;
}
