export default function ({ children }: { children?: any }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link
          rel="icon"
          href="https://ds4sd.github.io/docling/assets/logo.png"
        />
        <title>Birder</title>
        <link rel="stylesheet" href="/static/style/index.css" />
        <link rel="stylesheet" href="/static/style/home.css" />

        <script
          type="module"
          src="/node_modules/@docling/docling-components/dist/index.js"
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
