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
  it('enforces the size, depth and element budgets', () => {
    const deep = wrap('<group>'.repeat(5) + '</group>'.repeat(5));
    expect(() => deserializeDocLang(deep, { ...opts, maxDepth: 3 })).toThrow(
      'nesting depth limit of 3'
    );
    expect(() =>
      deserializeDocLang(wrap('<text/><text/><text/>'), {
        ...opts,
        maxElements: 3,
      })
    ).toThrow('element count limit of 3');
    expect(() =>
      deserializeDocLang(wrap('x'.repeat(100)), { ...opts, maxXmlBytes: 64 })
    ).toThrow('size limit of 64 bytes');
    // The limit counts UTF-8 bytes, not characters.
    expect(() =>
      deserializeDocLang(wrap('é'.repeat(20)), { ...opts, maxXmlBytes: 40 })
    ).toThrow('size limit');
  });
  it('rejects non-positive budgets', () => {
    for (const k of ['maxXmlBytes', 'maxDepth', 'maxElements'])
      expect(() => deserializeDocLang(wrap(''), { ...opts, [k]: 0 })).toThrow(
        'must be positive'
      );
  });
  it.each([
    'Wiley & Sons',
    '$q < 0$ and p <0.05',
    'x]]> y',
    'a\u0018b',
    '<![CDATA[a & b < c]]> & d',
  ])('rejects unescaped text by default: %j', text => {
    expect(() =>
      deserializeDocLang(wrap(`<text>${text}</text>`), opts)
    ).toThrow('Invalid DocLang XML');
  });
});

describe('repairUnescapedText', () => {
  const run = (text: string) =>
    deserializeDocLang(`<doclang><text>${text}</text></doclang>`, {
      DOMParser,
      repairUnescapedText: true,
    }).texts.map(t => t.text);

  it('escapes bare ampersands and angle brackets', () => {
    expect(run('Wiley & Sons')).toEqual(['Wiley & Sons']);
    expect(run('$q < 0$ and p <0.05 and $a<\\ln b$')).toEqual([
      '$q < 0$ and p <0.05 and $a<\\ln b$',
    ]);
  });
  it('keeps existing references and CDATA', () => {
    // CDATA stays a node of its own, so it is a separate run (as in Python).
    expect(run('a &amp; b &#65; &#x42; <![CDATA[c & <d>]]> & e')).toEqual([
      'a & b A B ',
      'c & <d>',
      ' & e',
    ]);
  });
  it('escapes a stray ]]> and drops illegal control characters', () => {
    expect(run('x]]> y')).toEqual(['x]]> y']);
    expect(run('a\u0018b')).toEqual(['ab']);
  });
  it('never guesses tag structure', () => {
    expect(() => run('a <b c')).toThrow('Invalid DocLang XML');
  });
});

describe('doclang warnings', () => {
  it('skips <track> with all its content, with a warning', () => {
    const seen: string[] = [];
    const doc = deserializeDocLang(
      '<doclang><text>a</text><track><voice>v</voice><text>b</text></track><text>c</text></doclang>',
      { DOMParser, onWarning: m => seen.push(m) }
    );
    expect(doc.texts?.map(t => t.text)).toEqual(['a', 'c']);
    expect(seen).toEqual([
      '<track> is not supported yet; skipped with all its content',
    ]);
  });
});

describe('inline whitespace contract', () => {
  const read = (xml: string) =>
    deserializeDocLang(`<doclang>${xml}</doclang>`, { DOMParser });

  it('keeps boundary spaces on the runs of an inline group', () => {
    const doc = read('<text>mixed <bold>bold</bold> text</text>');
    expect(doc.groups?.map(g => g.label)).toEqual(['inline']);
    expect(doc.texts?.map(t => t.text)).toEqual(['mixed ', 'bold', ' text']);
    expect(doc.texts?.[1].formatting?.bold).toBe(true);
  });
  it('accumulates formatting through nested runs', () => {
    const doc = read('<text><bold>a <italic>b</italic></bold> c</text>');
    const [a, b, c] = doc.texts ?? [];
    expect([a.text, a.formatting?.bold, a.formatting?.italic]).toEqual([
      'a ',
      true,
      false,
    ]);
    expect([b.text, b.formatting?.bold, b.formatting?.italic]).toEqual([
      'b',
      true,
      true,
    ]);
    expect(c.formatting).toBeUndefined();
  });
  it('collapses whitespace per the spec and drops it at block edges', () => {
    const doc = read('<text>\n  a \t\n b  </text>');
    expect(doc.texts?.map(t => t.text)).toEqual(['a b']);
  });
  it('keeps <content> literal', () => {
    const doc = read('<text><content>  a  </content></text>');
    expect(doc.texts?.map(t => t.text)).toEqual(['  a  ']);
  });
  it('takes a checkbox text verbatim', () => {
    const doc = read('<text><checkbox class="selected"/> yes</text>');
    expect(doc.texts?.map(t => [t.label, t.text])).toEqual([
      ['checkbox_selected', ' yes'],
    ]);
  });
  it('yields an empty item for an empty text-like element', () => {
    const doc = read('<text/><formula/><code/>');
    expect(doc.texts?.map(t => [t.label, t.text])).toEqual([
      ['text', ''],
      ['formula', ''],
      ['code', ''],
    ]);
  });
  it('makes mixed-content hosts empty items holding an inline group', () => {
    const doc = read(
      '<footnote><layer value="furniture"/>x <bold>y</bold></footnote>'
    );
    expect(doc.texts?.map(t => [t.label, t.text, t.content_layer])).toEqual([
      ['footnote', '', 'furniture'],
      ['text', 'x ', 'furniture'],
      ['text', 'y', 'furniture'],
    ]);
    expect(doc.groups?.[0].content_layer).toBe('furniture');
  });
});

describe('doclang models', () => {
  const read = (xml: string) =>
    deserializeDocLang(`<doclang>${xml}</doclang>`, { DOMParser });

  it('honours a non-square default resolution', () => {
    const doc = read(
      '<head><default_resolution width="800" height="600"/></head><text>a</text><page_break/>'
    );
    expect(doc.pages?.['1'].size).toEqual({ width: 800, height: 600 });
    expect(doc.pages?.['2'].size).toEqual({ width: 800, height: 600 });
  });
  it('reads nested and repeated custom fields', () => {
    const doc = read(
      '<text><custom><acme__a><x>1</x><y>2</y><y>3</y></acme__a><acme__b>p</acme__b><acme__b>q</acme__b></custom>t</text>'
    );
    const meta = doc.texts?.[0].meta as Record<string, unknown>;
    expect(meta.acme__a).toEqual({ x: '1', y: ['2', '3'] });
    expect(meta.acme__b).toEqual(['p', 'q']);
  });
  it('threads text, merging charspans', () => {
    const doc = read(
      '<text><thread thread_id="t"/>ab</text><text><thread thread_id="t"/>cd</text>'
    );
    expect(doc.texts).toHaveLength(1);
    expect(doc.texts?.[0].text).toBe('abcd');
  });
});
