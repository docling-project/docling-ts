import { describe, expect, it, vi } from 'vitest';

import {
  DoclingHttpError,
  DoclingServiceError,
  DoclingServiceUnavailableError,
  FetchTransport,
  type DoclingBinaryResponse,
} from '../src';

const REQUEST = {
  method: 'POST' as const,
  url: 'https://docling.example.test/v1/convert/source/async',
  headers: { 'content-type': 'application/json' },
  body: {},
};

describe('FetchTransport retry policy', () => {
  it('retries 500/502 responses for POST with exponential backoff', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'one' }, 500))
      .mockResolvedValueOnce(jsonResponse({ detail: 'two' }, 502))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const delays: number[] = [];
    const transport = new FetchTransport({
      fetch: fetchImplementation,
      retries: 3,
      backoffBaseMs: 1_000,
      sleep: async milliseconds => {
        delays.push(milliseconds);
      },
    });

    await expect(transport.request(REQUEST)).resolves.toEqual({ ok: true });
    expect(delays).toEqual([1_000, 2_000]);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });

  it('honors Retry-After only when it is valid', async () => {
    const retriedFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'busy' }, 503, { 'retry-after': '1.5' })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const delays: number[] = [];
    const retried = new FetchTransport({
      fetch: retriedFetch,
      sleep: async milliseconds => {
        delays.push(milliseconds);
      },
    });

    await retried.request(REQUEST);
    expect(delays).toEqual([1_500]);
    expect(retriedFetch).toHaveBeenCalledTimes(2);

    const notRetriedFetch = vi.fn(async () => jsonResponse({ detail: 'busy' }, 503));
    const notRetried = new FetchTransport({
      fetch: notRetriedFetch,
      sleep: async () => undefined,
    });
    await expect(notRetried.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      status: 503,
      detail: 'busy',
    });
    expect(notRetriedFetch).toHaveBeenCalledTimes(1);
  });

  it('preserves exhausted retry detail and ignores blank Retry-After', async () => {
    const exhausted = new FetchTransport({
      fetch: async () => jsonResponse({ detail: 'still broken' }, 500),
      retries: 1,
      sleep: async () => undefined,
    });
    await expect(exhausted.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      status: 500,
      detail: 'still broken',
    });

    const blank = vi.fn(async () =>
      jsonResponse({ detail: 'slow down' }, 429, { 'retry-after': '   ' })
    );
    await expect(
      new FetchTransport({ fetch: blank }).request(REQUEST)
    ).rejects.toMatchObject({ status: 429 });
    expect(blank).toHaveBeenCalledTimes(1);

    const exhaustedRateLimit = new FetchTransport({
      fetch: async () =>
        jsonResponse({ detail: 'rate limit remains exhausted' }, 429, {
          'retry-after': '0',
        }),
      retries: 1,
      sleep: async () => undefined,
    });
    await expect(exhaustedRateLimit.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      status: 429,
      detail: 'rate limit remains exhausted',
    });
  });

  it('does not call sleep for a zero Retry-After delay', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'busy' }, 503, { 'retry-after': '0' })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    await new FetchTransport({ fetch: fetchImplementation, sleep }).request(REQUEST);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries network failures only for idempotent methods', async () => {
    const getFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('socket closed'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const getTransport = new FetchTransport({
      fetch: getFetch,
      backoffBaseMs: 1,
      sleep: async () => undefined,
    });
    await expect(
      getTransport.request({
        ...REQUEST,
        method: 'GET',
        body: undefined,
      })
    ).resolves.toEqual({ ok: true });
    expect(getFetch).toHaveBeenCalledTimes(2);

    const postFetch = vi.fn(async () => {
      throw new TypeError('socket closed');
    });
    const postTransport = new FetchTransport({
      fetch: postFetch,
      sleep: async () => undefined,
    });
    await expect(postTransport.request(REQUEST)).rejects.toBeInstanceOf(
      DoclingServiceUnavailableError
    );
    expect(postFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a caller abort', async () => {
    const fetchImplementation = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      }
    );
    const transport = new FetchTransport({
      fetch: fetchImplementation,
      sleep: async () => undefined,
    });
    const controller = new AbortController();
    const request = transport.request({
      ...REQUEST,
      method: 'GET',
      signal: controller.signal,
    });
    const reason = new Error('caller cancelled');
    controller.abort(reason);

    await expect(request).rejects.toBe(reason);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});

describe('FetchTransport response handling', () => {
  it('maps valid and malformed quota responses to the quota error', async () => {
    const valid = new FetchTransport(async () =>
      jsonResponse(
        {
          error: 'usage_limit_exceeded',
          message: 'quota exhausted',
          details: { currentUsage: 10, limit: 10 },
        },
        402
      )
    );
    await expect(valid.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingUsageLimitExceededError',
      currentUsage: 10,
      limit: 10,
      detail: 'quota exhausted',
    });

    const malformed = new FetchTransport(async () =>
      jsonResponse({ detail: 'payment required' }, 402)
    );
    await expect(malformed.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingUsageLimitExceededError',
      currentUsage: null,
      limit: null,
      detail: null,
    });
  });

  it('decodes non-200 JSON independently of Content-Type', async () => {
    const detail = new FetchTransport(
      async () =>
        new Response(JSON.stringify({ detail: 'invalid options' }), {
          status: 422,
        })
    );
    await expect(detail.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingHttpError',
      status: 422,
      detail: 'invalid options',
    });

    const quota = new FetchTransport(
      async () =>
        new Response(
          JSON.stringify({
            error: 'usage_limit_exceeded',
            message: 'quota exhausted',
            details: { currentUsage: 10, limit: 10 },
          }),
          { status: 402 }
        )
    );
    await expect(quota.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingUsageLimitExceededError',
      status: 402,
      detail: 'quota exhausted',
      currentUsage: 10,
      limit: 10,
    });
  });

  it('preserves HTTP classification when an error body contains malformed JSON', async () => {
    const malformedJson = (status: number, headers: Record<string, string> = {}) =>
      new Response('{not-json', {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      });

    await expect(
      new FetchTransport(async () => malformedJson(422)).request(REQUEST)
    ).rejects.toMatchObject({
      name: 'DoclingHttpError',
      status: 422,
      detail: null,
    });
    await expect(
      new FetchTransport(async () => malformedJson(402)).request(REQUEST)
    ).rejects.toMatchObject({
      name: 'DoclingUsageLimitExceededError',
      status: 402,
      detail: null,
      currentUsage: null,
      limit: null,
    });
    await expect(
      new FetchTransport({
        fetch: async () => malformedJson(500),
        retries: 0,
      }).request(REQUEST)
    ).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      status: 500,
      detail: null,
    });
    await expect(
      new FetchTransport({
        fetch: async () => malformedJson(429, { 'retry-after': '0' }),
        retries: 0,
      }).request(REQUEST)
    ).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      status: 429,
      detail: null,
    });
  });

  it('uses one service-error hierarchy and requires exact HTTP 200', async () => {
    const transport = new FetchTransport(async () =>
      jsonResponse({ accepted: true }, 202)
    );
    const error = await transport.request(REQUEST).catch(value => value);
    expect(error).toBeInstanceOf(DoclingHttpError);
    expect(error).toBeInstanceOf(DoclingServiceError);
    expect(error).toMatchObject({ status: 202 });
  });

  it('preserves response headers on HTTP errors', async () => {
    const transport = new FetchTransport(async () =>
      jsonResponse({ detail: 'invalid options' }, 422, { 'x-request-id': 'request-1' })
    );

    const error = await transport.request(REQUEST).catch(value => value);
    expect(error).toBeInstanceOf(DoclingHttpError);
    expect(error).toMatchObject({
      status: 422,
      detail: 'invalid options',
      headers: { 'x-request-id': 'request-1' },
    });
  });

  it('preserves status for empty HTTP error bodies', async () => {
    const transport = new FetchTransport(
      async () => new Response(null, { status: 404 })
    );
    await expect(transport.request(REQUEST)).rejects.toMatchObject({
      name: 'DoclingHttpError',
      status: 404,
      detail: null,
    });
  });

  it('returns binary data without text decoding', async () => {
    const transport = new FetchTransport(
      async () =>
        new Response(new Uint8Array([0, 255, 128, 80, 75]), {
          status: 200,
          headers: {
            'content-type': 'application/zip',
            'content-disposition': 'attachment; filename="result.zip"',
          },
        })
    );

    const response = await transport.request<DoclingBinaryResponse>({
      ...REQUEST,
      method: 'GET',
      body: undefined,
      responseType: 'bytes',
    });

    expect([...response.content]).toEqual([0, 255, 128, 80, 75]);
    expect(response.contentType).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('result.zip');
  });

  it('retries client-owned GET timeouts but not timed-out POST submissions', async () => {
    const hangingFetch = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const transport = new FetchTransport({
      fetch: hangingFetch,
      retries: 1,
      timeoutMs: 2,
      backoffBaseMs: 1,
      sleep: async () => undefined,
    });

    await expect(
      transport.request({
        ...REQUEST,
        method: 'GET',
        body: undefined,
      })
    ).rejects.toBeInstanceOf(DoclingServiceUnavailableError);
    expect(hangingFetch).toHaveBeenCalledTimes(2);

    hangingFetch.mockClear();
    await expect(transport.request(REQUEST)).rejects.toBeInstanceOf(
      DoclingServiceUnavailableError
    );
    expect(hangingFetch).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}
