# Python client parity

This document compares `@docling/docling-client` with Docling Python 2.115.0
at commit `f4380498`, specifically:

- `DoclingServiceClient`
- `AsyncDoclingServiceClient`
- `ConversionJob` and `AsyncConversionJob`
- the shared request, response, watcher, scheduler, and error contracts

TypeScript is naturally asynchronous, so Python's synchronous and asynchronous
facades map to one Promise/`AsyncIterable` API. No Python service-client
capability is deferred in this package. Language-specific adaptations and
additional TypeScript capabilities are documented after the parity tables.

## Client configuration

| Python constructor capability | TypeScript                               | Parity notes                                                                                                  |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Service URL                   | `baseUrl`                                | Both normalize trailing slashes and reject `/v1`, query, and fragment components.                             |
| API key                       | `apiKey`                                 | HTTP uses `X-Api-Key`; WebSocket uses the query parameter and also the header in Node.                        |
| Default conversion options    | `options`                                | Deep-copied at construction; per-call merge is shallow.                                                       |
| Status watcher                | `statusWatcher`                          | `websocket` default or `polling`.                                                                             |
| WebSocket polling fallback    | `webSocketFallbackToPoll`                | Enabled by default.                                                                                           |
| Poll server wait              | `pollServerWaitSeconds`                  | Five seconds by default.                                                                                      |
| Poll client interval          | `pollClientIntervalMs`                   | Defaults to the server-wait duration.                                                                         |
| Job timeout                   | `jobTimeoutMs`                           | Five minutes by default.                                                                                      |
| Conversion concurrency        | `maxConcurrency`                         | Eight by default; valid range 1–512.                                                                          |
| HTTP retries                  | `httpRetries`                            | Three by default.                                                                                             |
| HTTP timeout                  | `httpTimeoutMs`                          | Fetch has one total per-attempt timeout; Python/httpx exposes distinct connect and read/write/pool timeouts.  |
| HTTP backoff                  | `httpBackoffBaseMs`                      | One second by default.                                                                                        |
| Artifact timeout and size     | `artifactDownload.timeoutMs`, `maxBytes` | Same 60-second and 512-MiB defaults.                                                                          |
| Private artifact override     | `artifactDownload.allowPrivateUrls`      | Public TypeScript option; Python keeps its equivalent internal.                                               |
| Owned resource cleanup        | `close()`                                | TypeScript close is asynchronous, idempotent, closes an injected transport once, and prevents later requests. |

`fetch`, `transport`, `webSocketFactory`, `artifactDownloader`, and artifact
DNS/fetch injection are TypeScript extensions.

## Public operations

| Capability               | Python                          | TypeScript                             | Result/behavior                                                                                                       |
| ------------------------ | ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Health                   | `health()`                      | `health()`                             | No retries; validates `HealthCheckResponse`, including the default `"ok"` status.                                     |
| Version                  | `version()`                     | `version()`                            | No retries; requires an object response.                                                                              |
| Close                    | `close()` / `aclose()`          | `close()`                              | Resource cleanup.                                                                                                     |
| Convert one              | sync `convert()`                | async `convert()`                      | High-level `ConversionResult`; presigned-first, safe materialization, narrow in-body fallback, Markdown+JSON default. |
| Convert many             | sync `convert_all()`            | async iterable `convertAll()`          | One task per source, lazy bounded scheduling, input order, per-source failure isolation.                              |
| Submit one               | `submit()`                      | `submitSource()` or `submit()`         | Typed job; explicit in-body target resolves to `ConversionResult`.                                                    |
| URL convenience          | HTTP source model               | `submitUrl()`                          | Adds separate source-fetch headers.                                                                                   |
| Base64 convenience       | file source model               | `submitFile()`                         | Unified base64 source.                                                                                                |
| Local/binary convenience | `Path` / `DocumentStream`       | path string / `submitBinary()`         | Multipart where the route can represent the target; unified base64 otherwise.                                         |
| Batch connectors         | `submit_batch()`                | `submitBatch()`                        | Remote source enumeration and remote/presigned target.                                                                |
| Output-format override   | `output_formats=`               | `outputFormats`                        | Overrides merged `to_formats` for submit/batch convenience calls.                                                     |
| Submit chunk job         | `submit_chunk()`                | `submitChunk*()`                       | Hybrid or hierarchical job.                                                                                           |
| Convert and chunk        | sync `chunk()`                  | async `chunk()`                        | Combined service conversion and chunking.                                                                             |
| Per-item fan-out         | `submit_and_retrieve_each()`    | `submitAndRetrieveEach()`              | Lazy bounded full-lifecycle scheduling; completion or input order.                                                    |
| Deprecated fan-out name  | `submit_and_retrieve_many()`    | `submitAndRetrieveMany()`              | Alias retained.                                                                                                       |
| Attach to task           | internal job construction       | `job()`                                | TypeScript exposes attachment publicly.                                                                               |
| Poll                     | job `poll()`                    | client/job `poll()`                    | `wait=0` default; task-not-found mapping.                                                                             |
| Watch                    | job `watch()`                   | client/job `watch()`                   | WebSocket handshake/reconnect/fallback or polling.                                                                    |
| Wait                     | job `result()` waits internally | job `wait()` and `result()`            | TypeScript exposes terminal wait separately.                                                                          |
| Fetch typed result       | job `result()`                  | job `getResult()` / `result()`         | Target-specific loader.                                                                                               |
| Fetch raw result         | internal helpers                | `getRawResult()` / `getBinaryResult()` | TypeScript extension for integrations.                                                                                |

The Python asynchronous facade intentionally omits high-level
`convert()`, `convert_all()`, and `chunk()` methods. TypeScript includes them
because async is its native execution model.

## Sources

| Source                               | Ordinary conversion/chunk | Batch | Notes                                                                      |
| ------------------------------------ | ------------------------- | ----- | -------------------------------------------------------------------------- |
| HTTP(S)                              | Yes                       | Yes   | Headers are preserved; ordinary conversion rejects `.zip` URLs.            |
| Base64 file                          | Yes                       | No    | JSON `FileSource`.                                                         |
| Local path                           | Yes, Node                 | No    | Read lazily when normalized, then multipart or base64 depending on target. |
| `Blob` / `ArrayBuffer` / typed array | Yes                       | No    | TypeScript extension for Node/browser integrations.                        |
| S3                                   | No                        | Yes   | Endpoint, SSL flag, keys, bucket, prefix, enumeration limit.               |
| Azure Blob                           | No                        | Yes   | Account, container, connection string, prefix, enumeration limit.          |
| Google Cloud Storage                 | No                        | Yes   | Bucket, prefix, project/ADC, optional service-account object.              |
| Google Drive                         | No                        | Yes   | Path, token/refresh token, credentials path/object.                        |
| Generic connector                    | No                        | Yes   | Forward-compatible `kind` plus connector fields.                           |

TypeScript mirrors Python's extension-to-input-format map, including Office
templates/macros, images, XML variants, `tar.gz`, audio/video, email, EPUB, and
Box Note. Unknown extensions use the same PDF fallback. Local multipart MIME is
inferred from the filename when known.

## Targets and target-specific results

| Target               | Ordinary          | Batch | TypeScript job result                                         |
| -------------------- | ----------------- | ----- | ------------------------------------------------------------- |
| In body              | Yes               | No    | `ConversionResult`                                            |
| ZIP                  | Yes               | No    | `RawServiceResult`                                            |
| Presigned URL        | Yes               | Yes   | `PresignedUrlConvertResponse` with documents/artifacts/counts |
| S3                   | Yes               | Yes   | outcome counts                                                |
| Azure Blob           | Yes               | Yes   | outcome counts                                                |
| Google Cloud Storage | Yes               | Yes   | outcome counts                                                |
| Google Drive         | Yes               | Yes   | outcome counts                                                |
| Generic              | Python batch only | Yes   | outcome counts                                                |
| Put URL              | Wire model only   | No    | TypeScript low-level ordinary-target extension                |

`RemoteTargetResponse` is the clearer TypeScript alias for Python's historical
`PresignedUrlConvertDocumentResponse` counts-only name.

When a binary/local source uses Put or a storage target, TypeScript uses the
unified base64 endpoint rather than dropping target coordinates in the
multipart `target_type` field. This is stricter and more functional than the
overbroad Python multipart target annotation.

## Conversion options and limits

The explicit TypeScript option surface covers every field in Python
`ConvertDocumentsOptions`:

- `from_formats`, `to_formats`, `pipeline`, `page_range`
- `image_export_mode`, `include_images`, `include_page_images`, `images_scale`
- `do_ocr`, `force_ocr`, `ocr_engine`, `ocr_preset`, `ocr_lang`,
  `ocr_custom_config`
- `pdf_backend`
- `table_mode`, `table_cell_matching`, `do_table_structure`
- `do_code_enrichment`, `do_formula_enrichment`
- `do_picture_classification`, `do_picture_description`,
  `do_chart_extraction`, `picture_description_area_threshold`
- the deprecated `picture_description_local`, `picture_description_api`,
  `vlm_pipeline_model`, `vlm_pipeline_model_local`, and
  `vlm_pipeline_model_api`
- VLM, picture-description, code/formula, table-structure, layout, and
  picture-classification preset/custom-config pairs
- `document_timeout`, `abort_on_error`, and Markdown page-break placeholder

Known enums, page ranges, primitive shapes, and nested option object boundaries
are checked locally. Legacy VLM/picture-description model objects and the
Python model's preset/custom and legacy/new mutual-exclusion rules are also
validated before submission, including the exact Docling Core picture
classification labels. The string index accepts options introduced by a newer
managed service without forcing a client release.

Constructor options are copied. Per-call fields replace constructor fields at
the top level; `undefined` means no override and `null` clears an optional
default. Neither caller object is mutated.

High-level limits match Python:

- `maxNumPages` caps the effective page-range end.
- `pageRange` overrides the option's page range.
- `maxFileSize` preflights local, base64, and binary sources.
- Oversized input becomes a skipped result unless `raisesOnError` is enabled.
- Remote URL size remains unknown before service fetch.

TypeScript restricts limit values to safe integers, which is stricter than
Python's unbounded integer type.

## Chunking

Both clients call the dedicated async routes:

```text
POST /v1/chunk/hybrid/source/async
POST /v1/chunk/hybrid/file/async
POST /v1/chunk/hierarchical/source/async
POST /v1/chunk/hierarchical/file/async
```

Both support:

- conversion options;
- hybrid `max_tokens`, `tokenizer`, and `merge_peers`;
- shared `use_markdown_tables`, `use_markdown_images`, `image_placeholder`,
  and `include_raw_text`;
- `include_converted_doc`;
- in-body `ChunkDocumentResponse`;
- URL/base64/local/binary input.

TypeScript additionally exposes multi-source JSON chunk jobs, all chunker
options directly, and callbacks on JSON chunk requests. The multipart Serve
route has no callback form field, so the client rejects callbacks there rather
than silently discarding them. Known chunk-option primitives are validated
locally, and the route-selected chunker discriminator cannot be overridden by
an untyped payload.

`OutputFormat` still contains `"chunks"` because the Python enum does. That
value does not select a Serve chunk task; callers use the chunk routes.

## Jobs, watchers, and scheduling

| Behavior                  | Python                                             | TypeScript                                                                                                       |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Initial task data         | task id, submitted time, status, position          | Same                                                                                                             |
| `status` property         | status string                                      | Full cached `TaskStatusResponse`                                                                                 |
| Queue position            | Yes                                                | Yes                                                                                                              |
| Done state                | success/failure                                    | Same                                                                                                             |
| Poll default              | `wait=0`                                           | Same                                                                                                             |
| Default watch             | WebSocket                                          | Same                                                                                                             |
| WebSocket auth            | query plus header                                  | Query plus header in Node; browser WebSocket APIs prohibit custom headers, so browsers use the query credential. |
| Serve handshake           | sends `"next"` after nonterminal update            | Same                                                                                                             |
| Transport reconnects      | Three with exponential delays                      | Same                                                                                                             |
| Protocol/server error     | no transport reconnect                             | Same                                                                                                             |
| Poll fallback             | configurable                                       | Same                                                                                                             |
| Poll cadence              | minimum client interval when server returns early  | Same                                                                                                             |
| Terminal cached `watch()` | contacts watcher and yields current service status | Same                                                                                                             |
| Cancellation              | coroutine/task cancellation                        | `AbortSignal`                                                                                                    |

WebSockets and pending event waits are closed on success, error, timeout,
cancellation, callback failure, and early iterator return. A server error
falls back immediately when configured; only transport/connection failures
consume reconnect attempts.

Source normalization is cancellation-aware as well: pre-aborted calls do no
file I/O, Node path reads receive the caller signal, and binary materialization
checks cancellation before and after asynchronous reads.

Both schedulers:

- validate concurrency from 1 through 512;
- start lazily and bound complete submit/watch/result lifecycles;
- support completion order or input order;
- isolate ordinary item failures as values;
- cancel active work and close the input iterator when the consumer stops;
- switch fan-out waits above 64 in-flight jobs from WebSockets to polling.

Python's `submit_and_retrieve_each()` default is always eight even if the
client's conversion concurrency differs; TypeScript matches that behavior.
TypeScript also accepts `AsyncIterable`, preserves generic metadata, and
provides compile-time-correct auto-target result unions.

## HTTP policy

The built-in transport matches Python:

| Condition                                | Policy                                   |
| ---------------------------------------- | ---------------------------------------- |
| HTTP 500 or 502                          | Retry every method, exponential backoff  |
| HTTP 429 or 503 with valid `Retry-After` | Retry after numeric seconds or HTTP date |
| HTTP 429 or 503 without valid header     | Do not retry                             |
| Network/transport failure                | Retry GET, HEAD, and OPTIONS only        |
| Caller cancellation                      | Never retry                              |
| Health/version                           | Zero retries                             |
| Successful service response              | Exactly HTTP 200                         |

Retried response bodies are canceled, zero-delay retries do not sleep, and the
exhausted error preserves status and service detail. The Fetch implementation
uses one total timeout per attempt instead of httpx's separate phase timeouts.

A custom `DoclingTransport` replaces the complete built-in HTTP policy. That
is an integration boundary, not a partial hook: the host owns response status,
headers, binary handling, retries, quotas, timeout, and error mapping.

## Error mapping

| Python error                             | TypeScript                           |
| ---------------------------------------- | ------------------------------------ |
| `DoclingServiceClientError`              | `DoclingError`                       |
| `ServiceError`                           | `DoclingServiceError`                |
| generic non-retryable HTTP service error | `DoclingHttpError`                   |
| `ServiceUnavailableError`                | `DoclingServiceUnavailableError`     |
| `ResponseSchemaMismatchError`            | `DoclingResponseSchemaMismatchError` |
| `UsageLimitExceededError`                | `DoclingUsageLimitExceededError`     |
| `TaskExecutionError`                     | `DoclingTaskError`                   |
| `TaskTimeoutError`                       | `DoclingTimeoutError`                |
| `TaskNotFoundError`                      | `DoclingTaskNotFoundError`           |
| `ResultNotReadyError`                    | `DoclingResultNotReadyError`         |
| `ResultExpiredError`                     | `DoclingResultExpiredError`          |
| `ArtifactDownloadError`                  | `DoclingArtifactDownloadError`       |
| `ConversionError`                        | `DoclingConversionError`             |
| `BatchConversionError`                   | `DoclingBatchConversionError`        |

All service-originated TypeScript errors share `DoclingServiceError`, including
HTTP, availability, quota, and schema failures. Quota errors preserve the
service message, current usage, and limit.

Result lookup implements all Python branches:

- `"Task not found."` becomes task-not-found;
- missing result plus cached failure becomes authoritative task failure;
- missing result plus cached success becomes expired;
- missing result before a terminal state becomes not-ready;
- unexpected 404 detail remains a service error with status/detail;
- terminal task failure still fetches the result to recover structured failure
  information.

## Response and artifact validation

TypeScript validates the complete service boundary it consumes:

- task id/type/status, position, progress counts, and structured failure;
- converted document wrapper, status, errors, timings, confidence, and
  processing time;
- every chunk and per-document chunk result;
- every presigned count, document item, artifact type, MIME, URI, error, and
  timing;
- task-failure category, phase, retryability, and string details;
- health/version and binary metadata.

The exported `FailureCategory`, `DoclingComponentType`, `ProfilingScope`,
`QualityGrade`, and `ConfidenceScores` types mirror the corresponding Python
wire contracts; the public result types use those structured definitions
rather than unbounded strings or generic records.

Python Pydantic reconstructs and validates the complete version-pinned
`DoclingDocument`. TypeScript intentionally validates the document identity
(`schema_name` and `name`) at the client boundary and leaves the remaining
version-specific JSON generic. Applications can parameterize
`DoclingClient<TDocument>` with their installed
`@docling/docling-core` type. This avoids coupling the transport package to a
stale or mismatched core schema.

Presigned materialization otherwise matches Python and adds stricter checks:

- dedicated header-free artifact transport;
- public-address SSRF protection on every redirect;
- all DNS answers must be globally routable, rather than checking one answer;
- five redirect, timeout, and compressed-size limits;
- bounded streaming ZIP inflation, uncompressed-size and entry-count limits;
- path traversal rejection;
- exactly one top-level Docling JSON document;
- image MIME/signature validation before embedding.

## TypeScript-only capabilities

These are deliberately richer than the Python client:

- `AbortSignal` on submissions, polling, watching, result fetching, artifact
  download, and fan-out;
- injectable HTTP transport/fetch, WebSocket factory, artifact downloader,
  artifact fetch, DNS resolver, sleep function, and private-URL policy;
- public task attachment and raw JSON/binary result methods;
- full cached status objects and a public `wait()` method;
- browser `Blob`, `ArrayBuffer`, typed-array, and base64 sources;
- `AsyncIterable` fan-out;
- low-level Put target support;
- complete target-aware generic return types and typed auto-target unions;
- batch callbacks and output-format override;
- full chunk options, multi-source JSON chunking, callbacks, and
  `include_converted_doc`;
- stricter all-address artifact DNS validation and bounded bundle inflation;
- external-target binary submission that preserves coordinates by choosing the
  unified JSON route;
- a version-neutral document boundary that can be parameterized with any
  installed Docling Core schema.

## Deliberate language adaptations

These are implemented adaptations, not postponed features:

- There is no blocking TypeScript facade; all I/O returns Promises or async
  iterables.
- TypeScript `ConversionResult` carries a plain document JSON object, input
  descriptor, status, errors, timings, confidence, and processing time.
  Python additionally constructs a lightweight `InputDocument` and empty
  `AssembledUnit`, which are Python runtime classes with no meaningful
  JavaScript equivalent.
- On a failed/skipped result or missing JSON, TypeScript constructs a minimal
  `{schema_name: "DoclingDocument", name}` document, matching Python's
  non-null empty-document behavior.
- Fetch exposes a total attempt timeout rather than distinct socket phases.
- Node can enforce DNS-based artifact SSRF checks directly. Browser callers
  must inject a trusted resolver/policy because browser APIs intentionally hide
  DNS answers.
- The package uses camelCase for client control arguments and preserves
  snake_case for Serve wire models.
