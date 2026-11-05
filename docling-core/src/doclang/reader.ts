/**
 * DocLang -> DoclingDocument. A port of docling-core's `DocLangDocDeserializer`
 * (v2.106.0) that works directly on DOM nodes.
 *
 * Method names follow the Python ones (`_parse_text_like` -> `parseTextLike`)
 * so the two stay easy to compare.
 */
import { iterateDocumentItems } from '../index';
import {
  type CodeItem,
  type ContentLayer,
  type FloatingItem,
  type Formatting,
  type GroupLabel,
  type ImageRef,
  type NodeItem,
  type ProvenanceItem,
  type RefItem,
  type TableItem,
  isDocling,
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
  META_NAMESPACE_DELIMITER,
  META_TAG_DESCRIPTION,
  META_TAG_SMILES,
  META_TAG_SUMMARY,
  codeLang,
  isFieldInline,
  isFormatting,
  isHead,
  isInlineHost,
  isListItemSibling,
  isListItemVirtualContent,
  isOtsl,
  isSemanticOrGrouping,
  isTextLike,
  own,
  tags,
} from './vocab';
import { applyWhitespaceRules, isVirtualText } from './whitespace';
import {
  type XEl,
  type XNode,
  attr,
  blank,
  data,
  elems,
  hasContent,
  isEl,
  isText,
  kids,
  lstrip,
  rstrip,
  strip,
} from './xml';

type P = NodeItem | undefined; // parent (undefined = body)

/** `DOCLANG_DFLT_RESOLUTION` */
const DFLT_RESOLUTION = 512;
const ALL_LAYERS: ContentLayer[] = [
  'body',
  'furniture',
  'background',
  'invisible',
  'notes',
];

const isCheckbox = tags('checkbox');
const isContent = tags('content');
const isLocation = tags('location');
const isLocationOrLayer = tags('location layer');
const isSkipped = tags('head location layer label custom caption src');
/** Children a "simple text block" may hold besides its text. */
const isSimpleChild = tags(
  'location layer label br bold italic underline strikethrough subscript superscript rtl handwriting content'
);
/** Tags `textWithFormatting` reads a single child of as formatting. */
const isFormatChild = tags(
  'bold italic strikethrough underline superscript subscript rtl'
);
/** Inline markup of a float satellite, i.e. not nested block content. */
const isSatelliteInline = tags(
  'bold italic underline strikethrough subscript superscript br content'
);

const len = (s: string) => [...s].length; // Python counts code points
const ref = (item: NodeItem): RefItem => ({ $ref: item.self_ref });
const textNode = (s: string): XNode => ({
  nodeType: 3,
  nodeValue: s,
  childNodes: [],
});

/** Python's `int(s)`, or `undefined` where it would raise. */
const pyInt = (s: string): number | undefined =>
  /^\s*[+-]?\d+(?:_\d+)*\s*$/.test(s)
    ? Number(s.replaceAll('_', '').trim())
    : undefined;

const bboxOf = ([a, b, c, d]: number[]) => ({
  l: Math.min(a, c),
  t: Math.min(b, d),
  r: Math.max(a, c),
  b: Math.max(b, d),
  coord_origin: 'TOPLEFT' as const,
});

/** Provenance list whose first entry spans the whole `text`. */
const provFor = (text: string, ps: ProvenanceItem[]): ProvenanceItem[] =>
  ps.map((p, i) => (i ? p : { ...p, charspan: [0, len(text)] }));

// ------------- Text extraction -------------

/** `(text, protected)` fragments; protected text came from `<content>`. */
function collectFragments(el: XEl): [string, boolean][] {
  const out: [string, boolean][] = [];
  for (const n of kids(el)) {
    if (isText(n)) out.push([data(n), isContent(el)]);
    else if (isEl(n)) {
      // Element-head children are metadata and must not bleed into body text.
      if (isHead(n)) continue;
      if (n.tagName === 'br') out.push(['\n', false]);
      else out.push(...collectFragments(n));
    }
  }
  return out;
}

/** Descendant text verbatim, per the inline whitespace contract. */
const collectText = (el: XEl) =>
  collectFragments(el)
    .map(f => f[0])
    .join('');

/** Descendant text, trimming the outer block boundary only (`<content>` is protected). */
function trimmedText(el: XEl): string {
  const frags = collectFragments(el);
  for (const trim of [lstrip, rstrip]) {
    const last = trim === rstrip;
    while (frags.length) {
      const i = last ? frags.length - 1 : 0;
      if (frags[i][1]) break;
      const trimmed = trim(frags[i][0]);
      if (trimmed) {
        frags[i] = [trimmed, false];
        break;
      }
      frags.splice(i, 1);
    }
  }
  return frags.map(f => f[0]).join('');
}
const getText = trimmedText;

/** The single text run of an element made only of inline markup, else null. */
function simpleTextBlock(element: XEl): string | null {
  let result: string | null = null;
  for (const n of kids(element)) {
    if (isEl(n)) {
      if (isHead(n)) continue;
      if (!isSimpleChild(n)) return null;
      const tmp = simpleTextBlock(n);
      if (tmp) {
        if (result !== null) return null;
        result = tmp;
      } else if (getText(n)) return null; // the child is itself mixed content
    } else if (isText(n) && hasContent(data(n))) {
      if (result !== null) return null;
      result = isContent(element) ? data(n) : strip(data(n));
    }
  }
  return result;
}

/** No text and no children other than element-head metadata. */
const isEmptyTextBlock = (element: XEl) =>
  kids(element).every(n =>
    isEl(n) ? isHead(n) : !(isText(n) && hasContent(data(n)))
  );

/** Text of a plain run, i.e. a text node or `<content>`; null for anything else. */
function plainRunText(n: XNode): string | null {
  if (isText(n)) return data(n);
  return isEl(n) && isContent(n) ? collectText(n) : null;
}

/** Split an element's children into its head (location, layer, ...) and body. */
function split(el: XEl): [XNode[], XNode[]] {
  const ns = kids(el);
  const i = ns.findIndex(n => !blank(n) && !isHead(n));
  return i < 0 ? [ns, []] : [ns.slice(0, i), ns.slice(i)];
}

const attrsOf = (nodes: XNode[], tag: string, name = 'value') =>
  nodes
    .filter(isEl)
    .filter(n => n.tagName === tag)
    .map(n => attr(n, name));

const threadIdOf = (nodes: XNode[]): string | undefined =>
  attrsOf(nodes, 'thread', 'thread_id').find(Boolean);
const layerOf = (nodes: XNode[]) =>
  attrsOf(nodes, 'layer').find(v => LAYERS.has(v)) as ContentLayer | undefined;
const labelValueOf = (nodes: XNode[]) => attrsOf(nodes, 'label').find(Boolean);
const firstChild = (el: XEl, tag: string) =>
  elems(el).find(c => c.tagName === tag);

const firstNonWhitespace = (nodes: XNode[]) => nodes.find(n => !blank(n));

// ------------- Formatting -------------

/** Apply a formatting tag's own style onto (a copy of) the accumulated formatting. */
function mergeFormattingTag(nm: string, base?: Formatting): Formatting {
  const f = fmt(base);
  if (nm === 'bold') f.bold = true;
  else if (nm === 'italic') f.italic = true;
  else if (nm === 'underline') f.underline = true;
  else if (nm === 'strikethrough') f.strikethrough = true;
  else if (nm === 'subscript') f.script = 'sub';
  else if (nm === 'superscript') f.script = 'super';
  return f;
}

/**
 * Text and formatting of an element. A single formatting child stands for the
 * whole element (unless text sits beside it). `trim`: trim the outer boundary;
 * false for a run inside an inline group, whose edge whitespace is significant.
 */
function textWithFormatting(
  el: XEl,
  trim = true
): [string, Formatting | undefined] {
  const children = elems(el).filter(c => !isHead(c));
  const [child] = children;
  if (
    children.length === 1 &&
    isFormatChild(child) &&
    !kids(el).some(n => isText(n) && data(n))
  ) {
    const [text, inner] = textWithFormatting(child, trim);
    return [text, mergeFormattingTag(child.tagName, inner ?? fmt())];
  }
  return [trim ? trimmedText(el) : collectText(el), undefined];
}

const TEXT_LABEL: Record<string, TextLabel> = {
  text: 'text',
  caption: 'caption',
  footnote: 'footnote',
  page_header: 'page_header',
  page_footer: 'page_footer',
  bold: 'text',
  italic: 'text',
  underline: 'text',
  strikethrough: 'text',
  subscript: 'text',
  superscript: 'text',
  rtl: 'text',
  handwriting: 'handwritten_text',
  content: 'text',
};

const checkboxLabel = (el: XEl): TextLabel =>
  attr(el, 'class') === 'selected'
    ? 'checkbox_selected'
    : 'checkbox_unselected';

/** Code text and its language label. */
function codeContentAndLanguage(
  el: XEl
): [string, ReturnType<typeof codeLang>] {
  const label = firstChild(el, 'label');
  const parts = kids(el).map(n => {
    if (isText(n)) return data(n);
    if (!isEl(n) || isHead(n)) return '';
    return n.tagName === 'br' ? '\n' : collectText(n);
  });
  return [parts.join(''), codeLang(label ? attr(label, 'value') : '')];
}

/** The host of an unnamed `<group>` that only adds notes to one float. */
function floatGroupHost(el: XEl): XEl | undefined {
  const isHost = tags('picture table index code');
  const isNote = tags('text footnote caption');
  const hosts: XEl[] = [];
  for (const c of elems(el)) {
    if (isHost(c)) hosts.push(c);
    else if (!isNote(c)) return undefined;
  }
  return hosts.length === 1 ? hosts[0] : undefined;
}

function tableLabel(el: XEl): 'table' | 'document_index' {
  if (el.tagName === 'index') return 'document_index';
  if (el.tagName !== 'table')
    throw new Error(`Expected table or index element, got '${el.tagName}'.`);
  if (attr(el, 'class'))
    throw new Error('table element must not have a class attribute.');
  return 'table';
}

/**
 * OTSL body nodes as text runs and elements. `<content>` is unwrapped and the
 * text around it merged, as when Python re-parses the serialized body.
 */
function otslParts(nodes: XNode[]): XNode[] {
  const out: XNode[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(textNode(buf));
    buf = '';
  };
  const walk = (ns: XNode[]) => {
    for (const n of ns) {
      if (isText(n)) buf += data(n);
      else if (isEl(n) && isContent(n)) walk(kids(n));
      else if (isEl(n)) {
        flush();
        out.push(n);
      }
    }
  };
  walk(nodes);
  flush();
  return out;
}
const tokenOf = (n?: XNode) => (isEl(n) && isOtsl(n) ? n.tagName : undefined);

/** Is the content after an `<ldiv>` virtual text (vs. real child elements)? */
function isListItemVirtualText(nodes: XNode[]): boolean {
  if (isVirtualText(nodes)) return true;
  const first = firstNonWhitespace(nodes);
  if (!first) return false;
  if (isText(first)) return true;
  if (!isEl(first)) return false;
  if (isHead(first) || isListItemVirtualContent(first)) return true;
  return !isSemanticOrGrouping(first);
}

/** Leading plain text of a virtual-text body, and the remaining nodes. */
function splitVirtualTextLeadingText(nodes: XNode[]): [string, XNode[]] {
  const parts: string[] = [];
  let restStart = 0;
  for (const [i, n] of nodes.entries()) {
    if (isText(n)) parts.push(data(n));
    else if (isEl(n) && isContent(n)) parts.push(getText(n));
    else break;
    restStart = i + 1;
  }
  return [parts.join(''), nodes.slice(restStart).filter(n => !blank(n))];
}

/** Virtual-text body made only of plain text (optionally via `<content>`). */
const isSimpleVirtualTextNodes = (nodes: XNode[]) =>
  nodes.every(n => !isEl(n) || isContent(n)) &&
  nodes.some(n => (isText(n) && hasContent(data(n))) || isContent(n));

const textFromNodes = (nodes: XNode[]) =>
  nodes
    .map(n => (isText(n) ? data(n) : isEl(n) && isContent(n) ? getText(n) : ''))
    .join('');

export class Reader {
  doc = new Doc();
  private w = DFLT_RESOLUTION;
  private h = DFLT_RESOLUTION;
  private res = DFLT_RESOLUTION;
  private threads = new Map<string, NodeItem>();

  constructor(
    private page: number,
    private resolveImage?: (uri: string) => ImageRef,
    private warn: (message: string) => void = m => console.warn(m)
  ) {}

  run(root: XEl) {
    applyWhitespaceRules(root);
    this.applyDefaultResolution(root);
    this.ensurePage();
    elems(root).forEach(el => this.dispatch(el, undefined));
    return this.doc.toJSON();
  }

  // ------------- Pages and locations -------------

  /** Make sure the current page exists; a `resolution` forces a square page. */
  private ensurePage(resolution?: number) {
    this.doc.pages[String(this.page)] ??= {
      size:
        resolution === undefined
          ? { width: this.w, height: this.h }
          : { width: resolution, height: resolution },
      page_no: this.page,
    };
  }

  /** Read `<default_resolution width height/>`: pages use the declared space. */
  private applyDefaultResolution(root: XEl) {
    const el = root.getElementsByTagName('default_resolution')[0];
    if (!el) return;
    const width = pyInt(attr(el, 'width') || '0');
    const height = pyInt(attr(el, 'height') || '0');
    if (width === undefined || height === undefined) return;
    if (width > 0) {
      this.w = width;
      this.res = width; // scalar fallback for `<location resolution>` (square docs only)
    }
    if (height > 0) this.h = height;
  }

  /** Coordinates and resolution of the `<location>` elements among `nodes`. */
  private locations(nodes: XNode[]) {
    return nodes
      .filter(isEl)
      .filter(isLocation)
      .map(n => ({
        v: pyInt(attr(n, 'value') || '0') ?? 0,
        r: pyInt(attr(n, 'resolution') || String(this.res)) ?? this.res,
      }));
  }

  /** Provenance boxes from consecutive groups of four `<location>`s. */
  private provenanceFromLocations(nodes: XNode[]): ProvenanceItem[] {
    const locs = this.locations(nodes);
    return range(Math.floor(locs.length / 4)).map(i => {
      const group = locs.slice(4 * i, 4 * i + 4);
      this.ensurePage(group[3].r || this.res);
      return {
        page_no: this.page,
        bbox: bboxOf(group.map(l => l.v)),
        charspan: [0, 0],
      };
    });
  }

  private extractProvenance = (el: XEl) =>
    this.provenanceFromLocations(split(el)[0]);
  private extractLayer = (el: XEl) => layerOf(split(el)[0]);

  // ------------- Threads -------------

  private threadItem<T extends NodeItem>(id: string | undefined, host: string) {
    return id
      ? (this.threads.get(`${id}\0${host}`) as T | undefined)
      : undefined;
  }
  private registerThread(id: string | undefined, host: string, item: NodeItem) {
    if (id) this.threads.set(`${id}\0${host}`, item);
  }

  /** Append a threaded fragment to an existing text-like item. */
  private mergeThreadedTextItem(
    existing: TextItemLike,
    text: string,
    provs: ProvenanceItem[]
  ) {
    const at = len(existing.orig);
    existing.text += text;
    existing.orig += text;
    const target = (existing.prov ??= []);
    for (const p of provs)
      target.push({ ...p, charspan: [at, at + len(text)] });
  }

  // ------------- Core walkers -------------

  private dispatch(el: XEl, parent: P): void {
    const name = el.tagName;
    if (name === 'track') {
      this.warn(`<${name}> is not supported yet; skipped with all its content`);
    } else if (isTextLike(el)) this.parseTextLike(el, parent);
    else if (name === 'page_break') {
      this.page++;
      this.ensurePage();
    } else if (name === 'heading') this.parseHeading(el, parent, false);
    else if (name === 'field_heading') this.parseHeading(el, parent, true);
    else if (name === 'field_region' || name === 'field_item')
      this.parseFieldRegion(el, parent);
    else if (name === 'key' || name === 'value') this.parseFieldKv(el, parent);
    else if (name === 'hint') this.parseFieldHint(el, parent);
    else if (name === 'checkbox') this.parseCheckbox(el, parent);
    else if (name === 'list') this.parseList(el, parent);
    else if (name === 'group') {
      // A named group is an explicit GroupItem. The float + footnote wrapper
      // never carries a name, so it must be checked first.
      const groupName = attr(el, 'name');
      const host = groupName ? undefined : floatGroupHost(el);
      if (groupName) this.parseNamedGroup(el, parent, groupName);
      else if (!host) this.walkChildren(el, parent);
      else if (host.tagName === 'picture') this.parsePicture(el, parent);
      else if (host.tagName === 'code') this.parseCodeGroup(el, host, parent);
      else this.parseTable(el, parent);
    } else if (name === 'table' || name === 'index')
      this.parseTable(el, parent);
    else if (name === 'picture') this.parsePicture(el, parent);
    else this.walkChildren(el, parent);
  }

  /** Rebuild a GroupItem from `<group name="...">` and nest its children in it. */
  private parseNamedGroup(el: XEl, parent: P, name: string) {
    const label = labelValueOf(elems(el).filter(isHead)) ?? '';
    const group = this.doc.group(
      GROUP_LABELS.has(label) ? (label as GroupLabel) : 'unspecified',
      name,
      parent
    );
    this.walkChildren(el, group);
  }

  private walkChildren(el: XEl, parent: P) {
    elems(el)
      .filter(c => !isSkipped(c))
      .forEach(c => this.dispatch(c, parent));
  }

  /** Dispatch element-body children under `parent`; bare text becomes `text` items. */
  private dispatchBodyNodes(nodes: XNode[], parent: NodeItem) {
    for (const n of nodes) {
      if (isEl(n)) this.dispatch(n, parent);
      else if (isText(n) && hasContent(data(n)))
        this.doc.text('text', strip(data(n)), { parent });
    }
  }

  // ------------- Text blocks -------------

  /** The checkbox and its text when the body of `el` holds nothing else. */
  private checkboxTextBlock(el: XEl): [XEl, string] | null {
    const nodes = split(el)[1].filter(n => isEl(n) || (isText(n) && data(n)));
    const [first, second] = nodes;
    if (!isEl(first) || !isCheckbox(first)) return null;
    if (nodes.length === 1) return [first, ''];
    const text = nodes.length === 2 ? plainRunText(second) : null;
    return text === null ? null : [first, text];
  }

  /** Parse text-like tokens (text, caption, footnotes, code, formula, ...). */
  private parseTextLike(el: XEl, parent: P): void {
    const elementChildren = elems(el).filter(c => !isHead(c));
    const threadId = threadIdOf(split(el)[0]);
    const simple = simpleTextBlock(el);
    // an element without any content is an empty item, not a (childless) inline group
    const isEmpty = simple === null && !threadId && isEmptyTextBlock(el);
    const checkbox = el.tagName === 'text' ? this.checkboxTextBlock(el) : null;
    if (
      !checkbox &&
      !isEmpty &&
      (elementChildren.length > 1 || (simple === null && !threadId))
    )
      return this.parseMixedTextLike(el, parent);

    const provs = this.extractProvenance(el);
    const layer = this.extractLayer(el);
    // A run inside an inline group owns its edge whitespace; a block host does not.
    const inline = !!parent && isDocling.InlineGroup(parent);
    const [text, formatting0] = checkbox
      ? [checkbox[1], undefined]
      : textWithFormatting(el, !inline);
    const nm = el.tagName;
    const existing = this.threadItem<TextItemLike>(threadId, nm);

    if (!text && !isEmpty && !checkbox) {
      if (existing && provs.length)
        this.mergeThreadedTextItem(existing, '', provs);
      return;
    }

    if (nm === 'code') {
      const [codeText, code_language] = codeContentAndLanguage(el);
      if (existing)
        return this.mergeThreadedTextItem(existing, codeText, provs);
      const item = this.doc.text('code', codeText, {
        parent,
        prov: provFor(codeText, provs),
        layer,
        ...floating(),
        code_language,
      });
      this.attach(item as CodeItem, this.extractCaptions(el), []);
      this.registerThread(threadId, nm, item);
      this.applyMeta(item, el);
    } else if (nm === 'formula') {
      if (existing) return this.mergeThreadedTextItem(existing, text, provs);
      // Python passes no layer to formulae.
      const item = this.doc.text('formula', text, {
        parent,
        prov: provFor(text, provs),
        formatting: formatting0,
      });
      this.registerThread(threadId, nm, item);
      this.applyMeta(item, el);
    } else if (own(TEXT_LABEL, nm)) {
      const formatting = isFormatting(el)
        ? mergeFormattingTag(nm, formatting0)
        : formatting0;
      const label = elementChildren.some(c => c.tagName === 'handwriting')
        ? 'handwritten_text'
        : checkbox
          ? checkboxLabel(checkbox[0])
          : TEXT_LABEL[nm];
      if (existing) return this.mergeThreadedTextItem(existing, text, provs);
      const item = this.doc.text(label, text, {
        parent,
        prov: provFor(text, provs),
        formatting,
        layer,
      });
      this.registerThread(threadId, nm, item);
      this.applyMeta(item, el);
    }
  }

  private parseHeading(el: XEl, parent: P, field: boolean) {
    const level = pyInt(attr(el, 'level') || '1') ?? 1;
    const provs = this.extractProvenance(el);
    const layer = this.extractLayer(el);
    const text = getText(el);
    if (!text) return;
    const host = el.tagName;
    const threadId = threadIdOf(split(el)[0]);
    const existing = this.threadItem<TextItemLike>(threadId, host);
    if (existing) return this.mergeThreadedTextItem(existing, text, provs);
    // Level 1 maps to a title, level > 1 to a section header of level - 1.
    const item = this.doc.text(
      field ? 'field_heading' : level === 1 ? 'title' : 'section_header',
      text,
      {
        parent,
        layer,
        prov: provFor(text, provs),
        ...(field ? { level } : level === 1 ? {} : { level: level - 1 }),
      }
    );
    this.registerThread(threadId, host, item);
    if (!field) this.applyMeta(item, el);
  }

  // ------------- Fields -------------

  private parseFieldRegion(el: XEl, parent: P) {
    const [head, body] = split(el);
    const provs = this.provenanceFromLocations(head);
    const item =
      el.tagName === 'field_item'
        ? this.doc.fieldItem(provs, parent, layerOf(head))
        : this.doc.fieldRegion(provs, parent);
    this.dispatchBodyNodes(body, item);
  }

  /**
   * Add a checkbox item. Its text is the plain run right after the symbol,
   * verbatim: `<checkbox/> y` gives `" y"` and `<checkbox/>y` gives `"y"`.
   */
  private parseCheckbox(
    el: XEl,
    parent: P,
    text = '',
    formatting?: Formatting
  ) {
    this.doc.text(checkboxLabel(el), text, { parent, formatting });
  }

  private parseFieldHint(el: XEl, parent: P) {
    const provs = this.extractProvenance(el);
    const layer = this.extractLayer(el);
    const [text, formatting] = textWithFormatting(el);
    if (!text) return;
    this.doc.text('field_hint', text, {
      parent,
      formatting,
      layer,
      prov: provFor(text, provs),
    });
  }

  /** Must a key/value body become an inline group, not flat text? */
  private fieldKvNeedsInlineContainer(body: XNode[]): boolean {
    const meaningful = body.filter(
      n => isEl(n) || (isText(n) && hasContent(data(n)))
    );
    const els = meaningful.filter(isEl);
    if (!meaningful.length || !els.every(isFieldInline)) return false;
    return (
      els.length > 1 ||
      els.some(isCheckbox) ||
      (els.length > 0 && meaningful.some(isText))
    );
  }

  /** Parse `<key>` / `<value>` into field key or value items. */
  private parseFieldKv(el: XEl, parent: P) {
    const isValue = el.tagName === 'value';
    const [head, body] = split(el);
    const provs = this.provenanceFromLocations(head);
    const layer = layerOf(head);
    const kind = attr(el, 'class') === 'fillable' ? 'fillable' : 'read_only';
    const needsInline = this.fieldKvNeedsInlineContainer(body);
    const make = (text: string, formatting?: Formatting) =>
      this.doc.text(isValue ? 'field_value' : 'field_key', text, {
        parent,
        layer,
        formatting,
        prov: provFor(text, provs),
        ...(isValue && { kind }),
      });

    if (simpleTextBlock(el) !== null && !needsInline) {
      this.applyMeta(make(...textWithFormatting(el)), el);
      return;
    }
    const item = make('');
    if (needsInline)
      this.parseInlineRuns(body, this.doc.group('inline', undefined, item));
    else this.dispatchBodyNodes(body, item);
    this.applyMeta(item, el);
  }

  // ------------- Lists -------------

  private parseList(el: XEl, parent: P) {
    const ordered = attr(el, 'class') === 'ordered';
    const threadId = threadIdOf(elems(el));
    const existing = this.threadItem<NodeItem>(threadId, 'list');
    const group = existing ?? this.doc.group('list', undefined, parent);
    if (!existing) this.registerThread(threadId, 'list', group);

    const all = kids(el);
    const actual = elems(el).filter(c => !isLocation(c));
    const boundaries = actual.flatMap((n, i) =>
      n.tagName === 'ldiv' ? [i] : []
    );

    boundaries.forEach((start, b) => {
      const end = boundaries[b + 1] ?? actual.length;
      const ldiv = actual[start];
      const markerEl = firstChild(ldiv, 'marker');
      const marker = markerEl ? getText(markerEl) : '';
      // All nodes between this ldiv and the next, text and head tokens included.
      const from = all.indexOf(ldiv) + 1;
      const next = end < actual.length ? all.indexOf(actual[end]) : all.length;
      const content = all.slice(from, next);
      const els = actual.slice(start + 1, end).filter(n => !isHead(n));

      const add = (text: string, prov: ProvenanceItem[] = []) =>
        this.doc.text('list_item', text, {
          parent: group,
          prov,
          enumerated: ordered,
          marker,
        });
      // A plain `<text>`: no block children besides location/layer.
      const isPlain = (t: XEl) =>
        elems(t).filter(c => !isLocationOrLayer(c)).length <= 1 &&
        simpleTextBlock(t) !== null;
      const plainItem = (t: XEl) =>
        add(getText(t), this.extractProvenance(t).slice(0, 1));
      const nest = (li: NodeItem, xs: XEl[]) =>
        xs.forEach(x => this.dispatch(x, li));

      if (!firstNonWhitespace(content)) add('');
      else if (isListItemVirtualText(content))
        this.parseListItemVirtualText(add, content);
      else {
        const [first, ...rest] = els;
        // A simple `<text>`, alone or followed only by lists/pictures, is the item's text.
        if (
          first.tagName === 'text' &&
          rest.every(isListItemSibling) &&
          isPlain(first)
        )
          nest(plainItem(first), rest);
        else nest(add(''), els);
      }
    });
  }

  /** Parse a list-item body emitted as virtual `<text>` after `<ldiv>`. */
  private parseListItemVirtualText(
    add: (text: string, prov?: ProvenanceItem[]) => TextItemLike,
    content: XNode[]
  ) {
    const provs = this.provenanceFromLocations(content);
    const start = content.findIndex(n => !(blank(n) || isHead(n)));
    const body = start < 0 ? [] : content.slice(start);
    const [leading, rest] = splitVirtualTextLeadingText(body);
    const restEls = rest.filter(isEl);

    if (leading && restEls.length && restEls.every(isListItemSibling)) {
      const li = add(leading, provFor(leading, provs));
      restEls.forEach(e => this.dispatch(e, li));
    } else if (!rest.length && leading) add(leading, provFor(leading, provs));
    else if (isSimpleVirtualTextNodes(body)) {
      const text = textFromNodes(body);
      add(text, provFor(text, provs));
    } else {
      const li = add('', provFor('', provs));
      if (body.length) this.parseInlineGroup(li, body);
    }
  }

  // ------------- Inline groups -------------

  /** Add text runs for `nodes`, carrying `formatting` and `label` through nested tags. */
  private parseInlineRuns(
    nodes: XNode[],
    parent: P,
    formatting?: Formatting,
    label: TextLabel = 'text'
  ) {
    // Comments and text nodes left empty by the whitespace rules separate nothing.
    const runs = nodes.filter(n => isEl(n) || (isText(n) && data(n)));
    for (let idx = 0; idx < runs.length; idx++) {
      const n = runs[idx];
      if (!isEl(n)) {
        // Already read per the whitespace rules: a run owns its boundary space.
        this.doc.text(label, data(n), { parent, formatting });
      } else if (isCheckbox(n)) {
        const next = idx + 1 < runs.length ? plainRunText(runs[idx + 1]) : null;
        if (next !== null) idx++;
        this.parseCheckbox(n, parent, next ?? '', formatting);
      } else if (isContent(n)) {
        // The explicit whitespace-preserving wrapper is a run, not a nested
        // item, so it inherits the formatting accumulated on the way in.
        const text = collectText(n);
        if (text) this.doc.text(label, text, { parent, formatting });
      } else if (isFormatting(n)) {
        // Accumulate this tag's style and keep descending.
        this.parseInlineRuns(
          kids(n),
          parent,
          mergeFormattingTag(n.tagName, formatting),
          label
        );
      } else if (n.tagName === 'handwriting')
        this.parseInlineRuns(kids(n), parent, formatting, 'handwritten_text');
      else if (n.tagName === 'rtl')
        // The model has no text direction: its runs are read as plain ones.
        this.parseInlineRuns(kids(n), parent, formatting, label);
      else this.dispatch(n, parent);
    }
  }

  private parseInlineGroup(parent: P, nodes: XNode[], formatting?: Formatting) {
    const group = this.doc.group('inline', undefined, parent);
    this.parseInlineRuns(nodes, group, formatting);
    return group;
  }

  /** Set the content layer of `root` and everything below it. */
  private setLayer(root: NodeItem, layer: ContentLayer) {
    for (const [item] of iterateDocumentItems(this.doc.toJSON(), {
      root,
      withGroups: true,
      includedContentLayers: ALL_LAYERS,
    }))
      item.content_layer = layer;
  }

  /** Parse a text-like element with mixed content (text + formatting runs). */
  private parseMixedTextLike(el: XEl, parent: P) {
    if (
      isInlineHost(el) &&
      (el.tagName !== 'text' || this.extractProvenance(el).length)
    ) {
      this.parseInlineHost(el, parent, el.tagName as TextLabel);
      return;
    }
    // A formatting tag keeps its own style.
    const formatting = isFormatting(el)
      ? mergeFormattingTag(el.tagName)
      : undefined;
    const group = this.parseInlineGroup(parent, kids(el), formatting);
    const layer = this.extractLayer(el);
    // Runs carry no layer of their own; without this, furniture runs would leak into the body.
    if (layer) this.setLayer(group, layer);
  }

  /**
   * A labeled text-like element with mixed content: an empty host item holding
   * an inline group, so the host's label, provenance and layer survive.
   */
  private parseInlineHost(el: XEl, parent: P, label: TextLabel) {
    const provs = this.extractProvenance(el);
    const layer = this.extractLayer(el);
    const item = this.doc.text(label, '', {
      parent,
      prov: provFor('', provs),
      layer,
    });
    this.parseInlineGroup(item, split(el)[1]);
    // Inline runs inherit the host layer, including captions parsed directly.
    if (layer) this.setLayer(item, layer);
    this.applyMeta(item, el);
    return item;
  }

  // ------------- Floating items (table / picture) -------------

  private attach(
    item: FloatingItem,
    captions: TextItemLike[],
    footnotes: TextItemLike[]
  ) {
    (item.captions ??= []).push(...captions.map(ref));
    (item.footnotes ??= []).push(...footnotes.map(ref));
  }

  /** Parse `<table>`, `<index>`, or a `<group>` wrapping them (with satellites). */
  private parseTable(el: XEl, parent: P) {
    const direct = el.tagName === 'table' || el.tagName === 'index';
    const [extra, footnotes] = direct ? [[], []] : this.extractSatellites(el);
    const otslEl = direct
      ? el
      : (firstChild(el, 'table') ?? firstChild(el, 'index'));
    let captions = this.extractCaptions(el);
    if (!direct && !captions.length && otslEl)
      captions = this.extractCaptions(otslEl);
    if (!otslEl) return; // unreachable: a float group's host is a table here

    const label = tableLabel(otslEl);
    const [head, body] = split(otslEl);
    const provs = this.provenanceFromLocations(head);
    const threadId = threadIdOf(head);
    const host = otslEl.tagName;
    const existing = this.threadItem<TableItem>(threadId, host);

    if (existing) {
      // A continuation: append beside (same page) or below (new page).
      const t = existing.data as FullTableData;
      const existingProv = (existing.prov ??= []);
      const last = existingProv.at(-1);
      const [ro, co] =
        provs.length && last
          ? provs[0].page_no === last.page_no
            ? [0, t.num_cols]
            : [t.num_rows, 0]
          : [0, 0];
      existingProv.push(...provs);
      const parts = otslParts(body);
      if (parts.length) {
        const frag = this.otslTableContent(parts, existing, ro, co);
        t.table_cells.push(...frag.table_cells);
        t.num_rows = Math.max(t.num_rows, ro + frag.num_rows);
        t.num_cols = Math.max(t.num_cols, co + frag.num_cols);
      }
      return;
    }
    const tbl = this.doc.table(label, {
      parent,
      prov: provs,
      layer: layerOf(head),
      data: tableData(),
    });
    tbl.data = this.otslTableContent(otslParts(body), tbl);
    this.registerThread(threadId, host, tbl);
    this.attach(tbl, [...captions, ...extra], footnotes);
  }

  /** Parse `<picture>` or a `<group>` wrapping it (with satellites). */
  private parsePicture(el: XEl, parent: P) {
    const direct = el.tagName === 'picture';
    const [extra, footnotes] = direct ? [[], []] : this.extractSatellites(el);
    const pictureEl = direct ? el : firstChild(el, 'picture');
    let captions = this.extractCaptions(el);
    if (!direct && !captions.length && pictureEl)
      captions = this.extractCaptions(pictureEl);

    const pic = this.doc.picture({
      parent,
      prov: pictureEl ? this.extractProvenance(pictureEl) : [],
      layer: pictureEl ? this.extractLayer(pictureEl) : undefined,
    });
    this.attach(pic, [...captions, ...extra], footnotes);
    if (!pictureEl) return;

    const cls = labelValueOf(split(pictureEl)[0]);
    if (cls && cls !== 'undefined')
      metaOf(pic).classification = {
        predictions: [{ confidence: 1.0, class_name: cls }],
      };
    this.applyMeta(pic, pictureEl);

    // Body: optional <src> and chart <tabular>s, then ordinary content.
    const body = split(pictureEl)[1].filter(isEl);
    const isPreamble = tags('src tabular');
    const i = body.findIndex(e => !isPreamble(e));
    const cut = i < 0 ? body.length : i;
    for (const e of body.slice(0, cut)) {
      if (e.tagName === 'tabular') {
        metaOf(pic).tabular_chart = {
          chart_data: this.otslTableContent(otslParts(split(e)[1])),
        };
      } else if (this.resolveImage) {
        const uri = attr(e, 'uri');
        if (uri) pic.image = this.resolveImage(uri);
      }
    }
    body.slice(cut).forEach(e => this.dispatch(e, pic));
  }

  /** A `<group>` wrapping a `<code>` with its satellites. */
  private parseCodeGroup(el: XEl, codeEl: XEl, parent: P) {
    const [captions, footnotes] = this.extractSatellites(el);
    const before = this.doc.texts.length;
    this.parseTextLike(codeEl, parent);
    const code = this.doc.texts
      .slice(before)
      .find((t): t is CodeItem => t.label === 'code');
    if (code) this.attach(code, captions, footnotes);
  }

  // ------------- Captions and satellites -------------

  /** Captions from an element head, or from a `<group>` wrapper around a float. */
  private extractCaptions(el: XEl): TextItemLike[] {
    return elems(el)
      .filter(c => c.tagName === 'caption')
      .flatMap(c => this.extractCaption(c) ?? []);
  }

  private extractCaption(capEl: XEl): TextItemLike | undefined {
    const text = getText(capEl);
    if (!text) return undefined;
    if (simpleTextBlock(capEl) === null)
      return this.parseInlineHost(capEl, undefined, 'caption');
    return this.doc.text('caption', text, {
      prov: this.extractProvenance(capEl),
      layer: this.extractLayer(capEl),
    });
  }

  /** Satellites of a float group: `<text>` as captions, `<footnote>` as footnotes. */
  private extractSatellites(el: XEl): [TextItemLike[], TextItemLike[]] {
    const captions: TextItemLike[] = [];
    const footnotes: TextItemLike[] = [];
    const labels = { text: 'caption', footnote: 'footnote' } as const;
    for (const node of elems(el)) {
      const label = own(labels, node.tagName);
      if (!label) continue;
      const sink = label === 'caption' ? captions : footnotes;
      const nested = elems(node).filter(
        c => !isHead(c) && !isSatelliteInline(c)
      );
      if (nested.length) {
        // nested content (e.g. a field region): a host item parsed like any container's
        sink.push(this.parseContainerHost(node, label));
        continue;
      }
      const text = getText(node);
      if (text)
        sink.push(
          this.doc.text(label, text, { prov: this.extractProvenance(node) })
        );
    }
    return [captions, footnotes];
  }

  /** A text-like element holding block content: a host item with that content nested under it. */
  private parseContainerHost(el: XEl, label: TextLabel) {
    const item = this.doc.text(label, '', {
      prov: provFor('', this.extractProvenance(el)),
      layer: this.extractLayer(el),
    });
    this.dispatchBodyNodes(split(el)[1], item);
    return item;
  }

  // ------------- Meta -------------

  /** Restore item meta from the element-head property elements. */
  private applyMeta(item: NodeItem, el: XEl) {
    if (!isDocling.DocItem(item)) return;
    for (const n of split(el)[0].filter(isEl)) {
      if (n.tagName === 'description') {
        const text = getText(n);
        if ('captions' in item && text)
          metaOf(item as FloatingItem).description = { text };
      } else if (n.tagName === 'summary') {
        const text = getText(n);
        if (text) metaOf(item).summary = { text };
      } else if (n.tagName === 'custom')
        elems(n).forEach(f => this.applyCustomMetaField(item, f));
    }
  }

  /** Read a custom field element: its text, or a map of child tag -> value(s). */
  private customFieldValue(el: XEl): unknown {
    const children = elems(el).filter(c => !isContent(c));
    if (!children.length) return getText(el);
    const grouped = new Map<string, unknown[]>();
    for (const c of children)
      grouped.set(c.tagName, [
        ...(grouped.get(c.tagName) ?? []),
        this.customFieldValue(c),
      ]);
    return Object.fromEntries(
      [...grouped].map(([tag, vals]) => [
        tag,
        vals.length === 1 ? vals[0] : vals,
      ])
    );
  }

  /** Map one `<custom>` child element onto `item.meta`. */
  private applyCustomMetaField(item: NodeItem, fieldEl: XEl) {
    const tag = fieldEl.tagName;
    const value = getText(fieldEl);
    const meta = metaOf(item);
    const [namespace, ...rest] = tag.split(META_NAMESPACE_DELIMITER);
    const name = rest.join(META_NAMESPACE_DELIMITER);

    if (tag === META_TAG_SUMMARY) {
      if (value) meta.summary = { text: value };
    } else if (tag === META_TAG_DESCRIPTION) {
      if (value && 'captions' in item)
        metaOf(item as FloatingItem).description = { text: value };
    } else if (tag === META_TAG_SMILES) {
      if (value && isDocling.PictureItem(item))
        metaOf(item).molecule = { smi: value };
    } else if (namespace && name) {
      const fields = meta as unknown as Record<string, unknown>;
      let fieldValue = this.customFieldValue(fieldEl);
      // a repeated top-level tag collects its values in a list
      if (Object.hasOwn(fields, tag) && fields[tag] != null) {
        const existing = fields[tag];
        fieldValue = Array.isArray(existing)
          ? [...existing, fieldValue]
          : [existing, fieldValue];
      }
      fields[tag] = fieldValue;
    }
  }

  // ------------- OTSL tables -------------

  /**
   * Parse OTSL parts into TableData. `owner` is given for real tables (cells
   * with nested elements become rich cells under it) and absent for chart
   * data, which has no document context.
   */
  private otslTableContent(
    texts: XNode[],
    owner?: NodeItem,
    ro = 0,
    co = 0
  ): FullTableData {
    // Rows are the runs of structural tokens between `nl`s (empty runs vanish).
    const rows: string[][] = [];
    let open = false;
    for (const t of texts.flatMap(x => tokenOf(x) ?? [])) {
      if (t === 'nl') open = false;
      else {
        if (!open) rows.push([]);
        open = true;
        rows.at(-1)!.push(t);
      }
    }
    const count = (
      r: number,
      c: number,
      dr: number,
      dc: number,
      which: string[]
    ) => {
      let span = 0;
      while (which.includes(rows[r + span * dr]?.[c + span * dc])) span++;
      return span;
    };

    const cells = [];
    let r = 0;
    let c = 0;
    for (const [i, item] of texts.entries()) {
      const t = tokenOf(item);
      if (t === 'nl') {
        r++;
        c = 0;
      }
      if (!t || t === 'nl') continue;

      let cellText = '';
      let bbox;
      let parts: XNode[] = [];
      let next = i + 1;
      if (t !== 'ecel' && next < texts.length) {
        // Optional cell box (four locations), then the body up to the next token.
        const locs: XEl[] = [];
        while (locs.length < 4) {
          const x = texts[next + locs.length];
          if (!isEl(x) || !isLocation(x)) break;
          locs.push(x);
        }
        if (locs.length === 4) {
          next += 4;
          if (owner) {
            const l = this.locations(locs);
            this.ensurePage(l[3].r || this.res);
            bbox = bboxOf(l.map(x => x.v));
          }
        }
        const stop = texts.findIndex((x, k) => k >= next && tokenOf(x));
        const end = stop < 0 ? texts.length : stop;
        parts = texts.slice(next, end);
        next = end;
        cellText = parts
          .map(p => (isText(p) ? data(p) : collectText(p as XEl)))
          .join('');
      }

      const isContinuation = t === 'lcel' || t === 'ucel' || t === 'xcel';
      if (!isContinuation || hasContent(cellText) || parts.length) {
        const nextRight = tokenOf(texts[next]);
        const nextBottom = rows[r + 1]?.[c] ?? '';
        const colSpan =
          nextRight === 'lcel' || nextRight === 'xcel'
            ? 1 + count(r, c + 1, 0, 1, ['lcel', 'xcel'])
            : 1;
        const rowSpan =
          nextBottom === 'ucel' || nextBottom === 'xcel'
            ? 1 + count(r + 1, c, 1, 0, ['ucel', 'xcel'])
            : 1;
        const pos = {
          text: cellText,
          row_span: rowSpan,
          col_span: colSpan,
          start_row_offset_idx: r + ro,
          end_row_offset_idx: r + rowSpan + ro,
          start_col_offset_idx: c + co,
          end_col_offset_idx: c + colSpan + co,
          bbox,
        };

        const els = parts.filter(isEl);
        if (els.length && owner) {
          const virtual = isVirtualText(parts);
          const group = this.doc.group(
            virtual ? 'inline' : 'unspecified',
            undefined,
            owner
          );
          if (virtual) this.parseInlineRuns(parts, group);
          else els.forEach(e => this.dispatch(e, group));
          cells.push(cell({ ...pos, ref: ref(group) }));
        } else
          cells.push(
            cell({
              ...pos,
              column_header: t === 'ched' || t === 'corn',
              row_header: t === 'rhed' || t === 'corn',
              row_section: t === 'srow',
            })
          );
      }
      c++;
    }
    return tableData(
      cells,
      rows.length,
      Math.max(0, ...rows.map(g => g.length))
    );
  }
}
