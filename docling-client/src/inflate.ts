/**
 * Minimal synchronous RFC 1951 (raw DEFLATE) decoder.
 *
 * The decoder is used to read resource bundles returned by presigned
 * artifacts, so the input must be treated as untrusted. The caller supplies
 * the exact expected output size (from the ZIP central directory); the
 * output buffer is allocated once at that size and the decoder fails rather
 * than writing, reading, or looping beyond any bound.
 */

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99,
  115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025,
  1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12,
  12, 13, 13,
];
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

const MAX_CODE_BITS = 15;

/**
 * Lookup table indexed by the next `bits` input bits (LSB first). Each entry
 * is `(symbol << 4) | codeLength`; a zero entry marks an unassigned code.
 */
interface HuffmanTable {
  readonly table: Uint16Array;
  readonly bits: number;
}

function buildHuffmanTable(lengths: Uint8Array, count: number): HuffmanTable {
  const counts = new Uint16Array(MAX_CODE_BITS + 1);
  let maxLength = 0;
  for (let symbol = 0; symbol < count; symbol += 1) {
    const length = lengths[symbol]!;
    counts[length] = (counts[length] ?? 0) + 1;
    if (length > maxLength) {
      maxLength = length;
    }
  }
  counts[0] = 0;

  let left = 1;
  for (let length = 1; length <= MAX_CODE_BITS; length += 1) {
    left = (left << 1) - counts[length]!;
    if (left < 0) {
      throw new Error('Invalid DEFLATE data: oversubscribed Huffman code');
    }
  }

  const table = new Uint16Array(1 << maxLength);
  const nextCode = new Uint16Array(MAX_CODE_BITS + 2);
  let code = 0;
  for (let length = 1; length <= MAX_CODE_BITS; length += 1) {
    code = (code + counts[length - 1]!) << 1;
    nextCode[length] = code;
  }

  for (let symbol = 0; symbol < count; symbol += 1) {
    const length = lengths[symbol]!;
    if (length === 0) {
      continue;
    }
    const assigned = nextCode[length]!;
    nextCode[length] = assigned + 1;
    let reversed = 0;
    for (let bit = 0; bit < length; bit += 1) {
      reversed |= ((assigned >> bit) & 1) << (length - 1 - bit);
    }
    const entry = (symbol << 4) | length;
    for (let index = reversed; index < table.length; index += 1 << length) {
      table[index] = entry;
    }
  }
  return { table, bits: maxLength };
}

let fixedTables: { literals: HuffmanTable; distances: HuffmanTable } | undefined;

function getFixedTables(): { literals: HuffmanTable; distances: HuffmanTable } {
  if (fixedTables === undefined) {
    const literalLengths = new Uint8Array(288);
    literalLengths.fill(8, 0, 144);
    literalLengths.fill(9, 144, 256);
    literalLengths.fill(7, 256, 280);
    literalLengths.fill(8, 280, 288);
    fixedTables = {
      literals: buildHuffmanTable(literalLengths, 288),
      distances: buildHuffmanTable(new Uint8Array(30).fill(5), 30),
    };
  }
  return fixedTables;
}

class Inflater {
  readonly #input: Uint8Array;
  readonly #output: Uint8Array;
  #position = 0;
  #outputPosition = 0;
  #bitBuffer = 0;
  #bitCount = 0;

  constructor(input: Uint8Array, outputSize: number) {
    this.#input = input;
    this.#output = new Uint8Array(outputSize);
  }

  run(): Uint8Array {
    let final = false;
    while (!final) {
      final = this.#readBits(1) === 1;
      const type = this.#readBits(2);
      if (type === 0) {
        this.#stored();
      } else if (type === 1) {
        const { literals, distances } = getFixedTables();
        this.#codes(literals, distances);
      } else if (type === 2) {
        this.#dynamic();
      } else {
        throw new Error('Invalid DEFLATE data: reserved block type');
      }
    }
    if (this.#outputPosition !== this.#output.length) {
      throw new Error('Invalid DEFLATE data: output is shorter than declared');
    }
    return this.#output;
  }

  #fill(needed: number): void {
    while (this.#bitCount < needed && this.#position < this.#input.length) {
      this.#bitBuffer |= this.#input[this.#position]! << this.#bitCount;
      this.#position += 1;
      this.#bitCount += 8;
    }
  }

  #readBits(count: number): number {
    if (count === 0) {
      return 0;
    }
    this.#fill(count);
    if (this.#bitCount < count) {
      throw new Error('Invalid DEFLATE data: unexpected end of input');
    }
    const value = this.#bitBuffer & ((1 << count) - 1);
    this.#bitBuffer >>>= count;
    this.#bitCount -= count;
    return value;
  }

  #decode(huffman: HuffmanTable): number {
    this.#fill(huffman.bits);
    const entry = huffman.table[this.#bitBuffer & ((1 << huffman.bits) - 1)]!;
    const length = entry & 15;
    if (length === 0 || length > this.#bitCount) {
      throw new Error('Invalid DEFLATE data: bad Huffman code');
    }
    this.#bitBuffer >>>= length;
    this.#bitCount -= length;
    return entry >> 4;
  }

  #stored(): void {
    // Drop partial-byte bits, then give back whole bytes held in the buffer.
    this.#position -= this.#bitCount >> 3;
    this.#bitBuffer = 0;
    this.#bitCount = 0;
    if (this.#position + 4 > this.#input.length) {
      throw new Error('Invalid DEFLATE data: unexpected end of input');
    }
    const length =
      this.#input[this.#position]! | (this.#input[this.#position + 1]! << 8);
    const inverse =
      this.#input[this.#position + 2]! | (this.#input[this.#position + 3]! << 8);
    if ((length ^ 0xffff) !== inverse) {
      throw new Error('Invalid DEFLATE data: stored block length mismatch');
    }
    this.#position += 4;
    if (
      this.#position + length > this.#input.length ||
      this.#outputPosition + length > this.#output.length
    ) {
      throw new Error('Invalid DEFLATE data: stored block out of bounds');
    }
    this.#output.set(
      this.#input.subarray(this.#position, this.#position + length),
      this.#outputPosition
    );
    this.#position += length;
    this.#outputPosition += length;
  }

  #dynamic(): void {
    const literalCount = this.#readBits(5) + 257;
    const distanceCount = this.#readBits(5) + 1;
    const codeLengthCount = this.#readBits(4) + 4;
    if (literalCount > 286 || distanceCount > 30) {
      throw new Error('Invalid DEFLATE data: too many length or distance codes');
    }

    const codeLengthLengths = new Uint8Array(19);
    for (let index = 0; index < codeLengthCount; index += 1) {
      codeLengthLengths[CODE_LENGTH_ORDER[index]!] = this.#readBits(3);
    }
    const codeLengthTable = buildHuffmanTable(codeLengthLengths, 19);

    const total = literalCount + distanceCount;
    const lengths = new Uint8Array(total);
    let index = 0;
    while (index < total) {
      const symbol = this.#decode(codeLengthTable);
      if (symbol < 16) {
        lengths[index] = symbol;
        index += 1;
        continue;
      }
      let repeat: number;
      let value = 0;
      if (symbol === 16) {
        if (index === 0) {
          throw new Error('Invalid DEFLATE data: repeat with no previous length');
        }
        value = lengths[index - 1]!;
        repeat = 3 + this.#readBits(2);
      } else if (symbol === 17) {
        repeat = 3 + this.#readBits(3);
      } else {
        repeat = 11 + this.#readBits(7);
      }
      if (index + repeat > total) {
        throw new Error('Invalid DEFLATE data: code length repeat overflows');
      }
      lengths.fill(value, index, index + repeat);
      index += repeat;
    }
    if (lengths[256] === 0) {
      throw new Error('Invalid DEFLATE data: missing end-of-block code');
    }

    this.#codes(
      buildHuffmanTable(lengths.subarray(0, literalCount), literalCount),
      buildHuffmanTable(lengths.subarray(literalCount), distanceCount)
    );
  }

  #codes(literals: HuffmanTable, distances: HuffmanTable): void {
    const output = this.#output;
    for (;;) {
      const symbol = this.#decode(literals);
      if (symbol < 256) {
        if (this.#outputPosition >= output.length) {
          throw new Error('Invalid DEFLATE data: output exceeds declared size');
        }
        output[this.#outputPosition] = symbol;
        this.#outputPosition += 1;
        continue;
      }
      if (symbol === 256) {
        return;
      }
      const lengthIndex = symbol - 257;
      if (lengthIndex >= 29) {
        throw new Error('Invalid DEFLATE data: bad length symbol');
      }
      const length =
        LENGTH_BASE[lengthIndex]! + this.#readBits(LENGTH_EXTRA[lengthIndex]!);
      const distanceIndex = this.#decode(distances);
      if (distanceIndex >= 30) {
        throw new Error('Invalid DEFLATE data: bad distance symbol');
      }
      const distance =
        DISTANCE_BASE[distanceIndex]! + this.#readBits(DISTANCE_EXTRA[distanceIndex]!);
      if (distance > this.#outputPosition) {
        throw new Error('Invalid DEFLATE data: distance too far back');
      }
      if (this.#outputPosition + length > output.length) {
        throw new Error('Invalid DEFLATE data: output exceeds declared size');
      }
      let from = this.#outputPosition - distance;
      for (let copied = 0; copied < length; copied += 1) {
        output[this.#outputPosition] = output[from]!;
        this.#outputPosition += 1;
        from += 1;
      }
    }
  }
}

/**
 * Inflate a raw DEFLATE stream whose decompressed size is known exactly.
 * Throws if the stream is malformed or does not decode to `outputSize` bytes.
 */
export function inflateRaw(input: Uint8Array, outputSize: number): Uint8Array {
  return new Inflater(input, outputSize).run();
}

/**
 * Like {@link inflateRaw}, but uses the platform `DecompressionStream`
 * ("deflate-raw") when available (browsers, Node >= 20) and falls back to the
 * bundled decoder otherwise (e.g. Node 18). Output is bounded by `outputSize`
 * either way: the stream is cancelled as soon as it produces more than that.
 */
export async function inflateRawAsync(
  input: Uint8Array,
  outputSize: number
): Promise<Uint8Array> {
  let decompressor: DecompressionStream;
  try {
    decompressor = new DecompressionStream('deflate-raw');
  } catch {
    // Missing global (ReferenceError) or unsupported format (TypeError).
    return inflateRaw(input, outputSize);
  }

  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(input.slice());
      controller.close();
    },
  });
  const reader = source.pipeThrough(decompressor).getReader();
  const output = new Uint8Array(outputSize);
  let written = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (written + value.length > outputSize) {
        throw new Error('Invalid DEFLATE data: output exceeds declared size');
      }
      output.set(value, written);
      written += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (written !== outputSize) {
    throw new Error('Invalid DEFLATE data: output is shorter than declared');
  }
  return output;
}
