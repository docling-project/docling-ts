import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import {
  ArtifactDownloader,
  DoclingArtifactDownloadError,
  documentFromBundle,
  materializePresignedResult,
  selectDocumentArtifact,
  type PresignedUrlConvertResponse,
} from '../src';

const INPUT = {
  filename: 'manual.pdf',
  source: 'https://example.test/manual.pdf',
} as const;

describe('presigned artifact materialization', () => {
  it('prefers a resource bundle and embeds referenced images', async () => {
    const document = {
      schema_name: 'DoclingDocument',
      name: 'manual',
      pictures: [
        {
          image: {
            mimetype: 'image/png',
            dpi: 144,
            size: { width: 1, height: 1 },
            uri: 'artifacts/picture.png',
          },
        },
      ],
      pages: {
        '1': {
          image: {
            mimetype: 'image/png',
            dpi: 72,
            size: { width: 1, height: 1 },
            uri: './artifacts/page.png',
          },
        },
      },
    };
    const bundle = zipSync({
      'manual.json': strToU8(JSON.stringify(document)),
      'artifacts/picture.png': new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
      'artifacts/page.png': new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
    });
    const fetchImplementation = vi.fn(
      async () => new Response(Uint8Array.from(bundle).buffer)
    );
    const downloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['8.8.8.8'],
    });
    const response = presignedResponse([
      {
        artifact_type: 'json',
        mime_type: 'application/json',
        uri: 'https://artifacts.example.test/manual.json',
      },
      {
        artifact_type: 'resource_bundle',
        mime_type: 'application/zip',
        uri: 'https://artifacts.example.test/manual.zip',
      },
    ]);

    const result = await materializePresignedResult<Record<string, unknown>>(
      response,
      INPUT,
      downloader
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://artifacts.example.test/manual.zip',
      expect.objectContaining({ redirect: 'manual' })
    );
    const materialized = result.document as typeof document;
    expect(materialized.pictures[0]?.image.uri).toBe(
      'data:image/png;base64,iVBORw0KGgo='
    );
    expect(materialized.pages['1']?.image.uri).toBe(
      'data:image/png;base64,iVBORw0KGgo='
    );
    expect(result.processing_time).toBe(2.5);
  });

  it('materializes JSON-only results and preserves server metadata', async () => {
    const downloader = new ArtifactDownloader({
      fetch: async () =>
        new Response(
          JSON.stringify({
            schema_name: 'DoclingDocument',
            name: 'manual',
          })
        ),
      resolver: async () => ['8.8.8.8'],
    });
    const response = presignedResponse([
      {
        artifact_type: 'json',
        mime_type: 'application/json',
        uri: 'https://artifacts.example.test/manual.json',
      },
    ]);
    response.documents[0]!.timings = {
      conversion: { scope: 'document', count: 1, times: [1.2] },
    };
    response.documents[0]!.confidence = { parse_score: 0.9 };

    const result = await materializePresignedResult<Record<string, unknown>>(
      response,
      INPUT,
      downloader
    );

    expect(result.document).toMatchObject({
      schema_name: 'DoclingDocument',
      name: 'manual',
    });
    expect(result.timings).toHaveProperty('conversion');
    expect(result.confidence).toEqual({ parse_score: 0.9 });
  });

  it('does not download failed document items and degrades reconstruction errors', async () => {
    const fetchImplementation = vi.fn();
    const downloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['8.8.8.8'],
    });
    const failed = presignedResponse([]);
    failed.documents[0]!.status = 'failure';
    failed.documents[0]!.errors = [
      {
        component_type: 'document_backend',
        module_name: 'parser',
        error_message: 'encrypted',
      },
    ];

    const failedResult = await materializePresignedResult(failed, INPUT, downloader);
    expect(failedResult.status).toBe('failure');
    expect(failedResult.errors[0]?.error_message).toBe('encrypted');
    expect(fetchImplementation).not.toHaveBeenCalled();

    const missingArtifacts = presignedResponse([]);
    const degraded = await materializePresignedResult(
      missingArtifacts,
      INPUT,
      downloader
    );
    expect(degraded.status).toBe('failure');
    expect(degraded.errors[0]?.error_message).toContain(
      "neither a 'json' nor a 'resource_bundle'"
    );
  });

  it('rejects unsafe ZIP member and image-reference paths', () => {
    expect(() =>
      documentFromBundle(
        zipSync({
          '../secret.json': strToU8('{}'),
        })
      )
    ).toThrow('unsafe path');

    const escapingImage = {
      schema_name: 'DoclingDocument',
      name: 'manual',
      pictures: [
        {
          image: {
            mimetype: 'image/png',
            dpi: 72,
            size: {},
            uri: '../../secret.png',
          },
        },
      ],
    };
    expect(() =>
      documentFromBundle(
        zipSync({
          'manual.json': strToU8(JSON.stringify(escapingImage)),
        })
      )
    ).toThrow('unsafe path');
  });

  it('requires exactly one Docling JSON and validates referenced image bytes', () => {
    expect(() =>
      documentFromBundle(
        zipSync({
          'one.json': strToU8(
            JSON.stringify({ schema_name: 'DoclingDocument', name: 'one' })
          ),
          'two.json': strToU8(
            JSON.stringify({ schema_name: 'DoclingDocument', name: 'two' })
          ),
        })
      )
    ).toThrow('exactly one');

    const document = {
      schema_name: 'DoclingDocument',
      name: 'manual',
      pictures: [
        {
          image: {
            mimetype: 'image/png',
            dpi: 72,
            size: {},
            uri: 'artifacts/fake.png',
          },
        },
      ],
    };
    expect(() =>
      documentFromBundle(
        zipSync({
          'manual.json': strToU8(JSON.stringify(document)),
          'artifacts/fake.png': strToU8('<script>not an image</script>'),
        })
      )
    ).toThrow('do not match image/png');
  });

  it('selects bundles independent of artifact order', () => {
    const item = presignedResponse([
      {
        artifact_type: 'json',
        mime_type: 'application/json',
        uri: 'https://example.test/document.json',
      },
      {
        artifact_type: 'resource_bundle',
        mime_type: 'application/zip',
        uri: 'https://example.test/document.zip',
      },
    ]).documents[0]!;

    expect(selectDocumentArtifact(item).artifact_type).toBe('resource_bundle');
  });
});

describe('artifact download security', () => {
  it('rejects private and mixed DNS answers and accepts all-public answers', async () => {
    const fetchImplementation = vi.fn(async () => new Response('artifact'));
    const privateDownloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['127.0.0.1'],
    });
    await expect(
      privateDownloader.download('https://artifacts.example.test/a')
    ).rejects.toBeInstanceOf(DoclingArtifactDownloadError);

    const mixedDownloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['8.8.8.8', '10.0.0.1'],
    });
    await expect(
      mixedDownloader.download('https://artifacts.example.test/a')
    ).rejects.toThrow('globally routable');

    const publicDownloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['8.8.8.8', '2606:4700:4700::1111'],
    });
    await expect(
      publicDownloader.download('https://artifacts.example.test/a')
    ).resolves.toEqual(strToU8('artifact'));
  });

  it('revalidates redirect destinations and never forwards service headers', async () => {
    const fetchImplementation = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      })
    );
    const downloader = new ArtifactDownloader({
      fetch: fetchImplementation,
      resolver: async () => ['8.8.8.8'],
    });

    await expect(
      downloader.download('https://artifacts.example.test/start')
    ).rejects.toThrow('globally routable');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0]?.[1]).not.toHaveProperty('headers');
  });

  it('supports an explicit private-host override and enforces streamed size limits', async () => {
    const allowed = new ArtifactDownloader({
      allowPrivateUrls: true,
      fetch: async () => new Response(new Uint8Array([1, 2, 3])),
      maxBytes: 3,
    });
    await expect(allowed.download('http://127.0.0.1/a')).resolves.toEqual(
      new Uint8Array([1, 2, 3])
    );

    const rejected = new ArtifactDownloader({
      allowPrivateUrls: true,
      fetch: async () => new Response(new Uint8Array([1, 2, 3, 4])),
      maxBytes: 3,
    });
    await expect(rejected.download('http://127.0.0.1/a')).rejects.toThrow(
      'byte download limit'
    );
  });

  it('requires redirect locations and caps redirect count', async () => {
    const missingLocation = new ArtifactDownloader({
      allowPrivateUrls: true,
      fetch: async () => new Response(null, { status: 302 }),
    });
    await expect(
      missingLocation.download('https://example.test/start')
    ).rejects.toThrow('missing Location');

    const looping = new ArtifactDownloader({
      allowPrivateUrls: true,
      maxRedirects: 1,
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: '/again' },
        }),
    });
    await expect(looping.download('https://example.test/start')).rejects.toThrow(
      'exceeded 1 redirects'
    );
  });
});

function presignedResponse(
  artifacts: PresignedUrlConvertResponse['documents'][number]['artifacts']
): PresignedUrlConvertResponse {
  return {
    num_converted: 1,
    num_succeeded: 1,
    num_partially_succeeded: 0,
    num_failed: 0,
    processing_time: 2.5,
    documents: [
      {
        source_index: 0,
        source_uri: 'https://example.test/manual.pdf',
        filename: 'manual.pdf',
        status: 'success',
        errors: [],
        timings: {},
        artifacts,
      },
    ],
  };
}
