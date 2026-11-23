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

describe('doclang <track>', () => {
  const read = (xml: string, extra: Record<string, unknown> = {}) => {
    const warnings: string[] = [];
    const doc = deserializeDocLang(`<doclang>${xml}</doclang>`, {
      DOMParser,
      onWarning: m => warnings.push(m),
      ...extra,
    });
    return { doc, warnings };
  };
  type Node = { self_ref: string; text?: string; source?: unknown[] };
  /** The cues of a track as Python's `_cues`: (kind, text, start, end, voice). */
  const cues = (
    doc: ReturnType<typeof deserializeDocLang>,
    index = 0
  ): [string, string, number, number, string | undefined][] => {
    const all: Node[] = [...(doc.texts ?? []), ...(doc.pictures ?? [])];
    return (doc.tracks?.[index].children ?? []).map(({ $ref }) => {
      const item = all.find(n => n.self_ref === $ref)!;
      const src = item.source![0] as {
        start_time: number;
        end_time: number;
        voice?: string;
      };
      return [
        $ref.startsWith('#/pictures') ? 'PictureItem' : 'TextItem',
        item.text ?? '',
        src.start_time,
        src.end_time,
        src.voice,
      ];
    });
  };

  it('reads timestamp runs, instants, voices and an empty voice', () => {
    const { doc, warnings } = read(
      '<track>' +
        "<bdiv/><seconds value='2'/>Hello, and welcome." +
        "<bdiv/><minutes value='0'/><seconds value='2'/><msecs value='500'/><minutes value='0'/><seconds value='7'/>" +
        '<voice>John</voice>Hi Mary!<voice><italic>Mary</italic></voice><bold>Hello</bold> John!' +
        "<bdiv/><minutes value='59'/><seconds value='58'/><msecs value='450'/>" +
        "<hours value='1'/><minutes value='0'/><seconds value='1'/><msecs value='210'/>" +
        '<voice>Narrator</voice>The results.<voice/>laughter' +
        '</track>'
    );
    expect(warnings).toEqual([]);
    expect(doc.tracks).toHaveLength(1);
    expect(doc.tracks?.[0].label).toBe('track');
    expect(cues(doc)).toEqual([
      ['TextItem', 'Hello, and welcome.', 2, 2, undefined],
      ['TextItem', 'Hi Mary!', 2.5, 7, 'John'],
      ['TextItem', 'Hello John!', 2.5, 7, 'Mary'],
      ['TextItem', 'The results.', 3598.45, 3601.21, 'Narrator'],
      ['TextItem', 'laughter', 3598.45, 3601.21, undefined],
    ]);
    expect(doc.texts?.[0].source?.[0]).toEqual({
      kind: 'track',
      start_time: 2,
      end_time: 2,
    });
  });

  it('adds the track to the body and parents its cues to the track', () => {
    const { doc } = read(
      "<text>a</text><track><bdiv/><seconds value='1'/>cue</track>"
    );
    expect(doc.body.children.map(c => c.$ref)).toEqual([
      '#/texts/0',
      '#/tracks/0',
    ]);
    expect(doc.texts?.[1].parent?.$ref).toBe('#/tracks/0');
  });

  it('skips <chapter> and <audio> with a warning and keeps the cue', () => {
    const { doc, warnings } = read(
      "<track><bdiv/><seconds value='0'/><seconds value='5'/><chapter>Introduction</chapter>" +
        '<frame/><audio/>Welcome.</track>'
    );
    expect([...warnings].sort()).toEqual([
      '<audio> in <track> is not supported yet; skipped',
      '<chapter> in <track> is not supported yet; skipped',
    ]);
    expect(cues(doc)).toEqual([
      ['PictureItem', '', 0, 0, undefined],
      ['TextItem', 'Welcome.', 0, 5, undefined],
    ]);
  });

  it('keeps turns without text: empty block, bare voice, empty voice', () => {
    const { doc } = read(
      "<track><bdiv/><seconds value='1'/>" +
        "<bdiv/><seconds value='2'/><voice>Host</voice>" +
        "<bdiv/><seconds value='3'/>Hi<voice/></track>"
    );
    expect(cues(doc)).toEqual([
      ['TextItem', '', 1, 1, undefined],
      ['TextItem', '', 2, 2, 'Host'],
      ['TextItem', 'Hi', 3, 3, undefined],
      ['TextItem', '', 3, 3, undefined],
    ]);
  });

  it('gives the cues the layer of their track', () => {
    const { doc } = read(
      "<track><layer value='furniture'/><bdiv/><seconds value='0'/>hi</track>"
    );
    expect(doc.tracks?.[0].content_layer).toBe('furniture');
    expect(doc.texts?.[0].content_layer).toBe('furniture');
  });

  it.each(['x', '-5', '1.5'])(
    'skips only the cue block with the invalid timestamp %j',
    value => {
      const { doc, warnings } = read(
        `<track><bdiv/><seconds value="${value}"/>bad` +
          '<bdiv/><seconds value="2"/>good</track>'
      );
      expect(doc.texts?.map(t => t.text)).toEqual(['good']);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('invalid <seconds> value');
    }
  );

  it('warns about a block without a start time and reads an end before the start as an instant', () => {
    const { doc, warnings } = read(
      '<track><bdiv/>no time' +
        "<bdiv/><seconds value='5'/><seconds value='2'/>back</track>"
    );
    expect(warnings).toEqual([
      '<track> cue block without a start time; skipped',
      '<track> cue block ends before it starts; read as an instant',
    ]);
    expect(cues(doc)).toEqual([['TextItem', 'back', 5, 5, undefined]]);
  });

  it('reads non-ASCII digit values like Python', () => {
    const { doc, warnings } = read(
      "<track><bdiv/><seconds value='٣'/>arabic-indic</track>"
    );
    expect(warnings).toEqual([]);
    expect(cues(doc)).toEqual([['TextItem', 'arabic-indic', 3, 3, undefined]]);
  });

  it('reads the frame and cover images through resolveImage', () => {
    const img = (uri: string) => ({
      mimetype: 'image/png',
      dpi: 72,
      size: { width: 16, height: 9 },
      uri,
    });
    const { doc } = read(
      '<track><cover><src uri="poster.png"/></cover>' +
        '<bdiv/><seconds value="0"/><frame><src uri="frame_0.png"/></frame>Hi</track>',
      { resolveImage: img }
    );
    expect(doc.tracks?.[0].image).toEqual(img('poster.png'));
    expect(doc.pictures?.[0].image).toEqual(img('frame_0.png'));
    expect(doc.pictures?.[0].source).toEqual([
      { kind: 'track', start_time: 0, end_time: 0 },
    ]);
    expect(doc.pictures?.[0].parent?.$ref).toBe('#/tracks/0');
  });

  it('ignores the frame and cover images without resolveImage', () => {
    const { doc } = read(
      '<track><cover><src uri="poster.png"/></cover>' +
        '<bdiv/><seconds value="0"/><frame><src uri="frame_0.png"/></frame></track>'
    );
    expect(doc.tracks?.[0].image).toBeUndefined();
    expect(doc.pictures?.[0].image).toBeUndefined();
  });

  it('reads the location and the caption of a track', () => {
    const { doc } = read(
      '<page_break/><track><caption>Talk title</caption>' +
        '<location value="1"/><location value="2"/><location value="3"/><location value="4"/>' +
        '<bdiv/><seconds value="1"/>cue</track>'
    );
    const track = doc.tracks?.[0];
    expect(track?.prov).toHaveLength(1);
    expect(track?.prov?.[0].page_no).toBe(2);
    expect(track?.captions).toHaveLength(1);
    expect(doc.texts?.find(t => t.label === 'caption')?.text).toBe(
      'Talk title'
    );
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
  it('labels handwriting runs within text, matching Python', () => {
    const doc = read('<text>Check <handwriting>out</handwriting> these</text>');
    expect(doc.texts?.filter(t => t.text).map(t => [t.text, t.label])).toEqual([
      ['Check ', 'text'],
      ['out', 'handwritten_text'],
      [' these', 'text'],
    ]);
  });
  it('keeps handwriting host labels except for <text>', () => {
    const doc = read(
      '<text><handwriting>a</handwriting></text>' +
        '<footnote><handwriting>a</handwriting></footnote>' +
        '<caption><handwriting>a</handwriting></caption>' +
        '<page_header><handwriting>a</handwriting></page_header>' +
        '<page_footer><handwriting>a</handwriting></page_footer>'
    );
    expect(doc.texts?.map(t => t.label)).toEqual([
      'handwritten_text',
      'footnote',
      'caption',
      'page_header',
      'page_footer',
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

describe('doclang hyperlinks', () => {
  const read = (xml: string) =>
    deserializeDocLang(`<doclang version="0.9">${xml}</doclang>`, {
      DOMParser,
    });
  const runs = (xml: string) =>
    read(xml)
      .texts?.filter(t => t.text)
      .map(t => [t.text, t.hyperlink ?? null]);

  it('reads an href as the target of the whole element', () => {
    expect(
      runs(
        '<text><href uri="https://example.com/?a=1&amp;b=2#part"/>linked</text>'
      )
    ).toEqual([['linked', 'https://example.com/?a=1&b=2#part']]);
  });
  it('lets runs inherit the href of their enclosing element', () => {
    expect(
      runs(
        '<text><href uri="https://example.com/"/>before <bold>linked</bold> after</text>'
      )
    ).toEqual([
      ['before ', 'https://example.com/'],
      ['linked', 'https://example.com/'],
      [' after', 'https://example.com/'],
    ]);
  });
  it('prefers the nearest href', () => {
    expect(
      runs(
        '<text><href uri="https://example.com/outer"/>before <text><href uri="https://example.com/inner"/>inner</text> after</text>'
      )
    ).toEqual([
      ['before ', 'https://example.com/outer'],
      ['inner', 'https://example.com/inner'],
      [' after', 'https://example.com/outer'],
    ]);
  });
  it('does not link the runs around a linked nested element', () => {
    expect(
      runs(
        '<text>before <text><href uri="https://example.com/"/>linked</text> after</text>'
      )
    ).toEqual([
      ['before ', null],
      ['linked', 'https://example.com/'],
      [' after', null],
    ]);
  });
  it('keeps relative targets and fragments as paths', () => {
    expect(runs('<text><href uri="../guide.md#example"/>a</text>')).toEqual([
      ['a', '../guide.md#example'],
    ]);
    expect(runs('<text><href uri="#details"/>a</text>')).toEqual([
      ['a', '#details'],
    ]);
    expect(
      runs('<text><href uri="mailto:maintainer@example.com"/>a</text>')
    ).toEqual([['a', 'mailto:maintainer@example.com']]);
  });
  it('links code, formulas, list items and captions', () => {
    const doc = read(
      '<code><href uri="https://example.com/c"/>x = 1</code>' +
        '<formula><href uri="https://example.com/f"/>E=mc^2</formula>' +
        '<list><ldiv/><text><href uri="https://example.com/l"/>item</text></list>' +
        '<picture><caption><href uri="https://example.com/p"/>cap</caption></picture>'
    );
    expect(doc.texts?.map(t => [t.label, t.hyperlink])).toEqual([
      ['code', 'https://example.com/c'],
      ['formula', 'https://example.com/f'],
      ['list_item', 'https://example.com/l'],
      ['caption', 'https://example.com/p'],
    ]);
  });
  it('keeps a flattened heading link on the heading alone', () => {
    const doc = read(
      '<heading level="2"><href uri="https://example.com/"/>a <formula>x</formula></heading>'
    );
    expect(doc.texts?.map(t => [t.label, t.text, t.hyperlink])).toEqual([
      ['section_header', 'a x', 'https://example.com/'],
    ]);
  });
  it('moves a heading with linked runs into those runs', () => {
    const doc = read(
      '<heading level="1"><text><href uri="https://example.com/a"/>a </text><text><href uri="https://example.com/b"/>b</text></heading>'
    );
    const [title, ...rest] = doc.texts ?? [];
    expect([title.label, title.text, title.hyperlink]).toEqual([
      'title',
      '',
      undefined,
    ]);
    expect(rest.map(t => [t.text, t.hyperlink])).toEqual([
      ['a ', 'https://example.com/a'],
      ['b', 'https://example.com/b'],
    ]);
    expect(doc.groups?.[0].parent?.$ref).toBe(title.self_ref);
  });
});
