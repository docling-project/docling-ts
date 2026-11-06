/**
 * DocLang 0.9 whitespace handling (spec "Content encoding and whitespace
 * handling"), a port of `_apply_whitespace_rules` in
 * `docling_core/transforms/serializer/_doclang_utils.py`.
 *
 * Whitespace outside text blocks and at their edges is dropped; any other
 * whitespace sequence becomes one space, kept in the text node holding its
 * first character. `<content>` is literal. Afterwards a text node holds
 * exactly its own reading.
 */
import {
  type XEl,
  type XNode,
  data,
  hasContent,
  isEl,
  isText,
  kids,
} from './xml';
import {
  isHead,
  isRawText,
  isVirtualInline,
  isVirtualSemantic,
  isWhitespaceOpaque,
} from './vocab';

/** True when `nodes` hold raw text or text-level elements of their own. */
export const isVirtualText = (nodes: XNode[]): boolean =>
  nodes.some(
    n => (isText(n) && hasContent(data(n))) || (isEl(n) && isVirtualInline(n))
  );

/** May `node` be part of a virtual `<text>` (in a list item or cell)? */
const isVirtualTextPart = (n: XNode) =>
  isText(n) || (isEl(n) && (isVirtualInline(n) || isVirtualSemantic(n)));

type Visit = (nodes: XNode[]) => void;

/** Call `visit` with the nodes of each text block under `el`, innermost first. */
function forEachTextBlock(el: XEl, visit: Visit): void {
  if (isWhitespaceOpaque(el)) return;
  if (isRawText(el)) {
    visit(kids(el));
    return;
  }
  // Not a text block itself; unwrapped text between its child elements is a
  // virtual <text>.
  let segment: XNode[] = [];
  const visitSegment = () => {
    if (isVirtualText(segment)) {
      visit(segment);
      return;
    }
    // No text of its own: whitespace between blocks, which are read on their own.
    visit(segment.filter(n => !isEl(n) || isHead(n)));
    for (const n of segment)
      if (isEl(n) && isVirtualSemantic(n)) forEachTextBlock(n, visit);
  };
  for (const n of kids(el)) {
    if (isVirtualTextPart(n) || (isEl(n) && isHead(n))) {
      segment.push(n);
      continue;
    }
    visitSegment();
    segment = [];
    if (isEl(n)) forEachTextBlock(n, visit);
  }
  visitSegment();
}

/** A flattened text-block entry: a text node, `<content>`, or any other visible item. */
type Token = { text: XNode } | { content: XEl } | { item: true };

/** Flatten a text block, visiting the text blocks nested in it (element heads etc.). */
function flatten(nodes: XNode[], visit: Visit): Token[] {
  const out: Token[] = [];
  for (const n of nodes) {
    if (isText(n)) out.push({ text: n });
    else if (!isEl(n))
      continue; // comments and processing instructions
    else if (isHead(n))
      forEachTextBlock(n, visit); // read separately, as if removed
    else if (n.tagName === 'content') out.push({ content: n });
    else if (n.tagName === 'page_break')
      continue; // transparent to the reading
    else if (isRawText(n)) out.push(...flatten(kids(n), visit));
    else {
      out.push({ item: true });
      if (n.tagName !== 'br') forEachTextBlock(n, visit);
    }
  }
  return out;
}

const contentText = (el: XEl) => kids(el).filter(isText).map(data).join('');

/**
 * The reading of each token: rules 2-4 for text nodes, literal for `<content>`.
 * Other visible items read as `"\0"`, a placeholder for something that is not
 * a space.
 */
function readTextBlock(tokens: Token[]): string[] {
  const reading: string[][] = tokens.map(() => []);
  let seenContent = false;
  let inSequence = false;
  // Text nodes holding the first character of each sequence since the last content.
  const pending: number[] = [];

  const resolvePending = () => {
    // Content follows: sequences that also have content before them read as a space.
    if (seenContent) for (const i of pending) reading[i].push(' ');
    pending.length = 0;
  };

  tokens.forEach((tok, idx) => {
    if ('text' in tok) {
      for (const ch of data(tok.text)) {
        if (' \t\r\n'.includes(ch)) {
          if (!inSequence) {
            pending.push(idx);
            inSequence = true;
          }
          continue;
        }
        resolvePending();
        inSequence = false;
        seenContent = true;
        reading[idx].push(ch);
      }
      return;
    }
    const literal = 'content' in tok ? contentText(tok.content) : '\0';
    if (literal) {
      resolvePending();
      seenContent = true;
      reading[idx].push(literal);
      inSequence = false;
    }
  });
  // Sequences still pending sit at the end of the block: dropped (rule 2).
  return reading.map(chars => chars.join(''));
}

/** Rewrite the text nodes under `root` in place, as DocLang 0.9 reads them. */
export function applyWhitespaceRules(root: XEl): void {
  const visit: Visit = nodes => {
    const tokens = flatten(nodes, visit);
    const reads = readTextBlock(tokens);
    tokens.forEach((tok, i) => {
      if ('text' in tok) tok.text.nodeValue = reads[i];
    });
  };
  forEachTextBlock(root, visit);
}
