import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { deserializeDocLang } from '../src/doclang';

const ROOT = join(__dirname, 'data/doclang');

// Python prints these as floats (`10.0`); JS has a single number type.
const FLOATS = new Set(['l', 't', 'r', 'b', 'width', 'height', 'confidence']);

/** `json.dumps(obj, indent=2, ensure_ascii=True)`. */
function dumps(v: unknown, key = '', pad = ''): string {
  if (typeof v === 'number') {
    return FLOATS.has(key) && Number.isInteger(v) ? v.toFixed(1) : String(v);
  }
  if (typeof v === 'string') {
    return JSON.stringify(v).replace(
      /[\u007f-\uffff]/g,
      c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  }
  const inner = `${pad}  `;
  if (Array.isArray(v)) {
    return v.length
      ? `[\n${v.map(x => inner + dumps(x, key, inner)).join(',\n')}\n${pad}]`
      : '[]';
  }
  if (v && typeof v === 'object') {
    const e = Object.entries(v).filter(([, x]) => x !== undefined);
    return e.length
      ? `{\n${e
          .map(([k, x]) => `${inner}"${k}": ${dumps(x, k, inner)}`)
          .join(',\n')}\n${pad}}`
      : '{}';
  }
  return JSON.stringify(v);
}

describe('doclang deserializer', () => {
  for (const name of readdirSync(ROOT)) {
    it(`matches Python output: ${name}`, () => {
      const read = (f: string) => readFileSync(join(ROOT, name, f), 'utf8');
      const doc = deserializeDocLang(read('in.xml'), { DOMParser });
      expect(dumps(doc)).toBe(read('expected.json'));
    });
  }
});

describe('doclang errors', () => {
  const opts = { DOMParser };
  const wrap = (x: string) => `<doclang>${x}</doclang>`;

  it('rejects a class on <table>, like Python', () => {
    expect(() =>
      deserializeDocLang(wrap('<table class="x"><fcel/>a</table>'), opts)
    ).toThrow('must not have a class');
  });
  it('rejects malformed XML', () => {
    expect(() => deserializeDocLang('<doclang><text></doclang>', opts)).toThrow(
      'Invalid DocLang XML'
    );
  });
  it('needs a DOMParser outside the browser', () => {
    expect(() => deserializeDocLang(wrap(''))).toThrow('no DOMParser');
  });
  it('enforces the depth and element budgets', () => {
    const deep = wrap('<group>'.repeat(5) + '</group>'.repeat(5));
    expect(() => deserializeDocLang(deep, { ...opts, maxDepth: 3 })).toThrow(
      'deeper'
    );
    expect(() =>
      deserializeDocLang(wrap('<text/><text/><text/>'), {
        ...opts,
        maxElements: 3,
      })
    ).toThrow('more than 3');
  });
});
