import type { DoclingDocument, ImageRef } from '../types';
import { type DeserializeDocLangOptions, deserializeDocLang } from './doclang';

const MiB = 1024 * 1024;

export interface DeserializeDclxOptions extends Omit<
  DeserializeDocLangOptions,
  'resolveImage'
> {
  /** Document name; the Python loader uses the archive's file stem. */
  name?: string;
  /** Max uncompressed size of any archive member. Default 512 MiB. */
  maxMemberSize?: number;
  /** Max cumulative uncompressed size of all members. Default 2 GiB. */
  maxTotalSize?: number;
  /** Max size of `document.xml`. Default 128 MiB. */
  maxXmlBytes?: number;
  /** Max size of any single picture or page image. Default 20 MiB. */
  maxImageBytes?: number;
}

/** Reject paths that are absolute, use backslashes or climb out of the root. */
function validatePath(path: string, label: string): void {
  if (
    !path ||
    path === '.' ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').includes('..')
  )
    throw new Error(`Invalid ${label} path: ${JSON.stringify(path)}`);
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/** MIME type and pixel size of a PNG, JPEG or GIF, read from its header. */
function sniffImage(bytes: Uint8Array, label: string) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && v.getUint32(0) === 0x89504e47) {
    return {
      mimetype: 'image/png',
      width: v.getUint32(16),
      height: v.getUint32(20),
    };
  }
  if (bytes.length >= 10 && v.getUint32(0) >>> 8 === 0x474946) {
    return {
      mimetype: 'image/gif',
      width: v.getUint16(6, true),
      height: v.getUint16(8, true),
    };
  }
  if (bytes.length >= 4 && v.getUint16(0) === 0xffd8) {
    // Walk the marker segments up to the first start-of-frame.
    for (let i = 2; i + 9 < bytes.length && bytes[i] === 0xff;) {
      const marker = bytes[i + 1];
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return {
          mimetype: 'image/jpeg',
          width: v.getUint16(i + 7),
          height: v.getUint16(i + 5),
        };
      i += 2 + v.getUint16(i + 2);
    }
  }
  throw new Error(`${label} is not a supported image (PNG, JPEG or GIF)`);
}

function imageRef(
  bytes: Uint8Array,
  maxBytes: number,
  label: string
): ImageRef {
  if (bytes.length > maxBytes)
    throw new Error(`${label} exceeds size limit of ${maxBytes} bytes`);
  const { mimetype, width, height } = sniffImage(bytes, label);
  return {
    mimetype,
    dpi: 72,
    size: { width, height },
    uri: `data:${mimetype};base64,${toBase64(bytes)}`,
  };
}

async function toBytes(input: Uint8Array | ArrayBuffer | Blob) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const ZIP64 = 0xffffffff;

/** List the members of a zip from its central directory (no zip64). */
function zipEntries(zip: Uint8Array): ZipEntry[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fail = (msg: string): never => {
    throw new Error(`Invalid DocLang archive: ${msg}`);
  };

  // End of central directory record: last 22+ bytes, before an optional comment.
  let eocd = zip.length - 22;
  while (eocd >= 0 && v.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0 || zip.length - eocd > 22 + 0xffff) fail('not a zip file');

  const count = v.getUint16(eocd + 10, true);
  let pos = v.getUint32(eocd + 16, true);
  if (count === 0xffff || pos === ZIP64) fail('zip64 archives are unsupported');

  const names = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (pos + 46 > zip.length || v.getUint32(pos, true) !== 0x02014b50)
      fail('corrupt central directory');
    const [nameLen, extraLen, commentLen] = [28, 30, 32].map(o =>
      v.getUint16(pos + o, true)
    );
    const entry = {
      name: names.decode(zip.subarray(pos + 46, pos + 46 + nameLen)),
      method: v.getUint16(pos + 10, true),
      compressedSize: v.getUint32(pos + 20, true),
      size: v.getUint32(pos + 24, true),
      offset: v.getUint32(pos + 42, true),
    };
    if ([entry.compressedSize, entry.size, entry.offset].includes(ZIP64))
      fail('zip64 archives are unsupported');
    entries.push(entry);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Inflate a raw-deflate stream with the platform's `DecompressionStream`,
 * stopping as soon as the output exceeds `limit` bytes.
 */
async function inflate(data: Uint8Array, limit: number) {
  const stream = new DecompressionStream('deflate-raw');
  // Not awaited: the writes only settle once the readable side is consumed.
  const writer = stream.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The content of a zip member, which is stored or deflated. */
async function readEntry(
  zip: Uint8Array,
  { name, method, compressedSize, offset }: ZipEntry,
  limit: number
) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  if (offset + 30 > zip.length || v.getUint32(offset, true) !== 0x04034b50)
    throw new Error(`Invalid DocLang archive: corrupt member ${name}`);
  const start =
    offset +
    30 +
    v.getUint16(offset + 26, true) +
    v.getUint16(offset + 28, true);
  const data = zip.subarray(start, start + compressedSize);
  if (data.length !== compressedSize)
    throw new Error(`Invalid DocLang archive: truncated member ${name}`);
  if (method === 0) return data.length > limit ? null : data;
  if (method === 8) return inflate(data, limit);
  throw new Error(
    `Unsupported compression method ${method} in archive member ${name}`
  );
}

/**
 * Read a DocLang archive (`.dclx`) into a DoclingDocument-shaped JSON object.
 *
 * In Node pass a `DOMParser` from `@xmldom/xmldom`, as with `deserializeDocLang`.
 */
export async function deserializeDclx(
  input: Uint8Array | ArrayBuffer | Blob,
  {
    name,
    maxMemberSize = 512 * MiB,
    maxTotalSize = 2048 * MiB,
    maxXmlBytes = 128 * MiB,
    maxImageBytes = 20 * MiB,
    ...options
  }: DeserializeDclxOptions = {}
): Promise<DoclingDocument> {
  if (maxMemberSize <= 0)
    throw new Error(`maxMemberSize must be positive, got ${maxMemberSize}`);
  if (maxTotalSize <= 0)
    throw new Error(`maxTotalSize must be positive, got ${maxTotalSize}`);

  // Budgets are checked against the declared sizes first (cheap reject), and
  // again against the bytes actually inflated, as declared sizes can lie.
  const zip = await toBytes(input);
  const tooBig = (member: string) =>
    new Error(
      `Archive member exceeds size limit of ${maxMemberSize} bytes: ${JSON.stringify(member)}`
    );
  const tooMuch = () =>
    new Error(
      `Archive exceeds total uncompressed size limit of ${maxTotalSize} bytes`
    );
  let declared = 0;
  let total = 0;
  const files: Record<string, Uint8Array> = {};
  for (const entry of zipEntries(zip)) {
    const { name: member, size } = entry;
    if (member.endsWith('/')) continue;
    validatePath(member, 'archive member');
    if (size > maxMemberSize) throw tooBig(member);
    declared += size;
    if (declared > maxTotalSize) throw tooMuch();
    if (member !== 'document.xml' && !/^(assets|pages)\//.test(member))
      continue;

    const room = maxTotalSize - total;
    const bytes = await readEntry(zip, entry, Math.min(maxMemberSize, room));
    if (!bytes) throw maxMemberSize <= room ? tooBig(member) : tooMuch();
    total += bytes.length;
    files[member] = bytes;
  }

  const xml = files['document.xml'];
  if (!xml) throw new Error('DocLang archive missing document.xml');
  if (xml.length > maxXmlBytes)
    throw new Error(
      `DocLang document.xml exceeds size limit of ${maxXmlBytes} bytes`
    );

  const resolveImage = (uri: string): ImageRef => {
    uri = uri.trim();
    if (!uri) throw new Error('Empty image URI in archive markup');
    if (uri.startsWith('data:')) {
      const m = /^data:[^,]*;base64,(.*)$/s.exec(uri);
      if (!m) throw new Error('Could not decode embedded archive image URI');
      return imageRef(
        fromBase64(m[1]),
        maxImageBytes,
        'Embedded archive image'
      );
    }
    if (uri.includes('://'))
      throw new Error(
        `Unsupported archive image URI scheme: ${JSON.stringify(uri)}`
      );
    validatePath(uri, 'archive');
    const bytes = files[uri];
    if (!bytes)
      throw new Error(`Archive asset not found: ${JSON.stringify(uri)}`);
    return imageRef(bytes, maxImageBytes, 'Archive asset image');
  };

  const doc = deserializeDocLang(new TextDecoder().decode(xml), {
    ...options,
    resolveImage,
  });
  if (name !== undefined) doc.name = name;

  // Page rasters: `pages/<page_no>.<ext>`, for pages the document knows.
  for (const [member, bytes] of Object.entries(files)) {
    const m = /^pages\/(\d+)\.[^/]+$/.exec(member);
    const page = m && doc.pages?.[String(Number(m[1]))];
    if (page) page.image = imageRef(bytes, maxImageBytes, 'Archive page image');
  }
  return doc;
}
