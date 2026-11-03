/**
 * DocLang -> DoclingDocument. A port of docling-core's `DocLangDocDeserializer`
 * that works directly on DOM nodes.
 */
import type {
  AnyTableCell,
  BoundingBox,
  CodeItem,
  CodeLanguageLabel,
  ContentLayer,
  FloatingItem,
  Formatting,
  GroupLabel,
  ImageRef,
  NodeItem,
  ProvenanceItem,
  RefItem,
  TableItem,
} from '../types';
import {
  Doc,
  type FullTableData,
  type TextItemLike,
  type TextLabel,
  cell,
  floating,
  fmt,
  metaOf,
  range,
  tableData,
} from './doc';
import {
  GROUP_LABELS,
  LAYERS,
  codeLang,
  isBlock,
  isFieldInline,
  isHead,
  isInline,
  isOtsl,
  own,
  tags,
} from './vocab';
import {
  type XEl,
  type XNode,
  attr,
  blank,
  data,
  elems,
  isEl,
  isText,
  kids,
  toXml,
} from './xml';

type P = NodeItem | undefined; // parent (undefined = body)
type Part = string | XEl; // OTSL body: text runs and elements

const isLoc = tags('location');
const isContent = tags('content');
const isCheckbox = tags('checkbox');
const isHandwriting = tags('handwriting');
const isLocLayer = tags('location layer');
const isNested = tags('list picture'); // may nest under a list item
const isTableHost = tags('table index');
const isSkipped = tags('head location layer label custom caption src');
const isPicture = tags('picture');
const isChart = tags('tabular src');

const len = (s: string) => [...s].length; // Python counts code points
const num = (s: string, dflt = 0) => {
  const n = Number(s || dflt);
  return Number.isInteger(n) ? n : dflt;
};
const ref = (item: NodeItem): RefItem => ({ $ref: item.self_ref });
const child = (el: XEl, tag: string) => elems(el).find(c => c.tagName === tag);

/** Attribute values of the `<tag>` elements among `nodes`. */
const attrs = (nodes: unknown[], tag: string, name = 'value') =>
  nodes
    .filter(isEl)
    .filter(n => n.tagName === tag)
    .map(n => attr(n, name));

/** Coordinates of the `<location>` elements among `nodes`. */
const coords = (nodes: unknown[]) => attrs(nodes, 'location').map(s => num(s));

const bbox = ([a, b, c, d]: number[]): BoundingBox => ({
  l: Math.min(a, c),
  t: Math.min(b, d),
  r: Math.max(a, c),
  b: Math.max(b, d),
  coord_origin: 'TOPLEFT',
});
const prov = (
  page_no: number,
  box: BoundingBox,
  charspan: [number, number] = [0, 0]
): ProvenanceItem => ({ page_no, bbox: box, charspan });

/** Provenance list whose first entry spans the whole `text`. */
const provFor = (text: string, ps: ProvenanceItem[]): ProvenanceItem[] =>
  ps.map((p, i) => (i ? p : { ...p, charspan: [0, len(text)] }));

/** Split an element's children into its head (location, layer, ...) and body. */
function split(el: XEl): [XNode[], XNode[]] {
  const ns = kids(el);
  const i = ns.findIndex(n => !blank(n) && !isHead(n));
  return i < 0 ? [ns, []] : [ns.slice(0, i), ns.slice(i)];
}
const headOf = (el: XEl) => split(el)[0];

const threadIdOf = (nodes: XNode[]) =>
  attrs(nodes, 'thread', 'thread_id').find(Boolean) ?? '';
const layerOf = (nodes: XNode[]) =>
  attrs(nodes, 'layer').find(v => LAYERS.has(v)) as ContentLayer | undefined;
const labelOf = (nodes: XNode[]) => attrs(nodes, 'label').find(Boolean);

/** Text under `el`: `<br>` is a newline, `skip`ped elements are ignored. */
const textUnder = (
  el: XEl,
  skip: (n: XEl) => boolean,
  keep: (s: string) => string
): string =>
  kids(el)
    .map(n =>
      isText(n)
        ? data(n).trim()
          ? keep(data(n))
          : ''
        : isEl(n) && !skip(n)
          ? n.tagName === 'br'
            ? '\n'
            : getText(n)
          : ''
    )
    .join('');
const getText = (el: XEl): string =>
  textUnder(el, isLoc, isContent(el) ? s => s : s => s.trim());

/** Raw text of a text node or `<content>` element. */
const raw = (n: XNode) => (isText(n) ? data(n) : getText(n as XEl));

/** The single text run of an element made only of inline markup, else null. */
function simpleText(el: XEl): string | null {
  let result: string | null = null;
  for (const n of kids(el)) {
    if (isEl(n)) {
      if (isHead(n)) continue;
      if (!isInline(n)) return null;
      result = simpleText(n) || result;
    } else if (isText(n) && data(n).trim()) {
      if (result !== null) return null;
      result = isContent(el) ? data(n) : data(n).trim();
    }
  }
  return result;
}

const FORMAT: Record<string, Partial<Formatting>> = {
  bold: { bold: true },
  italic: { italic: true },
  underline: { underline: true },
  strikethrough: { strikethrough: true },
  subscript: { script: 'sub' },
  superscript: { script: 'super' },
  rtl: {},
};

/** Text plus formatting, when the element wraps a single formatting child. */
function textFmt(el: XEl): [string, Formatting | undefined] {
  const only = elems(el).filter(c => !isLoc(c));
  const f = only.length === 1 ? own(FORMAT, only[0].tagName) : undefined;
  if (!f) return [getText(el), undefined];
  const [text, inner] = textFmt(only[0]);
  return [text, Object.assign(inner ?? fmt(), f)];
}

const TEXT_LABEL: Record<string, TextLabel> = {
  text: 'text',
  caption: 'caption',
  footnote: 'footnote',
  page_header: 'page_header',
  page_footer: 'page_footer',
  ...Object.fromEntries(
    [...Object.keys(FORMAT), 'content'].map(t => [t, 'text'])
  ),
};
/** Tags handled as text items (`ldiv` yields none, but must not be walked). */
const TEXT_TAGS = [...Object.keys(TEXT_LABEL), 'code', 'formula', 'ldiv'];

const checkboxLabel = (selected: boolean): TextLabel =>
  selected ? 'checkbox_selected' : 'checkbox_unselected';

/** Item label of a text-like element (`undefined` for `<ldiv>`). */
function textLabel(el: XEl): TextLabel | undefined {
  if (el.tagName === 'code' || el.tagName === 'formula') return el.tagName;
  if (el.tagName !== 'text') return own(TEXT_LABEL, el.tagName);
  const es = elems(el);
  const box = es.find(
    c => isCheckbox(c) && ['selected', 'unselected'].includes(attr(c, 'class'))
  );
  return es.some(isHandwriting)
    ? 'handwritten_text'
    : box
      ? checkboxLabel(attr(box, 'class') === 'selected')
      : 'text';
}

const isCodeSkip = tags('location layer label caption');
/** Code text and its language label. */
const codeContent = (el: XEl): [string, CodeLanguageLabel] => [
  textUnder(el, isCodeSkip, s => s),
  codeLang(attrs(elems(el), 'label')[0] ?? ''),
];

/** Is the content after an `<ldiv>` virtual text (vs. real child elements)? */
function isVirtualText(nodes: XNode[]): boolean {
  const first = nodes.find(n => !blank(n));
  return (
    !!first &&
    (isText(first) || (isEl(first) && (isHead(first) || !isBlock(first))))
  );
}

/** The one float inside an unnamed `<group>` that only adds notes. */
function floatHost(el: XEl) {
  const isHost = tags('picture table index code');
  const isNote = tags('text footnote caption');
  const hosts = elems(el).filter(isHost);
  return hosts.length === 1 && elems(el).every(c => isHost(c) || isNote(c))
    ? hosts[0]
    : undefined;
}

/** OTSL body nodes -> text runs and elements; `<content>` is flattened. */
function otslParts(nodes: XNode[]): Part[] {
  const out: Part[] = [];
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = '';
  };
  const walk = (ns: XNode[]) =>
    ns.forEach(n => {
      if (isText(n)) buf += data(n);
      else if (isEl(n) && isContent(n)) walk(kids(n));
      else if (isEl(n)) {
        flush();
        out.push(n);
      }
    });
  walk(nodes);
  flush();
  return out;
}
const tok = (p?: Part) => (isEl(p) && isOtsl(p) ? p.tagName : undefined);

const RIGHT = ['lcel', 'xcel'];
const DOWN = ['ucel', 'xcel'];
const SPAN = ['lcel', 'ucel', 'xcel'];
const NOTE: Record<string, 'caption' | 'footnote'> = {
  text: 'caption',
  footnote: 'footnote',
};
const CUSTOM_META: Record<string, string> = {
  docling__summary: 'summary',
  docling__description: 'description',
  docling__smiles: 'molecule',
};

export class Reader {
  doc = new Doc();
  private w = 512;
  private h = 512;
  private threads = new Map<string, NodeItem>();

  constructor(
    private page: number,
    private resolveImage?: (uri: string) => ImageRef
  ) {}

  run(root: XEl) {
    const res = root.getElementsByTagName('default_resolution')[0];
    const dim = (k: string, d: number) => {
      const v = res ? num(attr(res, k)) : 0;
      return v > 0 ? v : d;
    };
    this.w = dim('width', this.w);
    this.h = dim('height', this.h);
    this.ensurePage();
    elems(root).forEach(el => this.dispatch(el, undefined));
    return this.doc.toJSON();
  }

  private ensurePage() {
    this.doc.pages[this.page] ??= {
      size: { width: this.w, height: this.h },
      page_no: this.page,
    };
  }

  /** Provenance boxes from consecutive groups of four `<location>`s. */
  private provs(nodes: unknown[]): ProvenanceItem[] {
    const v = coords(nodes);
    return range(Math.floor(v.length / 4)).map(i =>
      prov(this.page, bbox(v.slice(4 * i, 4 * i + 4)))
    );
  }

  /** Append a threaded fragment to an existing text-like item. */
  private append(item: TextItemLike, text: string, ps: ProvenanceItem[]) {
    const at = len(item.orig);
    item.text += text;
    item.orig += text;
    const target = (item.prov ??= []);
    ps.forEach(p => target.push(prov(p.page_no, p.bbox, [at, at + len(text)])));
  }

  /** The thread's earlier item, if this element continues one. */
  private thread<T extends NodeItem>(el: XEl, nodes: XNode[] = headOf(el)) {
    const id = threadIdOf(nodes);
    const key = `${id}:${el.tagName}`;
    return {
      id,
      existing: id ? (this.threads.get(key) as T | undefined) : undefined,
      register: (item: T) => {
        if (id) this.threads.set(key, item);
        return item;
      },
    };
  }

  /** One handler per distinct kind of element. */
  private readonly tag = {
    page_break: (): void => {
      this.page++;
      this.ensurePage();
    },

    text: (el: XEl, parent: P): void => {
      const head = headOf(el);
      const { id, existing, register } = this.thread<TextItemLike>(el, head);
      if (
        elems(el).filter(c => !isHead(c)).length > 1 ||
        (simpleText(el) === null && !id)
      )
        return this.inline(el, parent);

      const provs = this.provs(head);
      const [plain, f0] = textFmt(el);
      if (!plain) {
        if (existing && provs.length) this.append(existing, '', provs);
        return;
      }
      const label = textLabel(el);
      if (!label) return; // <ldiv>

      const isCode = label === 'code';
      const [text, code_language] = isCode
        ? codeContent(el)
        : [plain, undefined];
      if (isCode && !text.trim()) return;
      if (existing) return this.append(existing, text, provs);

      const layer = layerOf(head);
      const f = own(FORMAT, el.tagName);
      const formatting =
        f && Object.keys(f).length ? Object.assign(f0 ?? fmt(), f) : f0;

      // Python passes neither formatting to code nor a layer to formulae.
      const extra = isCode
        ? { layer, ...floating(), code_language }
        : label === 'formula'
          ? { formatting }
          : { layer, formatting };
      const item = this.doc.text(label, text, {
        parent,
        prov: provFor(text, provs),
        ...extra,
      });
      if (isCode) {
        const cap = this.caption(el);
        if (cap) this.attach(item as CodeItem, [[cap], []]);
      }
      register(item);
      this.applyMeta(item, head);
    },

    heading: (el: XEl, parent: P): void => {
      const field = el.tagName === 'field_heading';
      const level = num(attr(el, 'level'), 1);
      const text = getText(el).trim();
      if (!text) return;
      const head = headOf(el);
      const { existing, register } = this.thread<TextItemLike>(el, head);
      const provs = this.provs(head);
      if (existing) return this.append(existing, text, provs);
      const item = this.doc.text(
        field ? 'field_heading' : level === 1 ? 'title' : 'section_header',
        text,
        {
          parent,
          layer: layerOf(head),
          prov: provFor(text, provs),
          ...(field ? { level } : level === 1 ? {} : { level: level - 1 }),
        }
      );
      register(item);
      if (!field) this.applyMeta(item, head);
    },

    list: (el: XEl, parent: P): void => {
      const ordered = attr(el, 'class') === 'ordered';
      const { existing, register } = this.thread<NodeItem>(el, elems(el));
      const group =
        existing ?? register(this.doc.group('list', undefined, parent));

      // One segment per <ldiv>: the ldiv followed by the nodes up to the next.
      const segments: XNode[][] = [];
      for (const n of kids(el)) {
        if (isEl(n) && n.tagName === 'ldiv') segments.push([n]);
        else segments.at(-1)?.push(n);
      }

      for (const [ldiv, ...content] of segments) {
        const m = child(ldiv as XEl, 'marker');
        const marker = m ? getText(m).trim() : '';
        const mk = (text: string, ps: ProvenanceItem[]) =>
          this.doc.text('list_item', text, {
            parent: group,
            prov: ps,
            enumerated: ordered,
            marker,
          });
        const nest = (li: NodeItem, xs: XEl[]) =>
          xs.forEach(x => this.dispatch(x, li));

        if (content.every(blank)) mk('', []);
        else if (isVirtualText(content))
          this.virtualItem(el, content, mk, nest);
        else {
          const [first, ...rest] = content.filter(isEl).filter(n => !isHead(n));
          const plain =
            first.tagName === 'text' &&
            elems(first).filter(c => !isLocLayer(c)).length <= 1 &&
            simpleText(first) !== null;
          if (plain && rest.every(isNested))
            nest(
              mk(getText(first).trim(), this.provs(headOf(first)).slice(0, 1)),
              rest
            );
          else nest(mk('', []), [first, ...rest]);
        }
      }
    },

    table: (el: XEl, parent: P): void => {
      const { host, sats, caption } = this.floatOf(el, isTableHost);
      if (host.tagName === 'table' && attr(host, 'class'))
        throw new Error('table element must not have a class attribute.');

      const [head, body] = split(host);
      const prov = this.provs(head);
      const { existing, register } = this.thread<TableItem>(host, head);

      if (existing) {
        // A continuation: append beside (same page) or below (new page).
        const t = existing.data as FullTableData;
        const existingProv = (existing.prov ??= []);
        const last = existingProv.at(-1);
        const [ro, co] =
          prov.length && last
            ? prov[0].page_no === last.page_no
              ? [0, t.num_cols]
              : [t.num_rows, 0]
            : [0, 0];
        existingProv.push(...prov);
        const frag = this.otsl(body, existing, ro, co);
        t.table_cells.push(...frag.table_cells);
        t.num_rows = Math.max(t.num_rows, ro + frag.num_rows);
        t.num_cols = Math.max(t.num_cols, co + frag.num_cols);
        return;
      }
      const tbl = this.doc.table(
        host.tagName === 'index' ? 'document_index' : 'table',
        {
          caption,
          parent,
          prov,
          layer: layerOf(head),
          data: tableData(),
        }
      );
      tbl.data = this.otsl(body, tbl);
      register(tbl);
      if (sats) this.attach(tbl, sats);
    },

    picture: (el: XEl, parent: P): void => {
      const { host, sats, caption } = this.floatOf(el, isPicture);
      const [head, body] = split(host);
      const pic = this.doc.picture({
        caption,
        parent,
        layer: layerOf(head),
        prov: this.provs(head),
      });
      if (sats) this.attach(pic, sats);

      const cls = labelOf(head);
      if (cls && cls !== 'undefined')
        metaOf(pic).classification = {
          predictions: [{ confidence: 1.0, class_name: cls }],
        };
      this.applyMeta(pic, head);

      // Body: optional <src> and chart <tabular>s, then ordinary content.
      const rest = body.filter(isEl);
      const i = rest.findIndex(e => !isChart(e));
      const cut = i < 0 ? rest.length : i;
      rest.slice(0, cut).forEach(e => {
        if (e.tagName === 'tabular') {
          metaOf(pic).tabular_chart = { chart_data: this.otsl(split(e)[1]) };
        } else if (this.resolveImage) {
          const uri = attr(e, 'uri');
          if (uri) pic.image = this.resolveImage(uri);
        }
      });
      rest.slice(cut).forEach(e => this.dispatch(e, pic));
    },

    group: (el: XEl, parent: P): void => {
      const name = attr(el, 'name');
      if (name) {
        const label = labelOf(kids(el)) ?? '';
        const g = this.doc.group(
          GROUP_LABELS.has(label) ? (label as GroupLabel) : 'unspecified',
          name,
          parent
        );
        return this.walk(el, g);
      }
      const host = floatHost(el);
      if (!host) return this.walk(el, parent);
      if (host.tagName === 'picture') return this.tag.picture(el, parent);
      if (host.tagName !== 'code') return this.tag.table(el, parent);

      const notes = this.satellites(el);
      const before = this.doc.texts.length;
      this.tag.text(host, parent);
      const code = this.doc.texts
        .slice(before)
        .find((t): t is CodeItem => t.label === 'code');
      if (code) this.attach(code, notes);
    },

    field_region: (el: XEl, parent: P): void => {
      const [head, body] = split(el);
      const prov = this.provs(head);
      const box =
        el.tagName === 'field_item'
          ? this.doc.fieldItem(prov, parent, layerOf(head))
          : this.doc.fieldRegion(prov, parent);
      this.body(box, body);
    },

    checkbox: (el: XEl, parent: P, text = ''): TextItemLike => {
      const selected = attr(el, 'class') === 'selected';
      return this.doc.text(checkboxLabel(selected), text, {
        parent,
      });
    },

    hint: (el: XEl, parent: P): void => {
      const [t, formatting] = textFmt(el);
      const text = t.trim();
      const head = headOf(el);
      if (text)
        this.doc.text('field_hint', text, {
          parent,
          formatting,
          layer: layerOf(head),
          prov: provFor(text, this.provs(head)),
        });
    },

    key: (el: XEl, parent: P): void => {
      const isValue = el.tagName === 'value';
      const [head, body] = split(el);
      const provs = this.provs(head);
      const nodes = body.filter(n => isEl(n) || !blank(n));
      const els = nodes.filter(isEl);
      const needsInline =
        nodes.length > 0 &&
        els.every(isFieldInline) &&
        (els.length > 1 ||
          els.some(isCheckbox) ||
          (els.length > 0 && nodes.some(isText)));
      const make = (text: string, formatting?: Formatting) =>
        this.doc.text(isValue ? 'field_value' : 'field_key', text, {
          parent,
          layer: layerOf(head),
          formatting,
          prov: provFor(text, provs),
          ...(isValue && {
            kind: attr(el, 'class') === 'fillable' ? 'fillable' : 'read_only',
          }),
        });

      let item: TextItemLike;
      if (simpleText(el) !== null && !needsInline) item = make(...textFmt(el));
      else {
        item = make('');
        if (needsInline)
          this.fieldInline(nodes, this.doc.group('inline', undefined, item));
        else this.body(item, body);
      }
      this.applyMeta(item, head);
    },
  };

  /** Handler by tag name, with the tags that share one listed alongside. */
  private readonly handlers: Record<string, (el: XEl, parent: P) => unknown> = {
    ...Object.fromEntries(TEXT_TAGS.map(t => [t, this.tag.text])),
    ...this.tag,
    field_heading: this.tag.heading,
    field_item: this.tag.field_region,
    value: this.tag.key,
    index: this.tag.table,
  };

  /** Hand the element to its tag's handler; other tags are just walked. */
  private dispatch(el: XEl, parent: P): void {
    const handle = own(this.handlers, el.tagName);
    if (handle) handle(el, parent);
    else this.walk(el, parent);
  }

  private walk(el: XEl, parent: P) {
    elems(el)
      .filter(c => !isSkipped(c))
      .forEach(c => this.dispatch(c, parent));
  }

  /** Dispatch elements, and wrap bare text runs as `text` items. */
  private body(parent: NodeItem, nodes: XNode[]) {
    for (const n of nodes) {
      if (isEl(n)) this.dispatch(n, parent);
      else if (isText(n) && data(n).trim())
        this.doc.text('text', data(n).trim(), { parent });
    }
  }

  /** Mixed content: one inline group holding each child as its own item. */
  private inline(el: XEl, parent: P, nodes?: XNode[]) {
    this.body(
      this.doc.group('inline', undefined, parent),
      nodes?.length ? nodes : kids(el)
    );
  }

  /** A caption/footnote item made from `c`, if it has any text. */
  private note(c: XEl | undefined, label: 'caption' | 'footnote') {
    const text = c && getText(c).trim();
    return c && text
      ? this.doc.text(label, text, { prov: this.provs(headOf(c)) })
      : undefined;
  }
  private caption = (el: XEl) => this.note(child(el, 'caption'), 'caption');

  /** Extra `<text>` (captions) and `<footnote>`s of a float group. */
  private satellites(el: XEl) {
    const made = elems(el).flatMap(c => {
      const label = own(NOTE, c.tagName);
      const item = label && this.note(c, label);
      return item ? [item] : [];
    });
    return ['caption', 'footnote'].map(l => made.filter(i => i.label === l));
  }
  private attach(item: FloatingItem, [caps, foots]: TextItemLike[][]) {
    (item.captions ??= []).push(...caps.map(ref));
    (item.footnotes ??= []).push(...foots.map(ref));
  }

  /** Host element, satellites and caption of a table or picture. */
  private floatOf(el: XEl, isHost: (n: XEl) => boolean) {
    const direct = isHost(el);
    const host = direct ? el : elems(el).find(isHost)!;
    const sats = direct ? undefined : this.satellites(el);
    const caption =
      this.caption(el) ?? (direct ? undefined : this.caption(host));
    return { host, sats, caption };
  }

  /** List-item body written as bare text after the `<ldiv>`. */
  private virtualItem(
    el: XEl,
    content: XNode[],
    mk: (text: string, ps: ProvenanceItem[]) => TextItemLike,
    nest: (li: NodeItem, xs: XEl[]) => void
  ) {
    const ps = this.provs(content);
    const start = content.findIndex(n => !(blank(n) || isHead(n)));
    const body = start < 0 ? [] : content.slice(start);
    const isRun = (n: XNode) => isText(n) || (isEl(n) && isContent(n));
    const cut = body.findIndex(n => !isRun(n));
    const at = cut < 0 ? body.length : cut;
    const leading = body.slice(0, at).map(raw).join('').trim();
    const els = body.slice(at).filter(isEl);

    if (leading && els.length && els.every(isNested))
      nest(mk(leading, provFor(leading, ps)), els);
    else if (body.every(isRun) && body.some(n => isEl(n) || !blank(n))) {
      const text = body.map(raw).join('').trim();
      mk(text, provFor(text, ps));
    } else this.inline(el, mk('', provFor('', ps)), body);
  }

  /**
   * Parse OTSL body nodes into TableData. `owner` is given for real tables
   * (cells with nested elements become rich cells under it) and absent for
   * chart data, which has no document context.
   */
  private otsl(
    nodes: XNode[],
    owner?: NodeItem,
    ro = 0,
    co = 0
  ): FullTableData {
    const parts = otslParts(nodes);
    const grid = parts
      .map(tok)
      .reduce<string[][]>(
        (rows, t) => {
          if (t === 'nl') rows.push([]);
          else if (t) rows.at(-1)!.push(t);
          return rows;
        },
        [[]]
      )
      .filter(r => r.length);

    // How many of `which` follow (r, c) in direction (dr, dc).
    const run = (
      r: number,
      c: number,
      which: string[],
      dr: number,
      dc: number
    ) => {
      let n = 0;
      while (which.includes(grid[r + n * dr]?.[c + n * dc])) n++;
      return n;
    };

    const cells: AnyTableCell[] = [];
    let r = 0;
    let c = 0;
    parts.forEach((p, i) => {
      const t = tok(p);
      if (t === 'nl') {
        r++;
        c = 0;
      }
      if (!t || t === 'nl') return;
      const col = c++;

      // Optional cell box (four locations), then the body up to the next token.
      const box = t === 'ecel' ? [] : coords(parts.slice(i + 1, i + 5));
      const after = parts.slice(i + 1 + (box.length === 4 ? 4 : 0));
      const stop = after.findIndex(q => tok(q));
      const body =
        t === 'ecel' ? [] : after.slice(0, stop < 0 ? undefined : stop);
      if (SPAN.includes(t) && !body.length) return;

      const text = body
        .map(q => (typeof q === 'string' ? q : toXml(q)))
        .join('');
      const colSpan = 1 + run(r, col + 1, RIGHT, 0, 1);
      const rowSpan = 1 + run(r + 1, col, DOWN, 1, 0);
      const pos = {
        row_span: rowSpan,
        col_span: colSpan,
        start_row_offset_idx: r + ro,
        end_row_offset_idx: r + rowSpan + ro,
        start_col_offset_idx: col + co,
        end_col_offset_idx: col + colSpan + co,
        bbox: box.length === 4 && owner ? bbox(box) : undefined,
      };

      const els = body.filter(isEl);
      if (els.length && owner) {
        const g = this.doc.group('unspecified', undefined, owner);
        els.forEach(e => this.dispatch(e, g));
        const rich = els.map(getText).join('').trim() || text.trim();
        cells.push(cell({ ...pos, text: rich, ref: ref(g) }));
      } else
        cells.push(
          cell({
            ...pos,
            text: text.trim(),
            column_header: t === 'ched' || t === 'corn',
            row_header: t === 'rhed' || t === 'corn',
            row_section: t === 'srow',
          })
        );
    });
    return tableData(
      cells,
      grid.length,
      Math.max(0, ...grid.map(g => g.length))
    );
  }

  private applyMeta(item: NodeItem, head: XNode[]) {
    const set = (k: string, v: unknown) => {
      metaOf(item)[k] = v;
    };
    for (const n of head.filter(isEl)) {
      const text = getText(n).trim();
      if (n.tagName === 'description' && 'captions' in item && text)
        set('description', { text });
      else if (n.tagName === 'summary' && text) set('summary', { text });
      else if (n.tagName === 'custom')
        for (const f of elems(n)) {
          const value = getText(f);
          const v = value.trim();
          const key = own(CUSTOM_META, f.tagName);
          const [ns, ...name] = f.tagName.split('__');
          if (key === 'molecule') {
            if (v && item.self_ref.startsWith('#/pictures/'))
              set(key, { smi: v });
          } else if (key) {
            if (v) set(key, { text: v });
          } else if (ns && name.join('__')) set(f.tagName, value);
        }
    }
  }

  /** Inline key/value body; a checkbox absorbs a single trailing text. */
  private fieldInline(nodes: XNode[], parent: NodeItem) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (isEl(n) && isCheckbox(n)) {
        const next = nodes.length - i === 2 ? nodes[i + 1] : undefined;
        const taken = next && (isText(next) || isContent(next));
        this.tag.checkbox(
          n,
          parent,
          taken ? (isText(next) ? raw(next).trim() : raw(next)) : ''
        );
        if (taken) i++;
      } else this.body(parent, [n]);
    }
  }
}
