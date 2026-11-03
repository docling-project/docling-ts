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

const INLINE =
  'content bold italic underline strikethrough superscript subscript handwriting rtl br checkbox';

/** Tags that precede the body of any element. */
export const isHead = tags(
  'label layer href location caption description summary custom thread xref hour minute second centisecond'
);

/** Inline markup, which is all a "simple text" element may contain. */
export const isInline = tags(INLINE);
export const isFieldInline = tags(`${INLINE} hint`);

/** Semantic and grouping tokens: real child items, never "virtual text". */
export const isBlock = tags(
  'heading text footnote page_header page_footer picture field_region field_item field_heading hint formula code list table tabular group'
);
export const isOtsl = tags('fcel ecel lcel ucel xcel nl ched rhed srow corn');

const words = (s: string) => new Set(s.split(' '));

export const LAYERS = words('body furniture background invisible notes');
export const GROUP_LABELS = words(
  'unspecified list ordered_list chapter section sheet slide form_area key_value_area comment_section inline picture_area'
);

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
