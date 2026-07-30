# Docling Client

`@docling/docling-client` is the official TypeScript client for
[Docling Serve](https://github.com/docling-project/docling-serve) and managed
Docling services implementing the same API, including IBM-hosted Docling.

It is a remote client. Document conversion, OCR, table extraction, enrichment,
and chunking run in the service; the package submits work, follows task state,
retrieves results, and safely materializes artifacts.

## Install

```sh
npm install @docling/docling-client
```

Node.js 18 or newer is required. URL and base64 requests work in Node and
browsers. Node additionally supports local paths. Browser applications using
the default presigned-artifact path must provide a trusted DNS resolver through
`artifactDownload.resolver`, or explicitly opt into their own URL policy with
`allowPrivateUrls`; browsers do not expose DNS answers needed by the default
SSRF check.

## Configure

```ts
import { DoclingClient } from '@docling/docling-client';

const client = new DoclingClient({
  baseUrl: process.env.DOCLING_URL!,
  apiKey: process.env.DOCLING_API_KEY,
  options: {
    do_ocr: true,
    table_mode: 'accurate',
  },
  statusWatcher: 'websocket',
  webSocketFallbackToPoll: true,
  jobTimeoutMs: 15 * 60_000,
  maxConcurrency: 8,
  httpRetries: 3,
  httpTimeoutMs: 60_000,
});
```

The base URL is the service root, without `/v1`, a query, or a fragment.
`X-Api-Key` is sent when `apiKey` is set. Per-call service headers override
constructor headers.

## Convert

`convert()` is the high-level, Python-compatible path. It tries a presigned
artifact target first, narrowly falls back to an in-body result when artifact
storage is unavailable, requests Markdown plus Docling JSON by default, and
returns a `ConversionResult`.

```ts
const result = await client.convert('https://example.org/manual.pdf', {
  options: {
    do_ocr: true,
    table_mode: 'accurate',
    include_images: true,
  },
  maxNumPages: 100,
  maxFileSize: 100 * 1024 * 1024,
  pageRange: [1, 20],
  raisesOnError: true,
});

console.log(result.status);
console.log(result.document);
console.log(result.errors);
```

Sources accepted by high-level calls are:

- HTTP(S) URL strings, `URL`, or `{kind: "http"}` sources, including
  source-fetch headers;
- Node filesystem paths;
- `{data, filename, contentType}` using `Blob`, `ArrayBuffer`, or typed arrays;
- base64 `{kind: "file", filename, base64_string}` sources.

ZIP URLs are rejected on ordinary conversion routes. Local and binary inputs
use multipart upload for in-body, ZIP, and presigned targets. External targets
use the unified base64 request so their complete credentials and coordinates
are preserved.

`convertAll()` lazily runs one complete task per source with bounded
concurrency, preserves input order, and turns individual failures into failed
`ConversionResult` values without stopping unrelated work:

```ts
for await (const result of client.convertAll(urls, {
  maxConcurrency: 16,
})) {
  console.log(result.input.filename, result.status);
}
```

## Submit jobs and choose a target

`submitSource()` mirrors Python's job-oriented `submit()`. Convenience methods
are available for URL, base64, and binary inputs.

```ts
const job = await client.submitUrl(
  'https://example.org/manual.pdf',
  { to_formats: ['md', 'json'] },
  { target: { kind: 'inbody' } }
);

for await (const status of job.watch()) {
  console.log(status.task_status, status.task_position);
}

const result = await job.result();
console.log(result.document);
```

Target-specific results are statically typed:

| Target                                                               | Result                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| omitted                                                              | presigned response, or `ConversionResult` after the narrow in-body fallback |
| `{kind: "inbody"}`                                                   | `ConversionResult`                                                          |
| `{kind: "zip"}`                                                      | `RawServiceResult` with lossless `Uint8Array` content                       |
| `{kind: "presigned_url"}`                                            | per-document artifacts and outcome counts                                   |
| S3, Azure Blob, Google Cloud Storage, Google Drive, or low-level Put | outcome counts                                                              |

S3, Azure, GCS, Drive, generic connector, callback, and Put payloads can carry
credentials. Treat request bodies and logs accordingly.

## Batch connectors

The batch route enumerates documents from remote connectors and writes to a
presigned or storage target:

```ts
const job = await client.submitBatch(
  {
    sources: [
      {
        kind: 's3',
        endpoint: 's3.us-east-1.amazonaws.com',
        access_key: process.env.S3_ACCESS_KEY!,
        secret_key: process.env.S3_SECRET_KEY!,
        bucket: 'incoming-documents',
        key_prefix: 'manuals/',
      },
    ],
    target: { kind: 'presigned_url' },
    callbacks: [
      {
        url: 'https://workflow.example.com/docling-progress',
        headers: { authorization: `Bearer ${process.env.CALLBACK_TOKEN}` },
      },
    ],
  },
  { outputFormats: ['json', 'md'] }
);

const result = await job.result();
```

Batch sources support HTTP, S3, Azure Blob, GCS, Google Drive, and
forward-compatible generic connectors. Batch targets support presigned
artifacts, those storage systems, and generic connectors. File, in-body, ZIP,
and Put targets are rejected on the batch route, matching the Python client.

## Convert and chunk

Chunk endpoints convert and chunk in one service task:

```ts
const result = await client.chunk('https://example.org/manual.pdf', {
  chunker: 'hybrid',
  convert_options: {
    do_ocr: true,
    table_mode: 'accurate',
  },
  chunking_options: {
    max_tokens: 384,
    tokenizer: 'sentence-transformers/all-MiniLM-L6-v2',
    merge_peers: true,
    include_raw_text: true,
    use_markdown_tables: true,
    use_markdown_images: true,
  },
  include_converted_doc: true,
});

console.log(result.chunks[0]?.text);
console.log(result.documents[0]?.content.json_content);
```

The Python-shaped overload is also supported:

```ts
const result = await client.chunk(
  'https://example.org/manual.pdf',
  'hierarchical',
  { do_ocr: true },
  { includeConvertedDoc: true }
);
```

Use `submitChunk()`, `submitChunkUrl()`, `submitChunkFile()`, or
`submitChunkBinary()` when a job handle is needed. JSON chunk requests support
multiple sources, callbacks, all chunker options, and
`include_converted_doc`. Multipart chunk routes accept one file and do not
support callbacks.

Although `chunks` is a member of Docling's general `OutputFormat` enum, Serve
chunking is selected through
`/v1/chunk/{hybrid|hierarchical}/{source|file}/async`, not by setting
`to_formats: ["chunks"]` on a normal conversion.

## Fan-out

`submitAndRetrieveEach()` accepts `Iterable` and `AsyncIterable` inputs, keeps
at most `maxInFlight` full task lifecycles active, and yields completion order
by default:

```ts
for await (const [item, outcome] of client.submitAndRetrieveEach(items, {
  maxInFlight: 8,
  ordered: false,
})) {
  if (outcome instanceof Error) {
    console.error(item.metadata, outcome);
  } else {
    console.log(item.metadata, outcome);
  }
}
```

Omitting `target` retains the correctly typed presigned-or-in-body result.
When more than 64 jobs are in flight, the client uses polling for those waits
instead of opening more WebSockets. `submitAndRetrieveMany()` remains as a
deprecated alias.

## Task lifecycle

`DoclingJob` exposes:

- `taskId`, `submittedAt`, `queuePosition`, `done`, and the full cached
  `TaskStatusResponse` through `status`;
- `poll()`, `watch()`, `wait()`, `getResult()`, and `result()`.

`client.job(taskId, status?, loader?)` attaches to existing work. WebSocket
watching is the default, authenticates with the query parameter and, in Node,
also `X-Api-Key`, implements Serve's `next` handshake, reconnects transport
failures up to three times, and can fall back to long polling. Polling uses
`GET /v1/status/poll/{task_id}?wait=...`.

All waits accept `AbortSignal`. Result lookup distinguishes an unknown task, a
not-yet-ready result, an expired terminal result, and authoritative task
failure.

## Retries and errors

The default `FetchTransport` matches the Python retry policy:

- HTTP 500 and 502 retry for every method with exponential backoff;
- HTTP 429 and 503 retry only with a valid `Retry-After`;
- transport failures retry only for GET, HEAD, and OPTIONS;
- caller cancellation is never retried;
- health and version calls use zero retries.

All service-originated failures derive from `DoclingServiceError`.
Specialized errors cover HTTP responses, exhausted/unavailable service,
usage limits, response-schema mismatch, task execution, task timeout, task
not-found, result-not-ready, result-expired, artifact download, and
high-level conversion failure.

## Presigned artifact safety

High-level conversion can materialize a JSON artifact or a resource bundle.
The downloader:

- never forwards Docling service headers to artifact hosts;
- allows only HTTP(S), resolves every DNS address, and rejects any non-global
  address unless explicitly configured otherwise;
- revalidates every redirect, with a five-redirect default;
- enforces timeout, compressed-download, uncompressed-bundle, and entry-count
  limits;
- validates ZIP paths, requires exactly one top-level Docling JSON file, and
  validates referenced image MIME signatures before embedding data URIs.

Download or reconstruction failure becomes a failed `ConversionResult`, which
lets `convertAll()` continue. Caller cancellation still propagates.

## Conversion options

`ConvertDocumentsOptions` explicitly types the current Python/Serve fields:
format selection, pipeline, page range, OCR, PDF backend, table extraction,
image export, code/formula/picture/chart enrichments, VLM presets and custom
configuration, layout/table/classification presets, deprecated legacy VLM and
picture-description options, timeout, and abort behavior.

Options merge shallowly: constructor defaults are copied, per-call values
replace top-level fields, `undefined` leaves a default unchanged, and `null`
clears an optional default. An index signature preserves forward compatibility
with managed-service options added ahead of this package; the selected
service's OpenAPI document remains authoritative.

## Docling document types

The client deliberately does not pin `@docling/docling-core`. Its default
`DoclingDocument` is a version-neutral JSON boundary. Applications wanting the
exact schema from their installed core package can parameterize the client:

```ts
import type { DoclingDocument } from '@docling/docling-core';
import { DoclingClient } from '@docling/docling-client';

const client = new DoclingClient<DoclingDocument>({ baseUrl, apiKey });
```

This keeps service-client releases independent from document-schema releases
while preserving full static typing when desired.

## Custom transports

Hosts such as n8n can inject HTTP:

```ts
import { DoclingClient, type DoclingTransport } from '@docling/docling-client';

const transport: DoclingTransport = {
  async request<T>(request) {
    return platformHttpRequest(request) as Promise<T>;
  },
  async close() {
    await platformHttpClose();
  },
};

const client = new DoclingClient({
  baseUrl: 'https://managed-docling.example.com',
  transport,
});
```

A custom transport is the complete HTTP policy boundary: it must preserve
binary responses, exact-200 behavior, retry/error mapping, headers, timeout,
and cancellation described by `DoclingTransportRequest`. It cannot be combined
with the built-in fetch/retry options. WebSocket watching and artifact
downloads remain separately injectable.

## Development

```sh
npm install
npm run check
```

The unit suite requires no live service. To verify endpoint, response-content,
schema-property, required-field, target/connector, and enum compatibility
against a running service:

```sh
DOCLING_API_KEY=... \
  npm run contract:check -- https://managed-docling.example.com/openapi.json
```

See [Python client parity](./PYTHON_CLIENT_PARITY.md) for the complete
feature-by-feature comparison.
