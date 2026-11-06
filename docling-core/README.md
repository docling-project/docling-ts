# Docling Core

TypeScript definitions and functions for using Docling output, which simplifies document processing, parsing diverse formats — including advanced PDF understanding. This package supports integrating [Docling](https://docling.ai) output into your Type-/JavaScript app with type definitions and utility functions that reflect the [Docling Core](https://github.com/docling-project/docling-core) Python library.

## Getting started

### Install package

```sh
npm i @docling/docling-core
```

### Convert and fetch

To convert a document you can:

- Use a separate document conversion service, such as [docling-serve](https://github.com/docling-project/docling-serve).
- Integrate Docling into your own API, or use the Docling CLI for a quick web service.
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

### Read DocLang

`@docling/docling-core/doclang` turns DocLang XML into a `DoclingDocument`. It is a port of the Python `DocLangDocDeserializer`, and its JSON output matches Python's.

```ts
import { deserializeDocLang } from '@docling/docling-core/doclang';

const doc = deserializeDocLang(doclangXml); // browser: uses the native DOMParser
```

In Node, pass a `DOMParser`. `@xmldom/xmldom` is an optional peer dependency, so browser bundles never include it.

```ts
import { DOMParser } from '@xmldom/xmldom';

const doc = deserializeDocLang(doclangXml, { DOMParser });
```

The options mirror the Python `deserialize_str` keyword arguments:

- `pageNo`: the page of content before the first `<page_break/>` (default 1).
- `maxXmlBytes`, `maxDepth`, `maxElements`: budgets for untrusted input. Exceeding one throws.
- `repairUnescapedText`: escape a bare `&`, a `<` that cannot start markup, a stray `]]>` and illegal control characters before parsing. Off by default, so the input must be well-formed XML.
- `onWarning`: receives warnings (default `console.warn`). `<track>` is not supported yet and is skipped, with all its content, with a warning.

### Read DCLX archives

`deserializeDclx` reads a DCLX archive from bytes (`Uint8Array`, `ArrayBuffer`, `Blob` or `File`). Images are embedded in the document as base64 data URIs.

```ts
import { deserializeDclx } from '@docling/docling-core/doclang';

const doc = await deserializeDclx(await (await fetch(url)).arrayBuffer());
```

In Node, pass a `DOMParser` like with DocLang.

### Limitations

This package does not

- Convert documents directly from within a JavaScript runtime. It is not a port of Docling.
- Support Docling output formats other than JSON and DocLang (read-only), such as Markdown.
