import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { deserializeDclx } from '../src/doclang';

const DIR = join(__dirname, 'data/dclx');
const opts = { DOMParser };

/**
 * Minimal zip writer. Members are deflated, except `stored` ones. `declared`
 * overrides the uncompressed size written to the headers, to forge archives.
 */
function zip(
  members: Record<string, string | Uint8Array>,
  { stored = [], declared }: { stored?: string[]; declared?: number } = {}
) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(members)) {
    const raw = Buffer.from(content);
    const method = stored.includes(name) ? 0 : 8;
    const data = method ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const size = declared ?? raw.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(size, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);

    parts.push(local, nameBuf, data);
    central.push(entry, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, dir, end]));
}

// A 2x3 PNG header is enough for the reader, which only sniffs the size.
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44,
  0x52, 0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0,
]);
const doclang = (body: string) => `<doclang>${body}</doclang>`;
const picture = (uri: string) =>
  doclang(`<picture><src uri="${uri}"/></picture>`);

describe('doclang archive', () => {
  const dclx = readFileSync(join(DIR, 'two_pages.dclx'));

  it('reads the document and names it', async () => {
    const doc = await deserializeDclx(dclx, { ...opts, name: 'two_pages' });
    expect(doc.name).toBe('two_pages');
    expect(doc.pictures).toHaveLength(1);
    expect(doc.texts[1].text).toBe('Docling Technical Report');
  });

  it('embeds picture and page images', async () => {
    const doc = await deserializeDclx(dclx, opts);
    const png = 'data:image/png;base64,';
    expect(Object.keys(doc.pages)).toEqual(['1', '2']);
    for (const page of Object.values(doc.pages))
      expect(page.image?.uri.startsWith(png)).toBe(true);
    expect(doc.pages['1'].image?.size).toEqual({ width: 1224, height: 1584 });
    expect(doc.pictures[0].image?.uri.startsWith(png)).toBe(true);
    expect(doc.pictures[0].image?.size).toEqual({ width: 173, height: 178 });
  });

  it('accepts a Blob and an ArrayBuffer', async () => {
    const bytes = new Uint8Array(dclx);
    const a = await deserializeDclx(new Blob([bytes]), opts);
    const b = await deserializeDclx(bytes.buffer, opts);
    expect(a).toEqual(b);
  });

  it('reads picture and page images from the archive', async () => {
    const doc = await deserializeDclx(
      zip({
        'document.xml': picture('assets/a.png'),
        'assets/a.png': PNG,
        'pages/1.png': PNG,
        'pages/7.png': PNG,
      }),
      opts
    );
    expect(doc.pictures[0].image?.size).toEqual({ width: 2, height: 3 });
    expect(doc.pages['1'].image?.mimetype).toBe('image/png');
    expect(doc.pages['7']).toBeUndefined();
  });

  it('decodes embedded data URIs', async () => {
    const uri = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`;
    const doc = await deserializeDclx(
      zip({ 'document.xml': picture(uri) }),
      opts
    );
    expect(doc.pictures[0].image?.size).toEqual({ width: 2, height: 3 });
  });

  it('reads stored (uncompressed) members', async () => {
    const doc = await deserializeDclx(
      zip(
        { 'document.xml': picture('assets/a.png'), 'assets/a.png': PNG },
        { stored: ['assets/a.png'] }
      ),
      opts
    );
    expect(doc.pictures[0].image?.size).toEqual({ width: 2, height: 3 });
  });

  it('bounds inflation by actual bytes, not declared sizes', async () => {
    const lying = zip(
      { 'document.xml': doclang('x'.repeat(100_000)) },
      { declared: 10 }
    );
    await expect(
      deserializeDclx(lying, { ...opts, maxMemberSize: 128 })
    ).rejects.toThrow('Archive member exceeds size limit');
    const two = zip(
      { 'assets/a': 'A'.repeat(100), 'assets/b': 'B'.repeat(100) },
      { declared: 10 }
    );
    await expect(
      deserializeDclx(two, { ...opts, maxTotalSize: 150 })
    ).rejects.toThrow('total uncompressed size limit');
  });

  it('rejects data that is not a zip', async () => {
    await expect(deserializeDclx(new Uint8Array(100), opts)).rejects.toThrow(
      'not a zip file'
    );
  });

  it('requires document.xml', async () => {
    await expect(
      deserializeDclx(zip({ 'pages/1.png': PNG }), opts)
    ).rejects.toThrow('missing document.xml');
  });

  it('rejects unsafe or missing image URIs', async () => {
    const load = (uri: string) =>
      deserializeDclx(
        zip({ 'document.xml': picture(uri), 'assets/a.png': PNG }),
        opts
      );
    await expect(load('../a.png')).rejects.toThrow('Invalid archive path');
    await expect(load('/a.png')).rejects.toThrow('Invalid archive path');
    await expect(load('https://x/a.png')).rejects.toThrow('Unsupported');
    await expect(load('assets/none.png')).rejects.toThrow('not found');
  });

  it('rejects unsafe member names', async () => {
    await expect(
      deserializeDclx(
        zip({ 'document.xml': doclang(''), '../evil.txt': 'x' }),
        opts
      )
    ).rejects.toThrow('Invalid archive member path');
  });

  it('enforces member and total size limits', async () => {
    const big = zip({ 'document.xml': doclang('x'.repeat(4096)) });
    await expect(
      deserializeDclx(big, { ...opts, maxMemberSize: 128 })
    ).rejects.toThrow('Archive member exceeds size limit');
    const two = zip({ 'a.txt': 'A'.repeat(100), 'b.txt': 'B'.repeat(100) });
    await expect(
      deserializeDclx(two, { ...opts, maxTotalSize: 150 })
    ).rejects.toThrow('total uncompressed size limit');
  });

  it('enforces XML and image size limits', async () => {
    await expect(
      deserializeDclx(zip({ 'document.xml': doclang('x'.repeat(4096)) }), {
        ...opts,
        maxXmlBytes: 1024,
      })
    ).rejects.toThrow('exceeds size limit');
    await expect(
      deserializeDclx(
        zip({ 'document.xml': doclang('<page_break/>'), 'pages/1.png': PNG }),
        { ...opts, maxImageBytes: 8 }
      )
    ).rejects.toThrow('exceeds size limit');
    await expect(
      deserializeDclx(
        zip({ 'document.xml': picture('assets/a.png'), 'assets/a.png': PNG }),
        { ...opts, maxImageBytes: 8 }
      )
    ).rejects.toThrow('exceeds size limit');
  });
});
