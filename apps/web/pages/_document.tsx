// Minimal Pages Router document — avoids next/document's Html component
// which throws when HtmlContext is missing during App Router SSG (Next.js 15.x bug).
// The App Router (app/not-found.tsx) handles actual 404 responses; this file
// only exists so Next.js can generate the static /404 fallback without crashing.
export default function Document() {
  return (
    <html lang="en">
      <head></head>
      <body></body>
    </html>
  );
}
