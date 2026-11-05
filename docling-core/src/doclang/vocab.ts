import type { CodeLanguageLabel } from '../types';

/** DocLang vocabulary, mirroring `serializer/_doclang_utils.py`. */

/** Predicate: is the argument an element named in this space-separated list? */
export const tags = (names: string) => {
  const set = new Set(names.split(' '));
  return (n?: unknown) =>
    set.has((n as { tagName?: string } | undefined)?.tagName ?? '');
};

/** Own-key lookup, so a tag like `<constructor>` never hits a prototype. */
export const own = <V>(o: Record<string, V>, k: string): V | undefined =>
  Object.hasOwn(o, k) ? o[k] : undefined;

const words = (s: string) => new Set(s.split(' '));

/** Tags that precede the body of any element (`_ELEMENT_HEAD_TAGS`). */
export const isHead = tags(
  'label layer href location caption description summary custom thread xref hour minute second centisecond'
);

/** Formatting tags, which can themselves hold mixed content (`_FORMATTING_TAGS`). */
export const FORMATTING =
  'bold italic underline strikethrough subscript superscript';
export const isFormatting = tags(FORMATTING);

/**
 * Elements whose body allows raw text; a text block spans nested ones
 * (`_RAW_TEXT_TAGS`). `chapter` and `voice` are `<track>` elements, which are
 * not in the vocabulary yet.
 */
export const isRawText = tags(
  `text heading caption description summary footnote page_header page_footer formula code key value field_heading hint marker handwriting rtl content chapter voice ${FORMATTING}`
);

/** Tags that may continue a virtual `<text>` (`_VIRTUAL_TEXT_INLINE_TAGS`). */
export const isVirtualInline = tags(
  `${FORMATTING} handwriting rtl content br checkbox`
);

/** Semantic elements inline within a virtual `<text>` (`_VIRTUAL_TEXT_SEMANTIC_TAGS`). */
export const isVirtualSemantic = tags('code formula');

/** Left as written by the whitespace rules (`_WHITESPACE_OPAQUE_TAGS`). */
export const isWhitespaceOpaque = tags('custom track');

/** Inline markup in a field's `<key>` or `<value>` body (`_FIELD_INLINE_BODY_TAGS`). */
export const isFieldInline = tags(
  'content bold italic underline strikethrough subscript superscript handwriting rtl br checkbox hint'
);

/** Tags that may start a list item's virtual text (`_LIST_ITEM_VIRTUAL_TEXT_CONTENT_TAGS`). */
export const isListItemVirtualContent = tags(
  'content bold italic underline strikethrough superscript subscript handwriting rtl br checkbox'
);

/** Siblings that stay inside a list item's segment (`_LIST_ITEM_SEGMENT_SIBLING_TAGS`). */
export const isListItemSibling = tags('list picture');

/** Text-like tags handled by `_parse_text_like`. */
export const isTextLike = tags(
  `text caption footnote page_header page_footer code formula ldiv ${FORMATTING} content handwriting rtl`
);

/** Mixed-content hosts that keep their label (`_INLINE_HOST_LABELS`). */
export const isInlineHost = tags(
  'text caption footnote page_header page_footer'
);

/** Tags that make up the structure of an OTSL table. */
export const isOtsl = tags('fcel ecel lcel ucel xcel nl ched rhed srow corn');

/**
 * Semantic and grouping tokens (`DocLangCategory.SEMANTIC` / `GROUPING`): real
 * child items, never "virtual text".
 */
export const isSemanticOrGrouping = tags(
  'heading text caption footnote page_header page_footer picture field_region field_item field_heading hint formula code checkbox list table tabular group'
);

export const LAYERS = words('body furniture background invisible notes');
export const GROUP_LABELS = words(
  'unspecified list ordered_list chapter section sheet slide form_area key_value_area comment_section inline picture_area'
);

/** DocLang custom-vocabulary tags of the standard Docling meta fields. */
export const META_NAMESPACE_DELIMITER = '__';
export const META_TAG_SUMMARY = 'docling__summary';
export const META_TAG_DESCRIPTION = 'docling__description';
export const META_TAG_SMILES = 'docling__smiles';

// Linguist name -> CodeLanguageLabel (the Python reverse map).
const LANG = new Map<string, string>([
  ...[
    ...words(
      'Ada Awk C C# C++ CMake COBOL CSS Ceylon Clojure Crystal Cuda Cython D Dart Dockerfile Elixir Erlang Forth Go HTML Haskell Haxe Java JavaScript JSON Julia Kotlin Lua MoonScript Nim OCaml PHP Pascal Perl Prolog Python Racket Ruby Rust SQL Scala Scheme Swift TypeScript XML YAML'
    ),
  ].map((k): [string, string] => [k, k]),
  ...Object.entries({
    Shell: 'Bash',
    Fortran: 'FORTRAN',
    TeX: 'Latex',
    'Common Lisp': 'Lisp',
    MATLAB: 'Matlab',
    'Objective-C': 'ObjectiveC',
    'Standard ML': 'SML',
    'Visual Basic .NET': 'VisualBasic',
  }),
]);

export const codeLang = (label: string) =>
  (LANG.get(label) ?? 'unknown') as CodeLanguageLabel;
