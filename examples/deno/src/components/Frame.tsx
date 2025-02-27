export default function ({ children }: { children?: any }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <link rel="stylesheet" href="/static/style/index.css" />
        <link
          rel="icon"
          href="https://ds4sd.github.io/docling/assets/logo.png"
        />

        <title>Doc Hunt</title>

        <script
          type="module"
          src="/node_modules/@docling/docling-components/dist/index.js"
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
