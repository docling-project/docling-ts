import { Unzip, UnzipInflate } from 'fflate';
import ipaddr from 'ipaddr.js';

import { DoclingArtifactDownloadError } from './errors';
import type {
  ArtifactRef,
  ConversionInput,
  ConversionResult,
  DoclingDocument,
  DocumentArtifactItem,
  ErrorItem,
  PresignedUrlConvertResponse,
} from './types';

export type ArtifactAddressResolver = (hostname: string) => Promise<string[]>;

export interface ArtifactDownloaderOptions {
  fetch?: typeof globalThis.fetch;
  resolver?: ArtifactAddressResolver;
  allowPrivateUrls?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export class ArtifactDownloader {
  readonly #fetch: typeof globalThis.fetch;
  readonly #resolver: ArtifactAddressResolver;
  readonly #allowPrivateUrls: boolean;
  readonly #timeoutMs: number;
  readonly #maxBytes: number;
  readonly #maxRedirects: number;

  constructor(options: ArtifactDownloaderOptions = {}) {
    if (options.fetch === undefined && globalThis.fetch === undefined) {
      throw new DoclingArtifactDownloadError(
        'No fetch implementation is available for artifact downloads'
      );
    }
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#resolver = options.resolver ?? resolveAllAddresses;
    this.#allowPrivateUrls = options.allowPrivateUrls ?? false;
    this.#timeoutMs = options.timeoutMs ?? 60_000;
    this.#maxBytes = options.maxBytes ?? 512 * 1024 * 1024;
    this.#maxRedirects = options.maxRedirects ?? 5;
    validateArtifactLimits(this.#timeoutMs, this.#maxBytes, this.#maxRedirects);
  }

  async download(url: string, signal?: AbortSignal): Promise<Uint8Array> {
    let currentUrl = url;
    for (let redirects = 0; redirects <= this.#maxRedirects; redirects += 1) {
      await this.#validateUrl(currentUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(
          new DoclingArtifactDownloadError(
            `Artifact download exceeded ${this.#timeoutMs} ms`
          )
        );
      }, this.#timeoutMs);
      const combinedSignal = combineAbortSignals(signal, controller.signal);

      try {
        const response = await this.#fetch(currentUrl, {
          redirect: 'manual',
          signal: combinedSignal,
        });
        if (isRedirect(response.status)) {
          if (redirects >= this.#maxRedirects) {
            throw new DoclingArtifactDownloadError(
              `Artifact download exceeded ${this.#maxRedirects} redirects`
            );
          }
          const location = response.headers.get('location');
          if (location === null || location === '') {
            throw new DoclingArtifactDownloadError(
              'Artifact redirect response is missing Location'
            );
          }
          currentUrl = new URL(location, currentUrl).toString();
          await response.body?.cancel();
          continue;
        }
        if (response.status !== 200) {
          throw new DoclingArtifactDownloadError(
            `Artifact download returned HTTP ${response.status}`
          );
        }
        return await readBoundedBody(response, this.#maxBytes, combinedSignal);
      } catch (error) {
        if (signal?.aborted === true) {
          throw signal.reason;
        }
        if (error instanceof DoclingArtifactDownloadError) {
          throw error;
        }
        throw new DoclingArtifactDownloadError(
          `Artifact download failed for ${currentUrl}`,
          { cause: error }
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new DoclingArtifactDownloadError('Artifact redirect loop did not terminate');
  }

  async #validateUrl(value: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(value);
    } catch (error) {
      throw new DoclingArtifactDownloadError('Artifact URL is invalid', {
        cause: error,
      });
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') {
      throw new DoclingArtifactDownloadError(
        'Artifact URL must be an absolute HTTP(S) URL'
      );
    }
    if (this.#allowPrivateUrls) {
      return;
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    try {
      addresses = ipaddr.isValid(hostname)
        ? [hostname]
        : await this.#resolver(hostname);
    } catch (error) {
      throw new DoclingArtifactDownloadError(
        `Could not resolve artifact host ${hostname}`,
        { cause: error }
      );
    }
    if (
      addresses.length === 0 ||
      addresses.some(address => !isGlobalAddress(address))
    ) {
      throw new DoclingArtifactDownloadError(
        `Artifact URL does not resolve exclusively to globally routable addresses: ${url.hostname}`
      );
    }
  }
}

export async function materializePresignedResult<TDocument = DoclingDocument>(
  response: PresignedUrlConvertResponse,
  input: ConversionInput,
  downloader: ArtifactDownloader,
  signal?: AbortSignal
): Promise<ConversionResult<TDocument>> {
  const item = response.documents[0];
  if (item === undefined) {
    return failedConversion(
      input,
      response.processing_time,
      'Presigned result contained no documents'
    );
  }
  if (item.status === 'failure') {
    return conversionFromArtifactItem<TDocument>(
      item,
      input,
      response.processing_time,
      emptyDocument<TDocument>(item.filename || input.filename)
    );
  }

  try {
    const artifact = selectDocumentArtifact(item);
    const bytes = await downloader.download(artifact.uri, signal);
    const document =
      artifact.artifact_type === 'resource_bundle'
        ? documentFromBundle<TDocument>(bytes)
        : documentFromJson<TDocument>(bytes);
    return conversionFromArtifactItem(item, input, response.processing_time, document);
  } catch (error) {
    if (signal?.aborted === true || isAbortError(error)) {
      throw signal?.reason ?? error;
    }
    const message =
      error instanceof DoclingArtifactDownloadError
        ? error.message
        : `Failed to reconstruct document from presigned artifacts: ${
            error instanceof Error ? error.message : String(error)
          }`;
    return failedConversion(input, response.processing_time, message);
  }
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}

export function selectDocumentArtifact(item: DocumentArtifactItem): ArtifactRef {
  const bundle = item.artifacts.find(
    artifact => artifact.artifact_type === 'resource_bundle'
  );
  if (bundle !== undefined) {
    return bundle;
  }
  const json = item.artifacts.find(artifact => artifact.artifact_type === 'json');
  if (json !== undefined) {
    return json;
  }
  throw new DoclingArtifactDownloadError(
    "Presigned result exposes neither a 'json' nor a 'resource_bundle' artifact"
  );
}

export function documentFromBundle<TDocument>(bytes: Uint8Array): TDocument {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipBundle(bytes);
  } catch (error) {
    if (error instanceof DoclingArtifactDownloadError) {
      throw error;
    }
    throw new DoclingArtifactDownloadError(
      'Downloaded resource bundle is not a valid ZIP',
      { cause: error }
    );
  }
  for (const name of Object.keys(entries)) {
    validateBundlePath(name);
  }
  const jsonNames = Object.keys(entries)
    .filter(name => !name.includes('/') && name.toLowerCase().endsWith('.json'))
    .sort();
  if (jsonNames.length !== 1) {
    throw new DoclingArtifactDownloadError(
      `Resource bundle must contain exactly one top-level JSON document; found ${jsonNames.length}`
    );
  }
  const jsonName = jsonNames[0] as string;
  const jsonBytes = entries[jsonName];
  if (jsonBytes === undefined) {
    throw new DoclingArtifactDownloadError('Resource bundle JSON is missing');
  }
  const document = documentFromJson<TDocument>(jsonBytes);
  embedBundleImages(document, entries);
  return document;
}

export function documentFromJson<TDocument>(bytes: Uint8Array): TDocument {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    throw new DoclingArtifactDownloadError(
      'Downloaded artifact is not valid Docling JSON',
      { cause: error }
    );
  }
  if (
    !isRecord(value) ||
    value.schema_name !== 'DoclingDocument' ||
    typeof value.name !== 'string'
  ) {
    throw new DoclingArtifactDownloadError(
      'Downloaded artifact is not a DoclingDocument'
    );
  }
  return value as TDocument;
}

function conversionFromArtifactItem<TDocument>(
  item: DocumentArtifactItem,
  fallbackInput: ConversionInput,
  processingTime: number,
  document: TDocument
): ConversionResult<TDocument> {
  return {
    input: {
      ...fallbackInput,
      filename: item.filename || fallbackInput.filename,
      source: item.source_uri || fallbackInput.source,
    },
    document,
    status: item.status,
    errors: item.errors,
    processing_time: processingTime,
    timings: item.timings,
    ...(item.confidence === undefined ? {} : { confidence: item.confidence }),
  };
}

function failedConversion<TDocument>(
  input: ConversionInput,
  processingTime: number,
  message: string
): ConversionResult<TDocument> {
  const error: ErrorItem = {
    component_type: 'user_input',
    module_name: '@docling/docling-client',
    error_message: message,
    category: 'unknown',
  };
  return {
    input,
    document: emptyDocument<TDocument>(input.filename),
    status: 'failure',
    errors: [error],
    processing_time: processingTime,
    timings: {},
  };
}

function emptyDocument<TDocument>(filename: string): TDocument {
  const leaf = filename.replaceAll('\\', '/').split('/').at(-1) ?? filename;
  const extension = leaf.lastIndexOf('.');
  const name = extension > 0 ? leaf.slice(0, extension) : leaf;
  return {
    schema_name: 'DoclingDocument',
    name: name || 'document',
  } as TDocument;
}

function embedBundleImages(
  document: unknown,
  entries: Readonly<Record<string, Uint8Array>>
): void {
  if (!isRecord(document)) {
    return;
  }
  if (Array.isArray(document.pictures)) {
    for (const picture of document.pictures) {
      if (isRecord(picture) && isRecord(picture.image)) {
        embedImageRef(picture.image, entries);
      }
    }
  }
  if (isRecord(document.pages)) {
    for (const page of Object.values(document.pages)) {
      if (isRecord(page) && isRecord(page.image)) {
        embedImageRef(page.image, entries);
      }
    }
  }
}

function embedImageRef(
  value: Record<string, unknown>,
  entries: Readonly<Record<string, Uint8Array>>
): void {
  if (!isImageRef(value)) {
    throw new DoclingArtifactDownloadError(
      'Resource bundle contains an invalid image reference'
    );
  }
  const uri = value.uri;
  if (
    uri.startsWith('data:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return;
  }
  const path = normalizeBundleReference(uri);
  const content = entries[path];
  if (content === undefined) {
    throw new DoclingArtifactDownloadError(`Resource bundle image is missing: ${uri}`);
  }
  if (!isSupportedImage(value.mimetype, content)) {
    throw new DoclingArtifactDownloadError(
      `Resource bundle image bytes do not match ${value.mimetype}`
    );
  }
  value.uri = `data:${value.mimetype};base64,${bytesToBase64(content)}`;
}

function validateBundlePath(value: string): void {
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split('/').some(part => part === '..')
  ) {
    throw new DoclingArtifactDownloadError(
      `Resource bundle contains an unsafe path: ${value}`
    );
  }
}

function normalizeBundleReference(value: string): string {
  validateBundlePath(value);
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isImageRef(value: Record<string, unknown>): value is Record<
  string,
  unknown
> & {
  mimetype: string;
  dpi: number;
  uri: string;
} {
  return (
    typeof value.mimetype === 'string' &&
    typeof value.dpi === 'number' &&
    typeof value.uri === 'string'
  );
}

function isSupportedImage(mimeType: string, bytes: Uint8Array): boolean {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/png') {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mime === 'image/jpeg') {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mime === 'image/gif') {
    return new TextDecoder().decode(bytes.subarray(0, 6)).startsWith('GIF8');
  }
  if (mime === 'image/webp') {
    return (
      new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
    );
  }
  if (mime === 'image/bmp') {
    return startsWith(bytes, [0x42, 0x4d]);
  }
  if (mime === 'image/tiff') {
    return (
      startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
      startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
    );
  }
  return false;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return (
    bytes.length >= prefix.length &&
    prefix.every((value, index) => bytes[index] === value)
  );
}

function unzipBundle(bytes: Uint8Array): Record<string, Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  const maxEntries = 10_000;
  const maxUncompressedBytes = 512 * 1024 * 1024;
  let entryCount = 0;
  let total = 0;
  const archive = new Unzip(file => {
    entryCount += 1;
    if (entryCount > maxEntries) {
      throw new DoclingArtifactDownloadError(
        `Resource bundle exceeds ${maxEntries} entries`
      );
    }
    validateBundlePath(file.name);
    const chunks: Uint8Array[] = [];
    file.ondata = (error, chunk, final) => {
      if (error !== null) {
        throw error;
      }
      total += chunk.byteLength;
      if (total > maxUncompressedBytes) {
        throw new DoclingArtifactDownloadError(
          `Resource bundle exceeds ${maxUncompressedBytes} uncompressed bytes`
        );
      }
      chunks.push(chunk);
      if (final) {
        const content = new Uint8Array(
          chunks.reduce((sum, value) => sum + value.byteLength, 0)
        );
        let offset = 0;
        for (const value of chunks) {
          content.set(value, offset);
          offset += value.byteLength;
        }
        entries[file.name] = content;
      }
    };
    file.start();
  });
  archive.register(UnzipInflate);
  archive.push(bytes, true);
  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  if (response.body === null) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal?.aborted === true) {
        throw signal.reason;
      }
      const next = await reader.read();
      if (next.done) {
        break;
      }
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new DoclingArtifactDownloadError(
          `Artifact exceeds the ${maxBytes} byte download limit`
        );
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function resolveAllAddresses(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(item => item.address);
}

function isGlobalAddress(value: string): boolean {
  if (!ipaddr.isValid(value)) {
    return false;
  }
  const address = ipaddr.parse(value);
  if (address.kind() === 'ipv6') {
    const ipv6 = address as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) {
      return ipv6.toIPv4Address().range() === 'unicast';
    }
  }
  return address.range() === 'unicast';
}

function validateArtifactLimits(
  timeoutMs: number,
  maxBytes: number,
  maxRedirects: number
): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new DoclingArtifactDownloadError('Artifact timeout must be positive');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new DoclingArtifactDownloadError(
      'Artifact size limit must be a non-negative safe integer'
    );
  }
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new DoclingArtifactDownloadError(
      'Artifact redirect limit must be a non-negative safe integer'
    );
  }
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal
): AbortSignal {
  if (callerSignal === undefined) {
    return timeoutSignal;
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([callerSignal, timeoutSignal]);
  }
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  if (callerSignal.aborted) {
    abort(callerSignal);
  } else {
    callerSignal.addEventListener('abort', () => abort(callerSignal), {
      once: true,
    });
  }
  timeoutSignal.addEventListener('abort', () => abort(timeoutSignal), {
    once: true,
  });
  return controller.signal;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}
