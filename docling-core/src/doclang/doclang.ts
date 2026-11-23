import type { ImageRef } from '../types';
import {
  type XEl,
  type XmlParserCtor,
  parseXml,
  repairUnescapedXmlText,
} from './xml';
import { Reader } from './reader';

export interface DeserializeDocLangOptions {
  /** Page number for content that carries no `<page_break>`. Default 1. */
  pageNo?: number;
  /**
   * `DOMParser` implementation. Defaults to the browser's global; in Node pass
   * the one from `@xmldom/xmldom`.
   */
  DOMParser?: XmlParserCtor;
  /** Max size of the XML text in UTF-8 bytes. Default 128 MiB. */
  maxXmlBytes?: number;
  /** Max element nesting depth. Default 128. */
  maxDepth?: number;
  /** Max number of elements. Default 1,000,000. */
  maxElements?: number;
  /**
   * Repair unescaped text (a bare `&`, a `<` that cannot start markup, a
   * stray `]]>`, illegal control characters) before parsing. Tag structure
   * is never altered. Default `false`: the input must be well-formed XML.
   */
  repairUnescapedText?: boolean;
  /**
   * Receives warnings, e.g. for the unsupported `<chapter>` and `<audio>`
   * parts of a `<track>`, which are skipped, or for a cue block with an
   * invalid timestamp. Default: `console.warn`.
   */
  onWarning?: (message: string) => void;
  /**
   * Resolves the `uri` of a picture's `<src>` element, and of the
   * `<frame>`/`<cover>` image of a `<track>`. Without it, these images are
   * ignored.
   */
  resolveImage?: (uri: string) => ImageRef;
}

/** Deserialize DocLang XML into a DoclingDocument-shaped JSON object. */
export function deserializeDocLang(
  text: string,
  {
    pageNo = 1,
    resolveImage,
    repairUnescapedText = false,
    onWarning,
    ...parser
  }: DeserializeDocLangOptions = {}
) {
  let root: XEl = parseXml(
    repairUnescapedText ? repairUnescapedXmlText(text) : text,
    parser
  );
  if (root.tagName !== 'doclang') {
    root = root.getElementsByTagName('doclang')[0] ?? root;
  }
  return new Reader(pageNo, resolveImage, onWarning).run(root);
}
