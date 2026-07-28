import {
  DoclingHttpError,
  DoclingProtocolError,
  DoclingServiceUnavailableError,
  DoclingUsageLimitExceededError,
} from './errors';

export type DoclingResponseType = 'json' | 'text' | 'bytes' | 'auto';
export type DoclingRequestBodyType = 'json' | 'form' | 'raw';

export interface DoclingTransportRequest {
  method: 'GET' | 'HEAD' | 'OPTIONS' | 'POST';
  url: string;
  headers: Readonly<Record<string, string>>;
  body?: unknown;
  bodyType?: DoclingRequestBodyType;
  responseType?: DoclingResponseType;
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface DoclingBinaryResponse {
  content: Uint8Array;
  headers: Readonly<Record<string, string>>;
  contentType: string;
}

export interface DoclingTransport {
  request<T>(request: DoclingTransportRequest): Promise<T>;
  close?(): void | Promise<void>;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface FetchTransportOptions {
  fetch?: FetchLike;
  retries?: number;
  timeoutMs?: number;
  backoffBaseMs?: number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export class FetchTransport implements DoclingTransport {
  readonly #fetch: FetchLike;
  readonly #retries: number;
  readonly #timeoutMs: number;
  readonly #backoffBaseMs: number;
  readonly #sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;

  constructor(
    optionsOrFetch: FetchTransportOptions | FetchLike | undefined = globalThis.fetch
  ) {
    const options =
      typeof optionsOrFetch === 'function' ? { fetch: optionsOrFetch } : optionsOrFetch;
    const fetchImplementation = options?.fetch ?? globalThis.fetch;
    if (fetchImplementation === undefined) {
      throw new DoclingProtocolError(
        'No fetch implementation is available; provide a DoclingTransport'
      );
    }
    this.#fetch = fetchImplementation;
    this.#retries = validateNonNegativeInteger(options?.retries ?? 3, 'retries');
    this.#timeoutMs = validatePositiveNumber(options?.timeoutMs ?? 60_000, 'timeoutMs');
    this.#backoffBaseMs = validatePositiveNumber(
      options?.backoffBaseMs ?? 1_000,
      'backoffBaseMs'
    );
    this.#sleep = options?.sleep ?? abortableDelay;
  }

  async request<T>(request: DoclingTransportRequest): Promise<T> {
    const maxRetries =
      request.retries === undefined
        ? this.#retries
        : validateNonNegativeInteger(request.retries, 'request.retries');

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await this.#requestOnce(request);
        const retryDelay = retryDelayMs(
          response,
          attempt,
          maxRetries,
          this.#backoffBaseMs
        );
        if (retryDelay === 'exhausted') {
          const body = await decodeErrorResponse(response);
          throw new DoclingServiceUnavailableError(
            `Docling returned HTTP ${response.status} after retries`,
            {
              status: response.status,
              detail: httpDetail(body),
            }
          );
        }
        if (retryDelay !== null) {
          await discardResponse(response);
          if (retryDelay > 0) {
            await this.#sleep(retryDelay, request.signal);
          }
          continue;
        }

        const responseHeaders = headersToRecord(response.headers);
        if (response.status !== 200) {
          const body = await decodeErrorResponse(response);
          if (response.status === 402) {
            const usage = isUsageLimitBody(body) ? body : undefined;
            throw new DoclingUsageLimitExceededError({
              method: request.method,
              url: request.url,
              status: response.status,
              body,
              headers: responseHeaders,
              ...(usage === undefined
                ? {}
                : {
                    currentUsage: usage.details.currentUsage,
                    limit: usage.details.limit,
                    detail: usage.message,
                  }),
            });
          }
          if (response.status >= 500) {
            throw new DoclingServiceUnavailableError(
              `Docling returned HTTP ${response.status}`,
              {
                status: response.status,
                detail: httpDetail(body),
              }
            );
          }
          throw new DoclingHttpError({
            method: request.method,
            url: request.url,
            status: response.status,
            body,
            headers: responseHeaders,
            detail: httpDetail(body),
          });
        }

        return (await decodeResponse(response, request.responseType ?? 'json')) as T;
      } catch (error) {
        if (
          error instanceof DoclingHttpError ||
          error instanceof DoclingProtocolError ||
          error instanceof DoclingServiceUnavailableError ||
          error instanceof DoclingUsageLimitExceededError ||
          isAbort(error, request.signal)
        ) {
          throw error;
        }
        const retryableMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
        if (retryableMethod && attempt < maxRetries) {
          await this.#sleep(this.#backoffBaseMs * 2 ** attempt, request.signal);
          continue;
        }
        throw new DoclingServiceUnavailableError(
          attempt >= maxRetries && retryableMethod
            ? 'Docling transport request failed after retries'
            : 'Docling transport request failed',
          {
            detail: error instanceof Error ? error.message : String(error),
            cause: error,
          }
        );
      }
    }

    throw new DoclingServiceUnavailableError(
      'Docling request failed after the retry loop'
    );
  }

  async #requestOnce(request: DoclingTransportRequest): Promise<Response> {
    const timeoutMs = request.timeoutMs ?? this.#timeoutMs;
    validatePositiveNumber(timeoutMs, 'request.timeoutMs');
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
      timeoutController.abort(
        new DoclingServiceUnavailableError(
          `Docling request exceeded its ${timeoutMs} ms transport timeout`
        )
      );
    }, timeoutMs);
    const combined = combineAbortSignals(request.signal, timeoutController.signal);

    try {
      try {
        return await this.#fetch(request.url, {
          method: request.method,
          headers: request.headers,
          ...(request.body === undefined
            ? {}
            : { body: encodeBody(request.body, request.bodyType ?? 'json') }),
          signal: combined.signal,
        });
      } catch (error) {
        if (timeoutController.signal.aborted && request.signal?.aborted !== true) {
          throw new TransportTimeoutError(
            `Docling request exceeded its ${timeoutMs} ms transport timeout`,
            { cause: error }
          );
        }
        throw error;
      }
    } finally {
      clearTimeout(timeout);
      combined.dispose();
    }
  }
}

function encodeBody(body: unknown, bodyType: DoclingRequestBodyType): BodyInit {
  if (bodyType === 'json') {
    return JSON.stringify(body);
  }
  if (bodyType === 'form') {
    if (!(body instanceof FormData)) {
      throw new DoclingProtocolError('A form request body must be FormData');
    }
    return body;
  }
  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof URLSearchParams
  ) {
    return body as BodyInit;
  }
  throw new DoclingProtocolError('Unsupported raw transport request body');
}

async function decodeResponse(
  response: Response,
  responseType: DoclingResponseType
): Promise<unknown> {
  if (responseType === 'bytes') {
    return {
      content: new Uint8Array(await response.arrayBuffer()),
      headers: headersToRecord(response.headers),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    } satisfies DoclingBinaryResponse;
  }
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (text === '') {
    return undefined;
  }
  if (responseType === 'text') {
    return text;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const shouldDecodeJson =
    responseType === 'json' || contentType.toLowerCase().includes('json');
  if (!shouldDecodeJson) {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DoclingProtocolError('Docling returned invalid JSON', {
      cause: error,
    });
  }
}

async function decodeErrorResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function retryDelayMs(
  response: Response,
  attempt: number,
  maxRetries: number,
  backoffBaseMs: number
): number | 'exhausted' | null {
  if ([500, 502].includes(response.status)) {
    return attempt < maxRetries ? backoffBaseMs * 2 ** attempt : 'exhausted';
  }
  if ([429, 503].includes(response.status)) {
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    if (retryAfter === null) {
      return null;
    }
    return attempt < maxRetries ? retryAfter : 'exhausted';
  }
  return null;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const normalized = value.trim();
  if (normalized === '') {
    return null;
  }
  const seconds = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)
    ? Number(normalized)
    : Number.NaN;
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) {
    return null;
  }
  return Math.max(0, retryAt - Date.now());
}

function isUsageLimitBody(value: unknown): value is {
  error: 'usage_limit_exceeded';
  message: string;
  details: { currentUsage: number; limit: number };
} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (
    body.error !== 'usage_limit_exceeded' ||
    typeof body.message !== 'string' ||
    body.details === null ||
    typeof body.details !== 'object' ||
    Array.isArray(body.details)
  ) {
    return false;
  }
  const details = body.details as Record<string, unknown>;
  return typeof details.currentUsage === 'number' && typeof details.limit === 'number';
}

function httpDetail(value: unknown): string | undefined {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).detail === 'string'
    ? ((value as Record<string, unknown>).detail as string)
    : undefined;
}

function headersToRecord(headers: Headers): Readonly<Record<string, string>> {
  return Object.fromEntries(headers.entries());
}

function validateNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DoclingProtocolError(`${name} must be a non-negative integer`);
  }
  return value;
}

function validatePositiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DoclingProtocolError(`${name} must be a positive number`);
  }
  return value;
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal
): { signal: AbortSignal; dispose: () => void } {
  if (callerSignal === undefined) {
    return { signal: timeoutSignal, dispose: () => undefined };
  }
  if (typeof AbortSignal.any === 'function') {
    return {
      signal: AbortSignal.any([callerSignal, timeoutSignal]),
      dispose: () => undefined,
    };
  }
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    controller.abort(signal.reason);
  };
  if (callerSignal.aborted) {
    abort(callerSignal);
  } else if (timeoutSignal.aborted) {
    abort(timeoutSignal);
  } else {
    const abortCaller = () => abort(callerSignal);
    const abortTimeout = () => abort(timeoutSignal);
    callerSignal.addEventListener('abort', abortCaller, { once: true });
    timeoutSignal.addEventListener('abort', abortTimeout, { once: true });
    return {
      signal: controller.signal,
      dispose: () => {
        callerSignal.removeEventListener('abort', abortCaller);
        timeoutSignal.removeEventListener('abort', abortTimeout);
      },
    };
  }
  return { signal: controller.signal, dispose: () => undefined };
}

async function discardResponse(response: Response): Promise<void> {
  try {
    if (response.body !== null) {
      await response.body.cancel();
    }
  } catch {
    // Best-effort cleanup before retrying.
  }
}

function isAbort(error: unknown, signal: AbortSignal | undefined): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }
  if (signal?.aborted === true) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

class TransportTimeoutError extends Error {}
