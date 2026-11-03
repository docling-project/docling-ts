import type { ImageRef } from '../types';
import { type XEl, type XmlParserCtor, parseXml } from './xml';
import { Reader } from './reader';

export interface DeserializeDocLangOptions {
  /** Page number for content that carries no `<page_break>`. Default 1. */
  pageNo?: number;
  /**
   * `DOMParser` implementation. Defaults to the browser's global; in Node pass
   * the one from `@xmldom/xmldom`.
   */
  DOMParser?: XmlParserCtor;
  maxDepth?: number;
  maxElements?: number;
  /**
   * Resolves the `uri` of a picture's `<src>` element. Without it, picture
   * sources are ignored.
   */
  resolveImage?: (uri: string) => ImageRef;
}

/** Deserialize DocLang XML into a DoclingDocument-shaped JSON object. */
export function deserializeDocLang(
  text: string,
  { pageNo = 1, resolveImage, ...parser }: DeserializeDocLangOptions = {}
) {
  let root: XEl = parseXml(text, parser);
  if (root.tagName !== 'doclang') {
    root = root.getElementsByTagName('doclang')[0] ?? root;
  }
  return new Reader(pageNo, resolveImage).run(root);
}
