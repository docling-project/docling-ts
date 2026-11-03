/**
 * Structural DOM types plus a parser shim. Nothing here needs the DOM lib: the
 * browser's `DOMParser` and the API-compatible one of `@xmldom/xmldom` both fit.
 */
export interface XNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<XNode>;
  attributes?: ArrayLike<{ name: string; value: string }>;
  tagName?: string;
}
export interface XEl extends XNode {
  tagName: string;
  getAttribute(name: string): string | null;
  getElementsByTagName(name: string): ArrayLike<XEl>;
}
export type XmlParserCtor = new (options?: {
  onError?: (level: string, msg: string) => void;
}) => {
  parseFromString(text: string, type: string): { documentElement: XEl | null };
};

export const isEl = (n: unknown): n is XEl =>
  (n as XNode | undefined)?.nodeType === 1;
/** Text and CDATA sections (both are `Text` in Python's minidom). */
export const isText = (n: XNode) => n.nodeType === 3 || n.nodeType === 4;
export const data = (n: XNode) => n.nodeValue ?? '';
export const kids = (n: XNode) => Array.from(n.childNodes);
export const elems = (n: XNode) => kids(n).filter(isEl);
export const attr = (el: XEl, name: string) => el.getAttribute(name) ?? '';
export const blank = (n: XNode) => isText(n) && !data(n).trim();

function fail(msg: string): never {
  throw new Error(`Invalid DocLang XML: ${msg}`);
}

/** Parse XML text into its root element, enforcing depth and size budgets. */
export function parseXml(
  text: string,
  {
    DOMParser = (globalThis as { DOMParser?: XmlParserCtor }).DOMParser,
    maxDepth = 128,
    maxElements = 1_000_000,
  }: { DOMParser?: XmlParserCtor; maxDepth?: number; maxElements?: number } = {}
): XEl {
  if (!DOMParser)
    fail('no DOMParser available: pass one, e.g. from "@xmldom/xmldom"');
  const root = new DOMParser({
    onError: (level, msg) => level !== 'warning' && fail(msg),
  }).parseFromString(text, 'text/xml').documentElement;
  if (
    !root ||
    root.tagName === 'parsererror' ||
    root.getElementsByTagName('parsererror').length
  )
    fail('parse error');

  let count = 0;
  const check = (el: XEl, depth: number): void => {
    if (++count > maxElements) fail(`more than ${maxElements} elements`);
    if (depth > maxDepth) fail(`nesting deeper than ${maxDepth}`);
    elems(el).forEach(c => check(c, depth + 1));
  };
  check(root, 1);
  return root;
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/>/g, '&gt;');

/** Serialize like Python's `minidom.toxml()` (used for odd table-cell text). */
export function toXml(n: XNode): string {
  if (isText(n))
    return n.nodeType === 4 ? `<![CDATA[${data(n)}]]>` : esc(data(n));
  if (!isEl(n)) return n.nodeType === 8 ? `<!--${data(n)}-->` : '';
  const attrs = Array.from(
    n.attributes ?? [],
    a => ` ${a.name}="${esc(a.value)}"`
  ).join('');
  const inner = kids(n).map(toXml).join('');
  return inner
    ? `<${n.tagName}${attrs}>${inner}</${n.tagName}>`
    : `<${n.tagName}${attrs}/>`;
}
