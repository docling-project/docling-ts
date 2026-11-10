import { DoclingArtifactDownloadError } from './errors';
import { inflateRaw, inflateRawAsync } from './inflate';

/**
 * Minimal, bounded ZIP reader for resource bundles.
 *
 * Supports stored (0) and deflated (8) entries, ZIP64, UTF-8 and Latin-1 names,
 * and entries whose sizes live in a trailing data descriptor (sizes are always
 * taken from the central directory). Encrypted entries, other compression
 * methods, and multi-disk archives are rejected.
 */

export interface ZipLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
  /** Called for every entry name before it is read; may throw. */
  validateName?: (name: string) => void;
}

const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
const EOCD64_SIGNATURE = 0x06064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
// DEFLATE cannot expand data by more than ~1032:1; reject larger declared sizes
// before allocating the output buffer.
const MAX_DEFLATE_RATIO = 1032;

interface ZipEntry {
  name: string;
  method: number;
  /** Declared uncompressed size. */
  size: number;
  /** Raw (still compressed, for method 8) entry bytes; a view into the input. */
  data: Uint8Array;
}

/**
 * Read and validate the central directory without inflating anything, so every
 * limit and name check fails before any decompression work happens.
 */
function readEntries(bytes: Uint8Array, limits: ZipLimits): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { entryCount, directoryOffset } = readEndOfCentralDirectory(bytes, view);

  if (entryCount > limits.maxEntries) {
    throw new DoclingArtifactDownloadError(
      `Resource bundle exceeds ${limits.maxEntries} entries`
    );
  }

  const entries: ZipEntry[] = [];
  let total = 0;
  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    requireRange(bytes, cursor, 46);
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new Error('Invalid ZIP: bad central directory entry');
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    let compressedSize = view.getUint32(cursor + 20, true);
    let size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    let localOffset = view.getUint32(cursor + 42, true);
    requireRange(bytes, cursor + 46, nameLength + extraLength + commentLength);

    const name = decodeName(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
      (flags & 0x800) !== 0
    );

    if (
      size === 0xffffffff ||
      compressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      const zip64 = readZip64Extra(
        view,
        cursor + 46 + nameLength,
        extraLength,
        size === 0xffffffff,
        compressedSize === 0xffffffff,
        localOffset === 0xffffffff
      );
      size = zip64.size ?? size;
      compressedSize = zip64.compressedSize ?? compressedSize;
      localOffset = zip64.localOffset ?? localOffset;
    }
    cursor += 46 + nameLength + extraLength + commentLength;

    limits.validateName?.(name);
    if ((flags & 0x01) !== 0) {
      throw new Error(`Invalid ZIP: entry is encrypted: ${name}`);
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`Invalid ZIP: unsupported compression method ${method}`);
    }

    total += size;
    if (total > limits.maxUncompressedBytes) {
      throw new DoclingArtifactDownloadError(
        `Resource bundle exceeds ${limits.maxUncompressedBytes} uncompressed bytes`
      );
    }

    requireRange(bytes, localOffset, 30);
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) {
      throw new Error('Invalid ZIP: bad local file header');
    }
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    requireRange(bytes, dataStart, compressedSize);

    if (method === 0 && compressedSize !== size) {
      throw new Error('Invalid ZIP: stored entry size mismatch');
    }
    if (method === 8 && size > compressedSize * MAX_DEFLATE_RATIO) {
      throw new Error(
        'Invalid ZIP: declared size is impossible for the compressed data'
      );
    }
    entries.push({
      name,
      method,
      size,
      data: bytes.subarray(dataStart, dataStart + compressedSize),
    });
  }
  return entries;
}

function newEntryMap(): Record<string, Uint8Array> {
  // No prototype, so an entry named "__proto__" cannot affect Object.prototype.
  return Object.create(null) as Record<string, Uint8Array>;
}

/** Synchronous variant; uses the bundled inflater. */
export function unzipEntries(
  bytes: Uint8Array,
  limits: ZipLimits
): Record<string, Uint8Array> {
  const result = newEntryMap();
  for (const entry of readEntries(bytes, limits)) {
    result[entry.name] =
      entry.method === 0
        ? entry.data.slice()
        : entry.size === 0
          ? new Uint8Array(0)
          : inflateRaw(entry.data, entry.size);
  }
  return result;
}

/**
 * Async variant; inflates with the platform `DecompressionStream` when it is
 * available and falls back to the bundled inflater otherwise.
 */
export async function unzipEntriesAsync(
  bytes: Uint8Array,
  limits: ZipLimits
): Promise<Record<string, Uint8Array>> {
  const result = newEntryMap();
  for (const entry of readEntries(bytes, limits)) {
    result[entry.name] =
      entry.method === 0
        ? entry.data.slice()
        : entry.size === 0
          ? new Uint8Array(0)
          : await inflateRawAsync(entry.data, entry.size);
  }
  return result;
}

function readEndOfCentralDirectory(
  bytes: Uint8Array,
  view: DataView
): { entryCount: number; directoryOffset: number } {
  if (bytes.length < EOCD_MIN_SIZE) {
    throw new Error('Invalid ZIP: too short');
  }
  const lowest = Math.max(0, bytes.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);
  let eocd = bytes.length - EOCD_MIN_SIZE;
  while (eocd >= lowest && view.getUint32(eocd, true) !== EOCD_SIGNATURE) {
    eocd -= 1;
  }
  if (eocd < lowest) {
    throw new Error('Invalid ZIP: end of central directory not found');
  }
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) {
    throw new Error('Invalid ZIP: multi-disk archives are not supported');
  }

  let entryCount = view.getUint16(eocd + 10, true);
  let directoryOffset = view.getUint32(eocd + 16, true);

  if (
    (entryCount === 0xffff || directoryOffset === 0xffffffff) &&
    eocd >= 20 &&
    view.getUint32(eocd - 20, true) === EOCD64_LOCATOR_SIGNATURE
  ) {
    const recordOffset = toSafeNumber(view.getBigUint64(eocd - 20 + 8, true));
    requireRange(bytes, recordOffset, 56);
    if (view.getUint32(recordOffset, true) !== EOCD64_SIGNATURE) {
      throw new Error('Invalid ZIP: bad ZIP64 end of central directory');
    }
    entryCount = toSafeNumber(view.getBigUint64(recordOffset + 32, true));
    directoryOffset = toSafeNumber(view.getBigUint64(recordOffset + 48, true));
  }
  requireRange(bytes, directoryOffset, 0);
  return { entryCount, directoryOffset };
}

function readZip64Extra(
  view: DataView,
  start: number,
  length: number,
  needSize: boolean,
  needCompressed: boolean,
  needOffset: boolean
): { size?: number; compressedSize?: number; localOffset?: number } {
  const end = start + length;
  let position = start;
  while (position + 4 <= end) {
    const id = view.getUint16(position, true);
    const dataSize = view.getUint16(position + 2, true);
    position += 4;
    if (id === 0x0001) {
      let cursor = position;
      const result: { size?: number; compressedSize?: number; localOffset?: number } =
        {};
      const next = (): number => {
        if (cursor + 8 > position + dataSize) {
          throw new Error('Invalid ZIP: truncated ZIP64 extra field');
        }
        const value = toSafeNumber(view.getBigUint64(cursor, true));
        cursor += 8;
        return value;
      };
      if (needSize) result.size = next();
      if (needCompressed) result.compressedSize = next();
      if (needOffset) result.localOffset = next();
      return result;
    }
    position += dataSize;
  }
  throw new Error('Invalid ZIP: missing ZIP64 extra field');
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Invalid ZIP: value out of range');
  }
  return Number(value);
}

function requireRange(bytes: Uint8Array, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error('Invalid ZIP: truncated or out-of-range data');
  }
}

function decodeName(raw: Uint8Array, utf8: boolean): string {
  if (utf8) {
    return new TextDecoder().decode(raw);
  }
  let result = '';
  for (const byte of raw) {
    result += String.fromCharCode(byte);
  }
  return result;
}
