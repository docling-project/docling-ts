export default function ({ children }: { children?: any }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
        />
        <link rel="stylesheet" href="/static/index.css" />
        <link rel="icon" href="/static/logo.png" />

        <title>Doc Hunt</title>

        <script
          type="module"
          src="/node_modules/@docling/docling-components/dist/index.es.js"
        />
        <script src="https://unpkg.com/htmx.org@2.0.4" />
      </head>

      <body>{children}</body>
    </html>
  );
}
