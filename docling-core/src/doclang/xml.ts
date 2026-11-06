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

/** XML whitespace (`_XML_WHITESPACE`): unlike `trim()`, never U+00A0 etc. */
export const strip = (s: string) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
export const lstrip = (s: string) => s.replace(/^[ \t\r\n]+/, '');
export const rstrip = (s: string) => s.replace(/[ \t\r\n]+$/, '');
/** Does `s` hold anything but XML whitespace? */
export const hasContent = (s: string) => /[^ \t\r\n]/.test(s);
/** Is the node a text node holding only XML whitespace? */
export const blank = (n: XNode) => isText(n) && !hasContent(data(n));

function fail(msg: string): never {
  throw new Error(`Invalid DocLang XML: ${msg}`);
}

// Characters that can only be text (see `_repair_unescaped_xml_text`).
const CDATA_SECTION = /(<!\[CDATA\[[\s\S]*?\]\]>)/;
// eslint-disable-next-line no-control-regex
const ILLEGAL_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
const BARE_AMP = /&(?!(?:[A-Za-z][\p{L}\p{N}_.-]*|#[0-9]+|#x[0-9A-Fa-f]+);)/gu;
const BARE_LT = /<(?![A-Za-z_:/!?])/g;
// Anything but a predefined or numeric reference is not well-formed.
const BAD_REFERENCE = /&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);)/;

/**
 * Escape characters that can only be text, leaving markup and CDATA untouched.
 *
 * Fixes bare `&`, a `<` that cannot start markup, a stray `]]>`, and drops
 * control characters that XML 1.0 forbids. A `<` followed by a name character
 * is never touched, so no tag structure is guessed.
 */
export function repairUnescapedXmlText(text: string): string {
  const parts = text.replace(ILLEGAL_CONTROL, '').split(CDATA_SECTION);
  // Odd indices are the CDATA sections themselves.
  return parts
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(BARE_AMP, '&amp;')
            .replace(BARE_LT, '&lt;')
            .replaceAll(']]>', ']]&gt;')
    )
    .join('');
}

/**
 * Reject what a strict parser (expat) does but the lenient DOM parsers accept:
 * control characters, a bare `&` or unknown entity, and `]]>` in text.
 */
function assertWellFormedText(text: string) {
  const bad = () => fail('not well-formed (invalid token)');
  if (new RegExp(ILLEGAL_CONTROL.source).test(text)) bad();
  const parts = text.split(/(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->)/);
  for (let i = 0; i < parts.length; i += 2)
    if (BAD_REFERENCE.test(parts[i]) || parts[i].includes(']]>')) bad();
}

/** Parse XML text into its root element, enforcing size, depth and element budgets. */
export function parseXml(
  text: string,
  {
    DOMParser = (globalThis as { DOMParser?: XmlParserCtor }).DOMParser,
    maxXmlBytes = 128 * 1024 * 1024,
    maxDepth = 128,
    maxElements = 1_000_000,
  }: {
    DOMParser?: XmlParserCtor;
    maxXmlBytes?: number;
    maxDepth?: number;
    maxElements?: number;
  } = {}
): XEl {
  if (maxXmlBytes <= 0)
    throw new Error(`maxXmlBytes must be positive, got ${maxXmlBytes}`);
  if (new TextEncoder().encode(text).length > maxXmlBytes)
    throw new Error(`DocLang XML exceeds size limit of ${maxXmlBytes} bytes`);
  if (!DOMParser)
    fail('no DOMParser available: pass one, e.g. from "@xmldom/xmldom"');
  assertWellFormedText(text);
  const root = new DOMParser({
    onError: (level, msg) => level !== 'warning' && fail(msg),
  }).parseFromString(text, 'text/xml').documentElement;
  if (
    !root ||
    root.tagName === 'parsererror' ||
    root.getElementsByTagName('parsererror').length
  )
    fail('parse error');

  if (maxDepth <= 0)
    throw new Error(`maxDepth must be positive, got ${maxDepth}`);
  if (maxElements <= 0)
    throw new Error(`maxElements must be positive, got ${maxElements}`);
  let count = 0;
  const check = (el: XEl, depth: number): void => {
    if (++count > maxElements)
      throw new Error(
        `DocLang XML exceeds element count limit of ${maxElements}`
      );
    if (depth > maxDepth)
      throw new Error(`DocLang XML exceeds nesting depth limit of ${maxDepth}`);
    elems(el).forEach(c => check(c, depth + 1));
  };
  check(root, 1);
  return root;
}
