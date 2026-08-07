import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ArtifactDownloader,
  DoclingClient,
  DoclingConversionError,
  DoclingHttpError,
  DoclingProtocolError,
  DoclingResponseSchemaMismatchError,
  DoclingResultExpiredError,
  DoclingResultNotReadyError,
  DoclingServiceError,
  DoclingTaskError,
  DoclingTaskNotFoundError,
  type DoclingBinaryResponse,
  type DoclingTransport,
  type DoclingTransportRequest,
  type SubmitTarget,
  type TaskStatusResponse,
} from '../src';

class ScriptedTransport implements DoclingTransport {
  readonly requests: DoclingTransportRequest[] = [];
  readonly #responses: unknown[];

  constructor(...responses: unknown[]) {
    this.#responses = responses;
  }

  async request<T>(request: DoclingTransportRequest): Promise<T> {
    this.requests.push(request);
    if (this.#responses.length === 0) {
      throw new Error('No scripted response remains');
    }
    const response = this.#responses.shift();
    if (response instanceof Error) {
      throw response;
    }
    return response as T;
  }
}

class FunctionTransport implements DoclingTransport {
  readonly requests: DoclingTransportRequest[] = [];
  readonly #handler: (request: DoclingTransportRequest) => Promise<unknown>;

  constructor(
    handler: (request: DoclingTransportRequest) => Promise<unknown> | unknown
  ) {
    this.#handler = async request => handler(request);
  }

  async request<T>(request: DoclingTransportRequest): Promise<T> {
    this.requests.push(request);
    return (await this.#handler(request)) as T;
  }
}

function task(
  taskId: string,
  taskStatus: TaskStatusResponse['task_status'],
  taskType: TaskStatusResponse['task_type'] = 'convert',
  extra: Partial<TaskStatusResponse> = {}
): TaskStatusResponse {
  return {
    task_id: taskId,
    task_type: taskType,
    task_status: taskStatus,
    ...extra,
  };
}

function documentResponse(
  filename: string,
  text = '# Manual'
): Record<string, unknown> {
  return {
    status: 'success',
    processing_time: 1.25,
    timings: {},
    errors: [],
    document: {
      filename,
      md_content: text,
      json_content: {
        schema_name: 'DoclingDocument',
        name: filename.replace(/\.pdf$/i, ''),
      },
    },
  };
}

function clientWith(
  transport: DoclingTransport,
  options: Partial<ConstructorParameters<typeof DoclingClient>[0]> = {}
): DoclingClient<Record<string, unknown>> {
  return new DoclingClient<Record<string, unknown>>({
    baseUrl: 'https://docling.example.test',
    statusWatcher: 'polling',
    transport,
    ...options,
  });
}

describe('conversion submission and targets', () => {
  it('keeps source-fetch headers separate from service request headers', async () => {
    const transport = new ScriptedTransport(task('convert-1', 'pending'));
    const client = clientWith(transport, {
      apiKey: 'base-key',
      headers: { 'X-Request-Id': 'request-1' },
    });

    const job = await client.submitUrl(
      'https://files.example.test/manual.pdf',
      {
        to_formats: ['md'],
        do_ocr: true,
      },
      {
        target: { kind: 'inbody' },
        sourceHeaders: { authorization: 'Bearer source-token' },
        headers: {
          authorization: 'Bearer service-token',
          'x-api-key': 'override-key',
        },
      }
    );

    expect(job.taskId).toBe('convert-1');
    expect(transport.requests).toEqual([
      {
        method: 'POST',
        url: 'https://docling.example.test/v1/convert/source/async',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: 'Bearer service-token',
          'x-api-key': 'override-key',
          'x-request-id': 'request-1',
        },
        body: {
          options: {
            to_formats: ['md', 'json'],
            do_ocr: true,
          },
          sources: [
            {
              kind: 'http',
              url: 'https://files.example.test/manual.pdf',
              headers: { authorization: 'Bearer source-token' },
            },
          ],
          target: { kind: 'inbody' },
          callbacks: [],
        },
      },
    ]);
  });

  it('tries presigned output by default and narrowly falls back to in-body', async () => {
    const transport = new ScriptedTransport(
      new DoclingHttpError({
        method: 'POST',
        url: 'https://docling.example.test/v1/convert/source/async',
        status: 422,
        body: {
          detail:
            "validation error: target.kind input should be 'inbody', not presigned_url",
        },
      }),
      task('fallback-1', 'pending')
    );
    const client = clientWith(transport);

    await client.submitUrl('https://files.example.test/manual.pdf');

    expect(
      transport.requests.map(
        request => (request.body as { target: { kind: string } }).target.kind
      )
    ).toEqual(['presigned_url', 'inbody']);
    expect(
      (
        transport.requests[1]?.body as {
          options: { to_formats: string[] };
        }
      ).options.to_formats
    ).toContain('json');
  });

  it('does not hide unrelated presigned-target submission errors', async () => {
    const error = new DoclingHttpError({
      method: 'POST',
      url: 'https://docling.example.test/v1/convert/source/async',
      status: 422,
      body: { detail: 'invalid OCR configuration' },
    });
    const transport = new ScriptedTransport(error);
    const client = clientWith(transport);

    await expect(
      client.submitUrl('https://files.example.test/manual.pdf')
    ).rejects.toBe(error);
    expect(transport.requests).toHaveLength(1);
  });

  it('decodes in-body, ZIP, presigned, and storage-target results by target', async () => {
    const binary: DoclingBinaryResponse = {
      content: new Uint8Array([0, 255, 80, 75]),
      contentType: 'application/zip',
      headers: {
        'content-disposition': 'attachment; filename="converted_docs.zip"',
      },
    };
    const presigned = {
      num_converted: 1,
      num_succeeded: 1,
      num_partially_succeeded: 0,
      num_failed: 0,
      processing_time: 2,
      documents: [],
    };
    const counts = {
      num_converted: 5,
      num_succeeded: 5,
      num_partially_succeeded: 0,
      num_failed: 0,
      processing_time: 4,
    };
    const transport = new ScriptedTransport(
      task('inline', 'success'),
      documentResponse('inline.pdf'),
      task('zip', 'success'),
      binary,
      task('presigned', 'success'),
      presigned,
      task('storage', 'success'),
      counts
    );
    const client = clientWith(transport);

    const inline = await (
      await client.submitUrl(
        'https://example.test/inline.pdf',
        {},
        {
          target: { kind: 'inbody' },
        }
      )
    ).result();
    const archive = await (
      await client.submitUrl(
        'https://example.test/archive.pdf',
        {},
        {
          target: { kind: 'zip' },
        }
      )
    ).result();
    const artifactResult = await (
      await client.submitUrl(
        'https://example.test/presigned.pdf',
        {},
        {
          target: { kind: 'presigned_url' },
        }
      )
    ).result();
    const remote = await (
      await client.submitUrl(
        'https://example.test/storage.pdf',
        {},
        {
          target: {
            kind: 's3',
            endpoint: 's3.example.test',
            access_key: 'access',
            secret_key: 'secret',
            bucket: 'out',
          },
        }
      )
    ).result();

    expect(inline.input.filename).toBe('inline.pdf');
    expect(inline.document).toMatchObject({
      schema_name: 'DoclingDocument',
      name: 'inline',
    });
    expect([...archive.content]).toEqual([0, 255, 80, 75]);
    expect(archive.filename).toBe('converted_docs.zip');
    expect(artifactResult).toEqual(presigned);
    expect(remote).toEqual(counts);
  });

  it.each([
    {
      kind: 'put',
      url: 'https://storage.example.test/result',
    },
    {
      kind: 'azure_blob',
      account_name: 'account',
      container: 'output',
      connection_string: 'azure-secret',
    },
    {
      kind: 'google_cloud_storage',
      bucket: 'output',
      service_account_key: {
        project_id: 'project',
        private_key_id: 'key-id',
        private_key: 'private-secret',
        client_email: 'client@example.test',
        client_id: 'client-id',
        auth_uri: 'https://accounts.example.test/auth',
        token_uri: 'https://accounts.example.test/token',
        auth_provider_x509_cert_url: 'https://accounts.example.test/certs',
        client_x509_cert_url: 'https://accounts.example.test/client-cert',
        universe_domain: 'googleapis.com',
      },
    },
    {
      kind: 'google_drive',
      path_id: 'folder-id',
      refresh_token: 'refresh-secret',
      credentials: {
        client_id: 'client-id',
        project_id: 'project',
        auth_uri: 'https://accounts.example.test/auth',
        token_uri: 'https://accounts.example.test/token',
        auth_provider_x509_cert_url: 'https://accounts.example.test/certs',
        client_secret: 'client-secret',
        redirect_uris: ['https://app.example.test/callback'],
      },
    },
  ] satisfies SubmitTarget[])(
    'passes the $kind target contract and plaintext credentials unchanged',
    async target => {
      const counts = {
        num_converted: 1,
        num_succeeded: 1,
        num_partially_succeeded: 0,
        num_failed: 0,
        processing_time: 1,
      };
      const transport = new ScriptedTransport(
        task(`target-${target.kind}`, 'success'),
        counts
      );
      const client = clientWith(transport);

      await (
        await client.submitUrl(
          'https://example.test/manual.pdf',
          {},
          {
            target,
          }
        )
      ).result();

      expect((transport.requests[0]?.body as { target: unknown }).target).toEqual(
        target
      );
    }
  );

  it('uploads binary content through the multipart file endpoint', async () => {
    const transport = new ScriptedTransport(task('multipart', 'pending'));
    const client = clientWith(transport);

    await client.submitBinary(
      {
        filename: 'manual.pdf',
        contentType: 'application/pdf',
        data: new Uint8Array([1, 2, 3]),
      },
      {
        options: {
          do_ocr: false,
          ocr_custom_config: { kind: 'custom', threshold: 0.8 },
        },
        target: { kind: 'zip' },
      }
    );

    const request = transport.requests[0];
    expect(request?.url).toBe('https://docling.example.test/v1/convert/file/async');
    expect(request?.bodyType).toBe('form');
    expect(request?.headers['content-type']).toBeUndefined();
    const form = request?.body as FormData;
    expect(form.get('do_ocr')).toBe('false');
    expect(form.get('ocr_custom_config')).toBe('{"kind":"custom","threshold":0.8}');
    expect(form.get('target_type')).toBe('zip');
    expect((form.get('files') as File).name).toBe('manual.pdf');
  });

  it('emits array option fields as repeated multipart entries', async () => {
    const transport = new ScriptedTransport(task('arrays', 'pending'));
    const client = clientWith(transport);

    await client.submitBinary(
      {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        data: new Uint8Array([1, 2, 3]),
      },
      {
        options: {
          to_formats: ['md', 'json'],
          from_formats: ['pdf', 'docx'],
          page_range: [1, 20],
          ocr_lang: ['en', 'fr'],
          do_ocr: true,
        },
        target: { kind: 'inbody' },
      }
    );

    const form = transport.requests[0]?.body as FormData;
    expect(form.getAll('to_formats')).toEqual(['md', 'json']);
    expect(form.getAll('from_formats')).toEqual(['pdf', 'docx']);
    expect(form.getAll('page_range')).toEqual(['1', '20']);
    expect(form.getAll('ocr_lang')).toEqual(['en', 'fr']);
    expect(form.get('do_ocr')).toBe('true');
  });

  it('emits callbacks as repeated multipart entries on the file endpoint', async () => {
    const transport = new ScriptedTransport(task('callbacks', 'pending'));
    const client = clientWith(transport);

    await client.submitBinary(
      {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        data: new Uint8Array([1, 2, 3]),
      },
      {
        options: { to_formats: ['md'] },
        target: { kind: 'inbody' },
        callbacks: [
          { url: 'https://hook.example.com/done' },
          { url: 'https://hook.example.com/notify', headers: { 'X-Token': 'abc' } },
        ],
      }
    );

    const form = transport.requests[0]?.body as FormData;
    const allCallbacks = form.getAll('callbacks') as string[];
    expect(allCallbacks[0]).toBe(
      JSON.stringify({ url: 'https://hook.example.com/done' })
    );
    expect(allCallbacks[1]).toBe(
      JSON.stringify({
        url: 'https://hook.example.com/notify',
        headers: { 'X-Token': 'abc' },
      })
    );
  });

  it('accepts a local Node path and rejects unsupported or ZIP URLs', async () => {
    const transport = new ScriptedTransport(task('path', 'pending'));
    const client = clientWith(transport);

    const readmePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');
    await client.submitSource(readmePath, {
      target: { kind: 'inbody' },
    });
    expect(transport.requests[0]?.url).toContain('/v1/convert/file/async');
    expect(((transport.requests[0]?.body as FormData).get('files') as File).name).toBe(
      'README.md'
    );

    await expect(client.submitSource('ftp://example.test/manual.pdf')).rejects.toThrow(
      'Unsupported document source URL scheme'
    );
    await expect(
      client.submitSource('https://example.test/archive.ZIP?download=1')
    ).rejects.toThrow('ZIP URLs are not accepted');
  });

  it('allows optional option fields to clear client defaults without mutation', async () => {
    const defaults = {
      do_ocr: true,
      ocr_custom_config: { kind: 'default', language: 'en' },
    };
    const overrides = {
      ocr_custom_config: null,
    };
    const transport = new ScriptedTransport(task('cleared', 'pending'));
    const client = clientWith(transport, { options: defaults });

    await client.submitUrl('https://example.test/manual.pdf', overrides, {
      target: { kind: 'inbody' },
    });

    expect(
      (transport.requests[0]?.body as { options: Record<string, unknown> }).options
    ).toEqual({
      do_ocr: true,
      to_formats: ['md', 'json'],
    });
    expect(defaults).toEqual({
      do_ocr: true,
      ocr_custom_config: { kind: 'default', language: 'en' },
    });
    expect(overrides).toEqual({ ocr_custom_config: null });
  });
});

describe('chunk and batch requests', () => {
  it('converts and chunks with full chunk options and converted document output', async () => {
    const chunkResult = {
      processing_time: 2.5,
      chunks: [
        {
          filename: 'manual.pdf',
          chunk_index: 0,
          text: '# Install\nConnect power.',
          doc_items: ['#/texts/0'],
        },
      ],
      documents: [],
    };
    const transport = new ScriptedTransport(
      task('chunk-1', 'success', 'chunk'),
      chunkResult
    );
    const client = clientWith(transport);

    const result = await (
      await client.submitChunkUrl(
        'https://files.example.test/manual.pdf',
        {
          chunker: 'hybrid',
          convert_options: { do_ocr: true },
          chunking_options: {
            max_tokens: 384,
            include_raw_text: true,
            merge_peers: false,
          },
          include_converted_doc: true,
          callbacks: [
            {
              url: 'https://workflow.example.test/progress',
              headers: { authorization: 'Bearer callback-token' },
            },
          ],
        },
        {
          sourceHeaders: { authorization: 'Bearer source-token' },
        }
      )
    ).result();

    expect(result).toEqual(chunkResult);
    expect(transport.requests[0]?.body).toEqual({
      convert_options: { do_ocr: true },
      chunking_options: {
        chunker: 'hybrid',
        max_tokens: 384,
        include_raw_text: true,
        merge_peers: false,
      },
      sources: [
        {
          kind: 'http',
          url: 'https://files.example.test/manual.pdf',
          headers: { authorization: 'Bearer source-token' },
        },
      ],
      include_converted_doc: true,
      target: { kind: 'inbody' },
      callbacks: [
        {
          url: 'https://workflow.example.test/progress',
          headers: { authorization: 'Bearer callback-token' },
        },
      ],
    });
  });

  it('uses the multipart hierarchical chunk endpoint for binary input', async () => {
    const transport = new ScriptedTransport(task('chunk-file', 'pending', 'chunk'));
    const client = clientWith(transport);

    await client.submitChunkBinary(
      {
        filename: 'manual.pdf',
        data: new Uint8Array([1, 2, 3]),
      },
      {
        chunker: 'hierarchical',
        chunking_options: { use_markdown_tables: true },
        include_converted_doc: true,
      }
    );

    const request = transport.requests[0];
    expect(request?.url).toContain('/v1/chunk/hierarchical/file/async');
    const form = request?.body as FormData;
    expect(form.get('chunking_use_markdown_tables')).toBe('true');
    expect(form.get('include_converted_doc')).toBe('true');
  });

  it('submits batch connector requests and preserves generic secret fields', async () => {
    const counts = {
      num_converted: 2,
      num_succeeded: 2,
      num_partially_succeeded: 0,
      num_failed: 0,
      processing_time: 3,
    };
    const transport = new ScriptedTransport(task('batch-1', 'success'), counts);
    const client = clientWith(transport);

    const result = await (
      await client.submitBatch({
        sources: [
          { kind: 'http', url: 'https://example.test/a.pdf' },
          {
            kind: 'filenet',
            repository_id: 'OS1',
            api_key: 'source-secret',
          },
        ],
        target: {
          kind: 'plugin_artifact_store',
          bucket: 'out',
          api_key: 'target-secret',
        },
        callbacks: [{ url: 'https://workflow.example.test/batch' }],
      })
    ).result();

    expect(result).toEqual(counts);
    expect(transport.requests[0]?.url).toContain('/v1/convert/source/batch');
    expect(transport.requests[0]?.body).toMatchObject({
      sources: [{ kind: 'http' }, { kind: 'filenet', api_key: 'source-secret' }],
      target: {
        kind: 'plugin_artifact_store',
        api_key: 'target-secret',
      },
      callbacks: [{ url: 'https://workflow.example.test/batch' }],
    });
  });

  it('rejects malformed known batch connectors instead of treating them as generic', async () => {
    const client = clientWith(new ScriptedTransport());

    await expect(
      client.submitBatch({
        sources: [
          {
            kind: 's3',
            bucket: 'input',
          } as never,
        ],
        target: { kind: 'presigned_url' },
      })
    ).rejects.toThrow('s3 source requires endpoint');

    await expect(
      client.submitBatch({
        sources: [{ kind: 'http', url: 'https://example.test/manual.pdf' }],
        target: {
          kind: 'google_drive',
          path_id: 'folder',
        } as never,
      })
    ).rejects.toThrow('requires token_path or refresh_token');
  });
});

describe('high-level conversion, limits, and concurrency', () => {
  it('merges client defaults shallowly, caps page range, and materializes inline JSON', async () => {
    const transport = new ScriptedTransport(
      new DoclingHttpError({
        method: 'POST',
        url: 'https://docling.example.test/v1/convert/source/async',
        status: 400,
        body: { detail: 'artifact storage to be configured' },
      }),
      task('convert-high', 'success'),
      documentResponse('manual.pdf')
    );
    const client = clientWith(transport, {
      options: {
        do_ocr: true,
        page_range: [2, 100],
        ocr_custom_config: { kind: 'default', language: 'en' },
      },
    });

    const result = await client.convert('https://example.test/manual.pdf', {
      options: {
        ocr_custom_config: { kind: 'replacement' },
      },
      maxNumPages: 10,
    });

    expect(result.document?.schema_name).toBe('DoclingDocument');
    expect(result.input.filename).toBe('manual.pdf');
    const fallbackBody = transport.requests[1]?.body as {
      options: Record<string, unknown>;
    };
    expect(fallbackBody.options).toMatchObject({
      do_ocr: true,
      page_range: [2, 10],
      ocr_custom_config: { kind: 'replacement' },
      to_formats: ['md', 'json'],
    });
  });

  it('skips known oversized input without making a request', async () => {
    const transport = new ScriptedTransport();
    const client = clientWith(transport);

    const result = await client.convert(
      {
        kind: 'file',
        filename: 'large.pdf',
        base64_string: 'AQIDBA==',
      },
      {
        maxFileSize: 3,
        raisesOnError: false,
      }
    );

    expect(result.status).toBe('skipped');
    expect(result.errors[0]?.category).toBe('policy');
    expect(transport.requests).toHaveLength(0);
  });

  it('raises for failed high-level conversion unless disabled', async () => {
    const failure = {
      ...documentResponse('bad.pdf'),
      status: 'failure',
      errors: [
        {
          component_type: 'document_backend',
          module_name: 'parser',
          error_message: 'encrypted',
        },
      ],
    };
    const transport = new ScriptedTransport(
      new DoclingHttpError({
        method: 'POST',
        url: 'https://docling.example.test/v1/convert/source/async',
        status: 400,
        body: { detail: 'artifact storage to be configured' },
      }),
      task('bad-1', 'success'),
      failure,
      new DoclingHttpError({
        method: 'POST',
        url: 'https://docling.example.test/v1/convert/source/async',
        status: 400,
        body: { detail: 'artifact storage to be configured' },
      }),
      task('bad-2', 'success'),
      failure
    );
    const client = clientWith(transport);

    await expect(
      client.convert(
        { kind: 'http', url: 'https://example.test/bad.pdf' },
        {
          options: {},
          raisesOnError: true,
        }
      )
    ).rejects.toBeInstanceOf(DoclingConversionError);

    const returned = await client.convert(
      { kind: 'http', url: 'https://example.test/bad.pdf' },
      { raisesOnError: false }
    );
    expect(returned.status).toBe('failure');
  });

  it('streams bounded fan-out in completion order or input order', async () => {
    let active = 0;
    let maximumActive = 0;
    const transport = new FunctionTransport(async request => {
      if (request.url.includes('/convert/source/async')) {
        const url = (request.body as { sources: Array<{ url: string }> }).sources[0]
          ?.url;
        return task(url?.includes('slow') === true ? 'slow' : 'fast', 'pending');
      }
      if (request.url.includes('/status/poll/')) {
        const slow = request.url.includes('slow');
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise(resolve => setTimeout(resolve, slow ? 20 : 1));
        active -= 1;
        return task(slow ? 'slow' : 'fast', 'success');
      }
      return {
        num_converted: 1,
        num_succeeded: 1,
        num_partially_succeeded: 0,
        num_failed: 0,
        processing_time: 1,
        documents: [],
      };
    });
    const client = clientWith(transport, { maxConcurrency: 2 });
    const items = [
      { source: { kind: 'http' as const, url: 'https://example.test/slow.pdf' } },
      { source: { kind: 'http' as const, url: 'https://example.test/fast.pdf' } },
    ];

    const completionOrder: string[] = [];
    for await (const [item] of client.submitAndRetrieveEach(items, {
      maxInFlight: 2,
      ordered: false,
    })) {
      completionOrder.push((item.source as { url: string }).url);
    }
    const ordered: string[] = [];
    for await (const [item] of client.submitAndRetrieveEach(items, {
      maxInFlight: 2,
      ordered: true,
    })) {
      ordered.push((item.source as { url: string }).url);
    }

    expect(completionOrder).toEqual([
      'https://example.test/fast.pdf',
      'https://example.test/slow.pdf',
    ]);
    expect(ordered).toEqual([
      'https://example.test/slow.pdf',
      'https://example.test/fast.pdf',
    ]);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });

  it('convertAll submits one task per source and preserves ordered failures', async () => {
    const transport = new FunctionTransport(request => {
      if (request.url.includes('/convert/source/async')) {
        const body = request.body as {
          target: { kind: string };
          sources: Array<{ url: string }>;
        };
        if (body.target.kind === 'presigned_url') {
          throw new DoclingHttpError({
            method: 'POST',
            url: request.url,
            status: 400,
            body: { detail: 'artifact storage to be configured' },
          });
        }
        const filename = new URL(body.sources[0]!.url).pathname.split('/').at(-1)!;
        return task(filename, 'success');
      }
      const taskId = request.url.split('/').at(-1)!;
      return documentResponse(taskId);
    });
    const client = clientWith(transport);

    const results = [];
    for await (const result of client.convertAll(
      [
        'ftp://example.test/unsupported.pdf',
        'https://example.test/one.pdf',
        'https://example.test/two.pdf',
      ],
      { maxConcurrency: 2 }
    )) {
      results.push(result);
    }

    expect(results.map(result => result.status)).toEqual([
      'failure',
      'success',
      'success',
    ]);
    expect(results.map(result => result.input.filename)).toEqual([
      'unsupported.pdf',
      'one.pdf',
      'two.pdf',
    ]);
    expect(
      transport.requests.filter(request =>
        request.url.includes('/convert/source/async')
      )
    ).toHaveLength(4);
  });

  it('materializes the default presigned result for high-level conversion', async () => {
    const presigned = {
      num_converted: 1,
      num_succeeded: 1,
      num_partially_succeeded: 0,
      num_failed: 0,
      processing_time: 2,
      documents: [
        {
          source_index: 0,
          source_uri: 'https://example.test/manual.pdf',
          filename: 'manual.pdf',
          status: 'success',
          errors: [],
          timings: {},
          artifacts: [
            {
              artifact_type: 'json',
              mime_type: 'application/json',
              uri: 'https://artifacts.example.test/manual.json',
            },
          ],
        },
      ],
    };
    const transport = new ScriptedTransport(
      task('presigned-high', 'success'),
      presigned
    );
    const artifactDownloader = new ArtifactDownloader({
      resolver: async () => ['8.8.8.8'],
      fetch: async () =>
        new Response(
          JSON.stringify({
            schema_name: 'DoclingDocument',
            name: 'manual',
          })
        ),
    });
    const client = clientWith(transport, { artifactDownloader });

    const result = await client.convert('https://example.test/manual.pdf');

    expect(result.document).toEqual({
      schema_name: 'DoclingDocument',
      name: 'manual',
    });
    expect(result.input.source).toBe('https://example.test/manual.pdf');
  });
});

describe('task and result lifecycle', () => {
  it('always includes wait=0 and maps poll 404 to task-not-found', async () => {
    const transport = new ScriptedTransport(
      new DoclingHttpError({
        method: 'GET',
        url: 'https://docling.example.test/v1/status/poll/missing?wait=0',
        status: 404,
        body: { detail: 'Task not found.' },
      })
    );
    const client = clientWith(transport);

    await expect(client.poll('missing')).rejects.toBeInstanceOf(
      DoclingTaskNotFoundError
    );
    expect(transport.requests[0]?.url).toContain('?wait=0');
  });

  it('maps result not-ready, expired, unknown-task, and terminal failure states', async () => {
    const notReady = () =>
      new DoclingHttpError({
        method: 'GET',
        url: 'https://docling.example.test/v1/result/task',
        status: 404,
        body: {
          detail: 'Task result not found. Please wait for a completion status.',
        },
      });
    const unknown = new DoclingHttpError({
      method: 'GET',
      url: 'https://docling.example.test/v1/result/task',
      status: 404,
      body: { detail: 'Task not found.' },
    });
    const transport = new ScriptedTransport(notReady(), notReady(), unknown, {
      kind: 'TaskFailureResult',
      failure: {
        category: 'backend_failure',
        message: 'authoritative failure',
        retryable: false,
        phase: 'execution',
        details: {},
      },
    });
    const client = clientWith(transport);

    await expect(client.getResult('pending')).rejects.toBeInstanceOf(
      DoclingResultNotReadyError
    );
    await expect(
      client.getResult('expired', {
        lastStatus: task('expired', 'success'),
      })
    ).rejects.toBeInstanceOf(DoclingResultExpiredError);
    await expect(client.getResult('unknown')).rejects.toBeInstanceOf(
      DoclingTaskNotFoundError
    );
    await expect(
      client.getResult('failed', {
        lastStatus: task('failed', 'failure'),
      })
    ).rejects.toMatchObject({
      name: 'DoclingTaskError',
      message: 'authoritative failure',
    });
  });

  it('fetches authoritative result details even when the cached job status failed', async () => {
    const transport = new ScriptedTransport(task('failed-job', 'failure'), {
      kind: 'TaskFailureResult',
      failure: {
        category: 'backend_failure',
        message: 'document is encrypted',
        retryable: false,
        phase: 'execution',
        details: {},
      },
    });
    const client = clientWith(transport);
    const job = await client.submitUrl(
      'https://example.test/bad.pdf',
      {},
      {
        target: { kind: 'inbody' },
      }
    );

    await expect(job.result()).rejects.toBeInstanceOf(DoclingTaskError);
    expect(transport.requests[1]?.url).toContain('/v1/result/failed-job');
  });

  it('uses zero retries for health and version', async () => {
    const transport = new ScriptedTransport({ status: 'ok' }, { version: '1.0.0' });
    const client = clientWith(transport);

    await client.health();
    await client.version();

    expect(transport.requests.map(request => request.retries)).toEqual([0, 0]);
  });

  it('validates health and nested result schemas', async () => {
    const healthClient = clientWith(new ScriptedTransport({}));
    await expect(healthClient.health()).resolves.toEqual({ status: 'ok' });

    const invalidHealth = clientWith(new ScriptedTransport({ status: 42 }));
    await expect(invalidHealth.health()).rejects.toBeInstanceOf(
      DoclingResponseSchemaMismatchError
    );

    const validConfidence = clientWith(
      new ScriptedTransport({
        ...documentResponse('manual.pdf'),
        confidence: {
          parse_score: 0.92,
          layout_score: null,
          mean_grade: 'good',
          low_grade: 'fair',
        },
      })
    );
    await expect(validConfidence.getResult('valid-confidence')).resolves.toMatchObject({
      confidence: {
        parse_score: 0.92,
        layout_score: null,
        mean_grade: 'good',
        low_grade: 'fair',
      },
    });

    const invalidConfidence = clientWith(
      new ScriptedTransport({
        ...documentResponse('manual.pdf'),
        confidence: { mean_grade: 'great' },
      })
    );
    await expect(
      invalidConfidence.getResult('invalid-confidence')
    ).rejects.toBeInstanceOf(DoclingResponseSchemaMismatchError);

    const invalidResult = clientWith(
      new ScriptedTransport({
        ...documentResponse('manual.pdf'),
        errors: [
          {
            component_type: 'made_up',
            module_name: 'test',
            error_message: 'bad wire data',
          },
        ],
      })
    );
    await expect(invalidResult.getResult('invalid')).rejects.toBeInstanceOf(
      DoclingResponseSchemaMismatchError
    );
  });

  it('maps unexpected result 404s to the common service error', async () => {
    const client = clientWith(
      new ScriptedTransport(
        new DoclingHttpError({
          method: 'GET',
          url: 'https://docling.example.test/v1/result/task',
          status: 404,
          body: { detail: 'unexpected lookup response' },
        })
      )
    );
    const error = await client.getResult('task').catch(value => value);
    expect(error).toBeInstanceOf(DoclingServiceError);
    expect(error).toMatchObject({
      message: 'Unexpected result lookup error',
      status: 404,
      detail: 'unexpected lookup response',
    });
  });

  it('watches an already-terminal attached job and closes idempotently', async () => {
    let closeCalls = 0;
    const transport: DoclingTransport = {
      request: async () => task('terminal', 'success') as never,
      close: () => {
        closeCalls += 1;
      },
    };
    const client = clientWith(transport);
    const job = client.job('terminal', task('terminal', 'success'));
    const updates: string[] = [];
    for await (const status of job.watch({ statusWatcher: 'polling' })) {
      updates.push(status.task_status);
    }
    expect(updates).toEqual(['success']);

    await client.close();
    await client.close();
    expect(closeCalls).toBe(1);
    await expect(client.health()).rejects.toBeInstanceOf(DoclingProtocolError);
  });
});

describe('parity edge cases', () => {
  it('preserves external target configuration for binary inputs via unified JSON', async () => {
    const transport = new ScriptedTransport(task('binary-s3', 'pending'));
    const client = clientWith(transport);
    const target: SubmitTarget = {
      kind: 's3',
      endpoint: 's3.example.test',
      access_key: 'access',
      secret_key: 'secret',
      bucket: 'converted',
      key_prefix: 'out/',
    };

    await client.submitBinary(
      {
        data: new Uint8Array([1, 2, 3]),
        filename: 'manual.pdf',
        contentType: 'application/pdf',
      },
      { target }
    );

    expect(transport.requests[0]?.url).toContain('/v1/convert/source/async');
    expect(transport.requests[0]?.body).toMatchObject({
      sources: [
        {
          kind: 'file',
          filename: 'manual.pdf',
          base64_string: 'AQID',
        },
      ],
      target,
    });
  });

  it('applies batch outputFormats and rejects malformed connector/callback shapes', async () => {
    const transport = new ScriptedTransport(task('batch', 'pending'));
    const client = clientWith(transport, { options: { do_ocr: true } });
    await client.submitBatch(
      {
        sources: [{ kind: 'http', url: 'https://example.test/a.pdf' }],
        target: { kind: 'presigned_url' },
      },
      { outputFormats: ['json'] }
    );
    expect(transport.requests[0]?.body).toMatchObject({
      options: { do_ocr: true, to_formats: ['json'] },
    });

    await expect(
      client.submitBatch({
        sources: [{ kind: 'http', url: 'ftp://example.test/a.pdf' }],
        target: { kind: 'presigned_url' },
      })
    ).rejects.toBeInstanceOf(DoclingProtocolError);
    await expect(
      client.submitBatch({
        sources: [{ kind: 'http', url: 'https://example.test/a.pdf' }],
        target: { kind: 'presigned_url' },
        callbacks: [
          {
            url: 'https://callback.example.test',
            headers: { authorization: 42 } as never,
          },
        ],
      })
    ).rejects.toBeInstanceOf(DoclingProtocolError);
  });

  it('propagates pre-aborted convertAll cancellation and isolates malformed URLs', async () => {
    const client = clientWith(new ScriptedTransport());
    const controller = new AbortController();
    const reason = new Error('stop batch');
    controller.abort(reason);
    await expect(
      collectAsync(
        client.convertAll(['https://example.test/a.pdf'], {
          signal: controller.signal,
        })
      )
    ).rejects.toBe(reason);

    const results = await collectAsync(
      client.convertAll([
        { kind: 'http', url: 'not a URL' },
        'ftp://example.test/also-invalid.pdf',
      ] as never)
    );
    expect(results.map(result => result.status)).toEqual(['failure', 'failure']);
  });

  it('supports includeConvertedDoc on the Python-shaped chunk overload', async () => {
    const transport = new ScriptedTransport(task('chunk', 'success', 'chunk'), {
      chunks: [],
      documents: [],
      processing_time: 0,
    });
    const client = clientWith(transport);
    await client.chunk(
      'https://example.test/manual.pdf',
      'hybrid',
      {},
      {
        includeConvertedDoc: true,
      }
    );
    expect(transport.requests[0]?.body).toMatchObject({
      include_converted_doc: true,
    });
  });

  it('validates nested conversion and chunk options before submission', async () => {
    expect(() =>
      clientWith(new ScriptedTransport(), {
        options: {
          picture_description_local: { repo_id: 'local-model' },
          picture_description_api: {
            url: 'https://models.example.test',
          },
        },
      })
    ).toThrow(DoclingProtocolError);
    expect(() =>
      clientWith(new ScriptedTransport(), {
        options: {
          picture_description_local: {
            repo_id: 'local-model',
            classification_allow: ['not-a-docling-label'],
          } as never,
        },
      })
    ).toThrow(DoclingProtocolError);
    expect(() =>
      clientWith(new ScriptedTransport(), {
        options: {
          vlm_pipeline_model_local: {
            repo_id: 'model',
            response_format: 'doctags',
            inference_framework: 'not-a-framework',
          } as never,
        },
      })
    ).toThrow(DoclingProtocolError);

    const transport = new ScriptedTransport(task('chunk-options', 'pending', 'chunk'));
    const client = clientWith(transport);
    await expect(
      client.submitChunk({
        chunker: 'hybrid',
        sources: [{ kind: 'http', url: 'https://example.test/manual.pdf' }],
        chunking_options: { merge_peers: 'yes' } as never,
      })
    ).rejects.toBeInstanceOf(DoclingProtocolError);

    await client.submitChunk({
      chunker: 'hybrid',
      sources: [{ kind: 'http', url: 'https://example.test/manual.pdf' }],
      chunking_options: { chunker: 'hierarchical' } as never,
    });
    expect(transport.requests[0]?.body).toMatchObject({
      chunking_options: { chunker: 'hybrid' },
    });
  });

  it('fills Python response defaults in cached task metadata and failures', async () => {
    const transport = new ScriptedTransport({
      task_id: 'normalized-status',
      task_type: 'convert',
      task_status: 'pending',
      task_meta: { num_docs: 2 },
      failure: {
        category: 'unknown',
        message: 'not terminal',
        retryable: false,
        phase: 'orchestration',
      },
    });
    const client = clientWith(transport);
    const job = await client.submitUrl(
      'https://example.test/manual.pdf',
      {},
      { target: { kind: 'inbody' } }
    );

    expect(job.status.task_meta).toEqual({
      num_docs: 2,
      num_processed: 0,
      num_succeeded: 0,
      num_partially_succeeded: 0,
      num_failed: 0,
    });
    expect(job.status.failure?.details).toEqual({});
  });

  it('preserves raw JSON-labeled binary bytes and annotates schema errors', async () => {
    const bytes = new TextEncoder().encode('{not-json');
    const binaryClient = clientWith(
      new ScriptedTransport({
        content: bytes,
        contentType: 'application/json',
        headers: {},
      } satisfies DoclingBinaryResponse)
    );
    await expect(binaryClient.getBinaryResult('raw')).resolves.toMatchObject({
      content: bytes,
      content_type: 'application/json',
    });

    const schemaClient = clientWith(new ScriptedTransport({ unexpected: 'response' }));
    await expect(schemaClient.getResult('schema')).rejects.toMatchObject({
      name: 'DoclingResponseSchemaMismatchError',
      status: 200,
    });
  });

  it('cancels source normalization before and during binary materialization', async () => {
    const transport = new ScriptedTransport();
    const client = clientWith(transport);
    const preAborted = new AbortController();
    preAborted.abort('stop before reading');
    await expect(
      client.submitSource('/path/that/must/not/be/read.pdf', {
        signal: preAborted.signal,
        target: { kind: 'inbody' },
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    class SlowBlob extends Blob {
      override async arrayBuffer(): Promise<ArrayBuffer> {
        await new Promise(resolve => setTimeout(resolve, 10));
        return super.arrayBuffer();
      }
    }
    const duringRead = new AbortController();
    const reason = new Error('stop while materializing');
    const submission = client.submitBinary(
      {
        data: new SlowBlob(['document']),
        filename: 'manual.pdf',
      },
      {
        signal: duringRead.signal,
        target: {
          kind: 's3',
          endpoint: 's3.example.test',
          access_key: 'key',
          secret_key: 'secret',
          bucket: 'documents',
        },
      }
    );
    duringRead.abort(reason);
    await expect(submission).rejects.toBe(reason);
    expect(transport.requests).toHaveLength(0);
  });
});

async function collectAsync<T>(values: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const value of values) {
    results.push(value);
  }
  return results;
}
