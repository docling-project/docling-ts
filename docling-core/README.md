# Docling Core

TypeScript definitions and functions for using Docling output, which simplifies document processing, parsing diverse formats — including advanced PDF understanding. This package supports integrating [Docling](https://docling.io) output into your Type-/JavaScript app with type definitions and utility functions that reflect the [Docling Core](https://github.com/docling-project/docling-core) Python library.

## Getting started

### Install package

```sh
npm i @docling/docling-core
```

### Convert and fetch

To convert a document you can:

- Use a separate document conversion service, such as [docling-serve](https://github.com/docling-project/docling-serve).
- Integrate Docling into your own API, or use the Docling CLI for a quick web service [example](https://github.com/docling-project/docling-ts/tree/main/examples/deno).
- Pre-convert documents and host these as static resources, on a COS bucket for example.

Next, fetch the (typed) conversion:

```ts
import { type DoclingDocument } from '@docling/docling-core';

async function fetchConversion(url: string) {
  const response = await fetch(url);

  return (await response.json()) as DoclingDocument;
}
```

### Iterate and discriminate

Use the utility and typing functions for easy access to the converted document contents:

```ts
import { iterateDocumentItems, isDocling } from '@docling/docling-core';

for (const [item, level] of iterateDocumentItems(conversion)) {
  if (isDocling.TextItem(item)) {
    console.log(item.text);
  } else if (isDocling.TableItem(item)) {
    ...
  }
}
```

### Limitations

This package does not

- Convert documents directly from within a JavaScript runtime. It is not a port of Docling.
- Support Docling output formats other than JSON, such as Markdown.

## Develop

This package is tied to a specific version of the docling document format. Upgrade to a newer version of the document format:

- In `package.json` set `config.docling` to the target version. For example, `"docling": "v23.3.0"`
- Generate the corresponding types: `npm run generate`
