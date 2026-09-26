/* tslint:disable */

export type CoordOrigin = 'TOPLEFT' | 'BOTTOMLEFT';
export type ContentLayer =
  'body' | 'furniture' | 'background' | 'invisible' | 'notes';
export type CodeLanguageLabel =
  | 'Ada'
  | 'Awk'
  | 'Bash'
  | 'bc'
  | 'C'
  | 'C#'
  | 'C++'
  | 'CMake'
  | 'COBOL'
  | 'CSS'
  | 'Ceylon'
  | 'Clojure'
  | 'Crystal'
  | 'Cuda'
  | 'Cython'
  | 'D'
  | 'Dart'
  | 'dc'
  | 'Dockerfile'
  | 'DocLang'
  | 'Elixir'
  | 'Erlang'
  | 'FORTRAN'
  | 'Forth'
  | 'Go'
  | 'HTML'
  | 'Haskell'
  | 'Haxe'
  | 'Java'
  | 'JavaScript'
  | 'JSON'
  | 'Julia'
  | 'Kotlin'
  | 'Latex'
  | 'Lisp'
  | 'Lua'
  | 'Matlab'
  | 'MoonScript'
  | 'Nim'
  | 'OCaml'
  | 'ObjectiveC'
  | 'Octave'
  | 'PHP'
  | 'Pascal'
  | 'Perl'
  | 'Prolog'
  | 'Python'
  | 'Racket'
  | 'Ruby'
  | 'Rust'
  | 'SML'
  | 'SQL'
  | 'Scala'
  | 'Scheme'
  | 'Swift'
  | 'Tikz'
  | 'TypeScript'
  | 'unknown'
  | 'VisualBasic'
  | 'XML'
  | 'YAML';
export type DocItemLabel =
  | 'caption'
  | 'chart'
  | 'footnote'
  | 'formula'
  | 'list_item'
  | 'page_footer'
  | 'page_header'
  | 'picture'
  | 'section_header'
  | 'table'
  | 'text'
  | 'title'
  | 'document_index'
  | 'code'
  | 'checkbox_selected'
  | 'checkbox_unselected'
  | 'form'
  | 'key_value_region'
  | 'grading_scale'
  | 'handwritten_text'
  | 'empty_value'
  | 'paragraph'
  | 'reference'
  | 'field_region'
  | 'field_heading'
  | 'field_item'
  | 'field_key'
  | 'field_value'
  | 'field_hint'
  | 'marker';
export type GroupLabel =
  | 'unspecified'
  | 'list'
  | 'ordered_list'
  | 'chapter'
  | 'section'
  | 'sheet'
  | 'slide'
  | 'form_area'
  | 'key_value_area'
  | 'comment_section'
  | 'inline'
  | 'picture_area';
export type PictureClassificationLabel =
  | 'bar_chart'
  | 'box_plot'
  | 'flow_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'scatter_plot'
  | 'table'
  | 'other_chart'
  | 'full_page_image'
  | 'page_thumbnail'
  | 'photograph'
  | 'chemistry_structure'
  | 'bar_code'
  | 'icon'
  | 'logo'
  | 'qr_code'
  | 'signature'
  | 'stamp'
  | 'engineering_drawing'
  | 'screenshot_from_computer'
  | 'screenshot_from_manual'
  | 'geographical_map'
  | 'topographical_map'
  | 'calendar'
  | 'crossword_puzzle'
  | 'music'
  | 'other'
  | 'cad_drawing'
  | 'electrical_diagram'
  | 'map'
  | 'heatmap'
  | 'chemistry_markush_structure'
  | 'chemistry_molecular_structure'
  | 'natural_image'
  | 'picture_group'
  | 'remote_sensing'
  | 'scatter_chart'
  | 'screenshot'
  | 'stacked_bar_chart'
  | 'stratigraphic_chart';
export type TableCellLabel =
  'col_header' | 'row_header' | 'row_section' | 'body';
export type GraphCellLabel = 'unspecified' | 'key' | 'value' | 'checkbox';
export type GraphLinkLabel =
  'unspecified' | 'to_value' | 'to_key' | 'to_parent' | 'to_child';
export type HumanLanguageLabel =
  | 'aa'
  | 'ab'
  | 'ae'
  | 'af'
  | 'ak'
  | 'am'
  | 'an'
  | 'ar'
  | 'as'
  | 'av'
  | 'ay'
  | 'az'
  | 'ba'
  | 'be'
  | 'bg'
  | 'bh'
  | 'bi'
  | 'bm'
  | 'bn'
  | 'bo'
  | 'br'
  | 'bs'
  | 'ca'
  | 'ce'
  | 'ch'
  | 'co'
  | 'cr'
  | 'cs'
  | 'cu'
  | 'cv'
  | 'cy'
  | 'da'
  | 'de'
  | 'dv'
  | 'dz'
  | 'ee'
  | 'el'
  | 'en'
  | 'eo'
  | 'es'
  | 'et'
  | 'eu'
  | 'fa'
  | 'ff'
  | 'fi'
  | 'fj'
  | 'fo'
  | 'fr'
  | 'fy'
  | 'ga'
  | 'gd'
  | 'gl'
  | 'gn'
  | 'gu'
  | 'gv'
  | 'ha'
  | 'he'
  | 'hi'
  | 'ho'
  | 'hr'
  | 'ht'
  | 'hu'
  | 'hy'
  | 'hz'
  | 'ia'
  | 'id'
  | 'ie'
  | 'ig'
  | 'ii'
  | 'ik'
  | 'io'
  | 'is'
  | 'it'
  | 'iu'
  | 'ja'
  | 'jv'
  | 'ka'
  | 'kg'
  | 'ki'
  | 'kj'
  | 'kk'
  | 'kl'
  | 'km'
  | 'kn'
  | 'ko'
  | 'kr'
  | 'ks'
  | 'ku'
  | 'kv'
  | 'kw'
  | 'ky'
  | 'la'
  | 'lb'
  | 'lg'
  | 'li'
  | 'ln'
  | 'lo'
  | 'lt'
  | 'lu'
  | 'lv'
  | 'mg'
  | 'mh'
  | 'mi'
  | 'mk'
  | 'ml'
  | 'mn'
  | 'mr'
  | 'ms'
  | 'mt'
  | 'my'
  | 'na'
  | 'nb'
  | 'nd'
  | 'ne'
  | 'ng'
  | 'nl'
  | 'nn'
  | 'no'
  | 'nr'
  | 'nv'
  | 'ny'
  | 'oc'
  | 'oj'
  | 'om'
  | 'or'
  | 'os'
  | 'pa'
  | 'pi'
  | 'pl'
  | 'ps'
  | 'pt'
  | 'qu'
  | 'rm'
  | 'rn'
  | 'ro'
  | 'ru'
  | 'rw'
  | 'sa'
  | 'sc'
  | 'sd'
  | 'se'
  | 'sg'
  | 'sh'
  | 'si'
  | 'sk'
  | 'sl'
  | 'sm'
  | 'sn'
  | 'so'
  | 'sq'
  | 'sr'
  | 'ss'
  | 'st'
  | 'su'
  | 'sv'
  | 'sw'
  | 'ta'
  | 'te'
  | 'tg'
  | 'th'
  | 'ti'
  | 'tk'
  | 'tl'
  | 'tn'
  | 'to'
  | 'tr'
  | 'ts'
  | 'tt'
  | 'tw'
  | 'ty'
  | 'ug'
  | 'uk'
  | 'ur'
  | 'uz'
  | 've'
  | 'vi'
  | 'vo'
  | 'wa'
  | 'wo'
  | 'xh'
  | 'yi'
  | 'yo'
  | 'za'
  | 'zh'
  | 'zu';
export type MetaFieldName =
  | 'summary'
  | 'language'
  | 'entities'
  | 'keywords'
  | 'topics'
  | 'description'
  | 'classification'
  | 'molecule'
  | 'tabular_chart';
export type Script = 'baseline' | 'sub' | 'super';
export type Orientation = 'rot_0' | 'rot_90' | 'rot_180' | 'rot_270';
export type ImageRefMode = 'placeholder' | 'embedded' | 'referenced';
export type CaptionPlacement = 'standard' | 'layout';

export interface BoundingBox {
  l: number;
  t: number;
  r: number;
  b: number;
  coord_origin?: CoordOrigin;
}
export interface Size {
  width?: number;
  height?: number;
}
export interface RefItem {
  $ref: string;
}
export interface ProvenanceItem {
  page_no: number;
  bbox: BoundingBox;
  charspan: [number, number];
}
export interface Formatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  script?: Script;
}
export interface ImageRef {
  mimetype: string;
  dpi: number;
  size: Size;
  uri: string;
}
export interface DocumentOrigin {
  mimetype: string;
  binary_hash: number;
  filename: string;
  uri?: string | null;
}

// ---------------------------------------------------------------------------
// Meta models
// ---------------------------------------------------------------------------

export interface BasePrediction {
  confidence?: number | null;
  created_by?: string | null;
  [key: string]: unknown;
}
export interface SummaryMetaField extends BasePrediction {
  text: string;
}
export interface LanguageMetaField extends BasePrediction {
  code: HumanLanguageLabel;
}
export interface EntityMention extends BasePrediction {
  text: string;
  orig?: string | null;
  label?: string | null;
  charspan?: [number, number] | null;
}
export interface EntitiesMetaField {
  mentions: EntityMention[];
  [key: string]: unknown;
}
export interface KeywordsMetaField {
  values: string[];
  [key: string]: unknown;
}
export interface TopicsMetaField {
  values: string[];
  [key: string]: unknown;
}
export interface BaseMeta {
  summary?: SummaryMetaField | null;
  language?: LanguageMetaField | null;
  entities?: EntitiesMetaField | null;
  keywords?: KeywordsMetaField | null;
  topics?: TopicsMetaField | null;
  [key: string]: unknown;
}
export interface DescriptionMetaField extends BasePrediction {
  text: string;
}
export interface FloatingMeta extends BaseMeta {
  description?: DescriptionMetaField | null;
}
export interface CodeMetaField extends BasePrediction {
  text: string;
  language?: CodeLanguageLabel | null;
}

// ---------------------------------------------------------------------------
// Node items
// ---------------------------------------------------------------------------

export interface NodeItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer;
  meta?: BaseMeta | null;
}
export interface FineRef extends RefItem {
  range?: [number, number] | null;
}
export interface TrackSource {
  kind: 'track';
  start_time: number;
  end_time: number;
  identifier?: string | null;
  voice?: string | null;
}
export type SourceType = TrackSource;

export interface DocItem extends NodeItem {
  label?: DocItemLabel;
  prov?: ProvenanceItem[];
  source?: SourceType[];
  comments?: FineRef[];
}
export interface FloatingItem extends DocItem {
  meta?: FloatingMeta | null;
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
}

// ---------------------------------------------------------------------------
// Group items
// ---------------------------------------------------------------------------

export interface GroupItem extends NodeItem {
  name?: string;
  label?: GroupLabel;
}
/**
 * ListGroup (formerly UnorderedList).
 */
export interface ListGroup extends NodeItem {
  name?: string;
  label?: 'list';
}
/** @deprecated Use ListGroup instead. */
export type UnorderedList = ListGroup;
/**
 * OrderedList.
 * @deprecated Use ListGroup instead.
 */
export interface OrderedList extends NodeItem {
  name?: string;
  label?: 'ordered_list';
}
export interface InlineGroup extends NodeItem {
  name?: string;
  label?: 'inline';
}

// ---------------------------------------------------------------------------
// Text items
// ---------------------------------------------------------------------------

export interface TextItem extends DocItem {
  label?:
    | 'caption'
    | 'checkbox_selected'
    | 'checkbox_unselected'
    | 'footnote'
    | 'page_footer'
    | 'page_header'
    | 'paragraph'
    | 'reference'
    | 'text'
    | 'empty_value'
    | 'field_key'
    | 'field_hint'
    | 'marker'
    | 'handwritten_text'
    | 'grading_scale'
    // subtype labels (narrowed in subtype interfaces):
    | 'title'
    | 'section_header'
    | 'list_item'
    | 'formula'
    | 'field_heading'
    | 'field_value';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}
export interface TitleItem extends TextItem {
  label?: 'title';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}
export interface SectionHeaderItem extends TextItem {
  label?: 'section_header';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  level?: number;
}
export interface ListItem extends TextItem {
  label?: 'list_item';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  enumerated?: boolean;
  marker?: string;
}
export interface FormulaItem extends TextItem {
  label?: 'formula';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}

// ---------------------------------------------------------------------------
// Code item
// ---------------------------------------------------------------------------

export interface CodeItem extends FloatingItem {
  label?: 'code';
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  code_language?: CodeLanguageLabel;
}

// ---------------------------------------------------------------------------
// Table items
// ---------------------------------------------------------------------------

export interface TableCell {
  bbox?: BoundingBox | null;
  row_span?: number;
  col_span?: number;
  start_row_offset_idx: number;
  end_row_offset_idx: number;
  start_col_offset_idx: number;
  end_col_offset_idx: number;
  text: string;
  column_header?: boolean;
  row_header?: boolean;
  row_section?: boolean;
  fillable?: boolean;
}
export interface RichTableCell extends TableCell {
  ref: RefItem;
  $ref?: string;
}
export type AnyTableCell = TableCell | RichTableCell;
export interface TableData {
  table_cells?: AnyTableCell[];
  num_rows?: number;
  num_cols?: number;
  orientation?: Orientation;
  grid: AnyTableCell[][];
}
export type TableAnnotationType = PictureDescriptionData | PictureMiscData;

export interface TableItem extends FloatingItem {
  label?: 'document_index' | 'table';
  data: TableData;
  /** @deprecated Use meta instead. */
  annotations?: TableAnnotationType[];
}

// ---------------------------------------------------------------------------
// Picture items
// ---------------------------------------------------------------------------

export interface BasePictureData {
  kind?: string;
}
export interface PictureClassificationClass {
  class_name: string;
  confidence: number;
}
export type DescriptionAnnotation = PictureDescriptionData;
export type MiscAnnotation = PictureMiscData;
export type BaseAnnotation = BasePictureData;

export interface PictureClassificationData extends BasePictureData {
  kind?: 'classification';
  provenance: string;
  predicted_classes: PictureClassificationClass[];
}

export interface PictureDescriptionData extends BasePictureData {
  kind?: 'description';
  text: string;
  provenance: string;
}
export interface PictureMoleculeData extends BasePictureData {
  kind?: 'molecule_data';
  smi: string;
  confidence: number;
  class_name: string;
  segmentation: [number, number][];
  provenance: string;
}

export interface PictureMiscData extends BasePictureData {
  kind?: 'misc';
  content: Record<string, unknown>;
}

export interface PictureChartData extends BasePictureData {
  title: string;
}
export interface PictureTabularChartData extends PictureChartData {
  kind?: 'tabular_chart_data';
  chart_data: TableData;
}
export interface ChartLine {
  label: string;
  values: [number, number][];
}
export interface PictureLineChartData extends PictureChartData {
  kind?: 'line_chart_data';
  x_axis_label: string;
  y_axis_label: string;
  lines: ChartLine[];
}
export interface ChartBar {
  label: string;
  values: number;
}
export interface PictureBarChartData extends PictureChartData {
  kind?: 'bar_chart_data';
  x_axis_label: string;
  y_axis_label: string;
  bars: ChartBar[];
}
export interface ChartStackedBar {
  label: string[];
  values: [string, number][];
}
export interface PictureStackedBarChartData extends PictureChartData {
  kind?: 'stacked_bar_chart_data';
  x_axis_label: string;
  y_axis_label: string;
  stacked_bars: ChartStackedBar[];
}
export interface ChartSlice {
  label: string;
  value: number;
}
export interface PicturePieChartData extends PictureChartData {
  kind?: 'pie_chart_data';
  slices: ChartSlice[];
}
export interface ChartPoint {
  value: [number, number];
}
export interface PictureScatterChartData extends PictureChartData {
  kind?: 'scatter_chart_data';
  x_axis_label: string;
  y_axis_label: string;
  points: ChartPoint[];
}

export interface PictureClassificationPrediction extends BasePrediction {
  class_name: string;
}
export interface PictureClassificationMetaField {
  predictions: PictureClassificationPrediction[];
  [key: string]: unknown;
}
export interface MoleculeMetaField extends BasePrediction {
  smi: string;
}
export interface TabularChartMetaField extends BasePrediction {
  title?: string | null;
  chart_data: TableData;
}
export interface PictureMeta extends FloatingMeta {
  classification?: PictureClassificationMetaField | null;
  molecule?: MoleculeMetaField | null;
  tabular_chart?: TabularChartMetaField | null;
  code?: CodeMetaField | null;
}

export type PictureDataType =
  | PictureDescriptionData
  | PictureMiscData
  | PictureClassificationData
  | PictureMoleculeData
  | PictureTabularChartData
  | PictureLineChartData
  | PictureBarChartData
  | PictureStackedBarChartData
  | PicturePieChartData
  | PictureScatterChartData;

export interface PictureItem extends FloatingItem {
  label?: 'picture' | 'chart';
  meta?: PictureMeta | null;
  /** @deprecated Use meta instead. */
  annotations?: PictureDataType[];
}

// ---------------------------------------------------------------------------
// Key-value / form items
// ---------------------------------------------------------------------------

export interface GraphCell {
  label: GraphCellLabel;
  cell_id: number;
  text: string;
  orig: string;
  prov?: ProvenanceItem | null;
  item_ref?: RefItem | null;
}
export interface GraphLink {
  label: GraphLinkLabel;
  source_cell_id: number;
  target_cell_id: number;
}
export interface GraphData {
  cells?: GraphCell[];
  links?: GraphLink[];
}
export interface KeyValueItem extends FloatingItem {
  label?: 'key_value_region';
  graph: GraphData;
}
export interface FormItem extends FloatingItem {
  label?: 'form';
  graph: GraphData;
}

// ---------------------------------------------------------------------------
// Field-region items
// ---------------------------------------------------------------------------

export interface FieldRegionItem extends DocItem {
  label?: 'field_region';
}
export interface FieldHeadingItem extends TextItem {
  label?: 'field_heading';
  level?: number;
}
export interface FieldItem extends DocItem {
  label?: 'field_item';
}
export interface FieldValueItem extends TextItem {
  label?: 'field_value';
  kind?: 'read_only' | 'fillable';
}

export type ContentItem =
  | TextItem
  | TitleItem
  | SectionHeaderItem
  | ListItem
  | CodeItem
  | FormulaItem
  | PictureItem
  | TableItem
  | KeyValueItem
  | FieldRegionItem
  | FieldItem;

// ---------------------------------------------------------------------------
// Page item
// ---------------------------------------------------------------------------

export interface PageItem {
  size: Size;
  image?: ImageRef | null;
  page_no: number;
}

export const CURRENT_VERSION = '1.10.0';
export const DEFAULT_CONTENT_LAYERS: ContentLayer[] = ['body'];
export const DEFAULT_EXPORT_LABELS: DocItemLabel[] = [
  'title',
  'document_index',
  'section_header',
  'paragraph',
  'table',
  'picture',
  'formula',
  'checkbox_unselected',
  'checkbox_selected',
  'text',
  'list_item',
  'code',
  'reference',
  'page_header',
  'page_footer',
  'key_value_region',
  'empty_value',
  'field_key',
  'field_value',
  'field_heading',
  'field_hint',
  'marker',
  'handwritten_text',
];
export const DOCUMENT_TOKENS_EXPORT_LABELS: DocItemLabel[] = [
  ...DEFAULT_EXPORT_LABELS,
  'footnote',
  'caption',
  'form',
];

// ---------------------------------------------------------------------------
// DoclingDocument
// ---------------------------------------------------------------------------

export interface DoclingDocument {
  schema_name?: 'DoclingDocument';
  version?: string;
  name: string;
  origin?: DocumentOrigin | null;
  furniture?: GroupItem;
  body?: GroupItem;
  groups?: (ListGroup | InlineGroup | GroupItem)[];
  texts?: (
    | TitleItem
    | SectionHeaderItem
    | ListItem
    | CodeItem
    | FormulaItem
    | FieldHeadingItem
    | FieldValueItem
    | TextItem
  )[];
  pictures?: PictureItem[];
  tables?: TableItem[];
  key_value_items?: KeyValueItem[];
  form_items?: FormItem[];
  field_regions?: FieldRegionItem[];
  field_items?: FieldItem[];
  pages?: Record<string, PageItem>;
}
