/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * CoordOrigin.
 */
export type CoordOrigin = "TOPLEFT" | "BOTTOMLEFT";
/**
 * ContentLayer.
 */
export type ContentLayer = "body" | "furniture";
/**
 * CodeLanguageLabel.
 */
export type CodeLanguageLabel =
  | "Ada"
  | "Awk"
  | "Bash"
  | "bc"
  | "C"
  | "C#"
  | "C++"
  | "CMake"
  | "COBOL"
  | "CSS"
  | "Ceylon"
  | "Clojure"
  | "Crystal"
  | "Cuda"
  | "Cython"
  | "D"
  | "Dart"
  | "dc"
  | "Dockerfile"
  | "Elixir"
  | "Erlang"
  | "FORTRAN"
  | "Forth"
  | "Go"
  | "HTML"
  | "Haskell"
  | "Haxe"
  | "Java"
  | "JavaScript"
  | "Julia"
  | "Kotlin"
  | "Lisp"
  | "Lua"
  | "Matlab"
  | "MoonScript"
  | "Nim"
  | "OCaml"
  | "ObjectiveC"
  | "Octave"
  | "PHP"
  | "Pascal"
  | "Perl"
  | "Prolog"
  | "Python"
  | "Racket"
  | "Ruby"
  | "Rust"
  | "SML"
  | "SQL"
  | "Scala"
  | "Scheme"
  | "Swift"
  | "TypeScript"
  | "unknown"
  | "VisualBasic"
  | "XML"
  | "YAML";
/**
 * ContentLayer.
 */
export type ContentLayer1 = "body" | "furniture";
/**
 * DocItemLabel.
 */
export type DocItemLabel =
  | "caption"
  | "footnote"
  | "formula"
  | "list_item"
  | "page_footer"
  | "page_header"
  | "picture"
  | "section_header"
  | "table"
  | "text"
  | "title"
  | "document_index"
  | "code"
  | "checkbox_selected"
  | "checkbox_unselected"
  | "form"
  | "key_value_region"
  | "paragraph"
  | "reference";
/**
 * ContentLayer.
 */
export type ContentLayer2 = "body" | "furniture";
/**
 * GroupLabel.
 */
export type GroupLabel =
  | "unspecified"
  | "list"
  | "ordered_list"
  | "chapter"
  | "section"
  | "sheet"
  | "slide"
  | "form_area"
  | "key_value_area"
  | "comment_section"
  | "inline";
/**
 * ContentLayer.
 */
export type ContentLayer3 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer4 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer5 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer6 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer7 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer8 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer9 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer10 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer11 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer12 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer13 = "body" | "furniture";
/**
 * GraphCellLabel.
 */
export type GraphCellLabel = "unspecified" | "key" | "value" | "checkbox";
/**
 * GraphLinkLabel.
 */
export type GraphLinkLabel = "unspecified" | "to_value" | "to_key" | "to_parent" | "to_child";
/**
 * ContentLayer.
 */
export type ContentLayer14 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer15 = "body" | "furniture";
/**
 * ContentLayer.
 */
export type ContentLayer16 = "body" | "furniture";

/**
 * BoundingBox.
 */
export interface BoundingBox {
  l: number;
  t: number;
  r: number;
  b: number;
  coord_origin?: CoordOrigin;
}
/**
 * CodeItem.
 */
export interface CodeItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer;
  label?: "code";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
  code_language?: CodeLanguageLabel;
}
/**
 * RefItem.
 */
export interface RefItem {
  $ref: string;
}
/**
 * ProvenanceItem.
 */
export interface ProvenanceItem {
  page_no: number;
  bbox: BoundingBox;
  /**
   * @minItems 2
   * @maxItems 2
   */
  charspan: [unknown, unknown];
}
/**
 * Formatting.
 */
export interface Formatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}
/**
 * ImageRef.
 */
export interface ImageRef {
  mimetype: string;
  dpi: number;
  size: Size;
  uri: string;
}
/**
 * Size.
 */
export interface Size {
  width?: number;
  height?: number;
}
/**
 * DocItem.
 */
export interface DocItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer1;
  label: DocItemLabel;
  prov?: ProvenanceItem[];
}
/**
 * DoclingDocument.
 */
export interface DoclingDocument {
  schema_name?: "DoclingDocument";
  version?: string;
  name: string;
  origin?: DocumentOrigin | null;
  furniture?: GroupItem;
  body?: GroupItem1;
  groups?: (OrderedList | UnorderedList | InlineGroup | GroupItem2)[];
  texts?: (TitleItem | SectionHeaderItem | ListItem | CodeItem | FormulaItem | TextItem)[];
  pictures?: PictureItem[];
  tables?: TableItem[];
  key_value_items?: KeyValueItem[];
  form_items?: FormItem[];
  pages?: {
    [k: string]: PageItem;
  };
}
/**
 * FileSource.
 */
export interface DocumentOrigin {
  mimetype: string;
  binary_hash: number;
  filename: string;
  uri?: string | null;
}
/**
 * @deprecated
 * GroupItem.
 */
export interface GroupItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer2;
  name?: string;
  label?: GroupLabel;
}
/**
 * GroupItem.
 */
export interface GroupItem1 {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer2;
  name?: string;
  label?: GroupLabel;
}
/**
 * OrderedList.
 */
export interface OrderedList {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer3;
  name?: string;
  label?: "ordered_list";
}
/**
 * UnorderedList.
 */
export interface UnorderedList {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer4;
  name?: string;
  label?: "list";
}
/**
 * InlineGroup.
 */
export interface InlineGroup {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer5;
  name?: string;
  label?: "inline";
}
/**
 * GroupItem.
 */
export interface GroupItem2 {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer2;
  name?: string;
  label?: GroupLabel;
}
/**
 * TitleItem.
 */
export interface TitleItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer6;
  label?: "title";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}
/**
 * SectionItem.
 */
export interface SectionHeaderItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer7;
  label?: "section_header";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  level?: number;
}
/**
 * SectionItem.
 */
export interface ListItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer8;
  label?: "list_item";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
  enumerated?: boolean;
  marker?: string;
}
/**
 * FormulaItem.
 */
export interface FormulaItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer9;
  label?: "formula";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}
/**
 * TextItem.
 */
export interface TextItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer10;
  label:
    | "caption"
    | "checkbox_selected"
    | "checkbox_unselected"
    | "footnote"
    | "page_footer"
    | "page_header"
    | "paragraph"
    | "reference"
    | "text";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  formatting?: Formatting | null;
  hyperlink?: string | null;
}
/**
 * PictureItem.
 */
export interface PictureItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer11;
  label?: "picture";
  prov?: ProvenanceItem[];
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
  annotations?: (
    | PictureClassificationData
    | PictureDescriptionData
    | PictureMoleculeData
    | PictureMiscData
    | PictureLineChartData
    | PictureBarChartData
    | PictureStackedBarChartData
    | PicturePieChartData
    | PictureScatterChartData
  )[];
}
/**
 * PictureClassificationData.
 */
export interface PictureClassificationData {
  kind?: "classification";
  provenance: string;
  predicted_classes: PictureClassificationClass[];
}
/**
 * PictureClassificationData.
 */
export interface PictureClassificationClass {
  class_name: string;
  confidence: number;
}
/**
 * PictureDescriptionData.
 */
export interface PictureDescriptionData {
  kind?: "description";
  text: string;
  provenance: string;
}
/**
 * PictureMoleculeData.
 */
export interface PictureMoleculeData {
  kind?: "molecule_data";
  smi: string;
  confidence: number;
  class_name: string;
  segmentation: [unknown, unknown][];
  provenance: string;
}
/**
 * PictureMiscData.
 */
export interface PictureMiscData {
  kind?: "misc";
  content: {
    [k: string]: unknown;
  };
}
/**
 * Represents data of a line chart.
 *
 * Attributes:
 *     kind (Literal["line_chart_data"]): The type of the chart.
 *     x_axis_label (str): The label for the x-axis.
 *     y_axis_label (str): The label for the y-axis.
 *     lines (List[ChartLine]): A list of lines in the chart.
 */
export interface PictureLineChartData {
  title: string;
  kind?: "line_chart_data";
  x_axis_label: string;
  y_axis_label: string;
  lines: ChartLine[];
}
/**
 * Represents a line in a line chart.
 *
 * Attributes:
 *     label (str): The label for the line.
 *     values (List[Tuple[float, float]]): A list of (x, y) coordinate pairs
 *         representing the line's data points.
 */
export interface ChartLine {
  label: string;
  values: [unknown, unknown][];
}
/**
 * Represents data of a bar chart.
 *
 * Attributes:
 *     kind (Literal["bar_chart_data"]): The type of the chart.
 *     x_axis_label (str): The label for the x-axis.
 *     y_axis_label (str): The label for the y-axis.
 *     bars (List[ChartBar]): A list of bars in the chart.
 */
export interface PictureBarChartData {
  title: string;
  kind?: "bar_chart_data";
  x_axis_label: string;
  y_axis_label: string;
  bars: ChartBar[];
}
/**
 * Represents a bar in a bar chart.
 *
 * Attributes:
 *     label (str): The label for the bar.
 *     values (float): The value associated with the bar.
 */
export interface ChartBar {
  label: string;
  values: number;
}
/**
 * Represents data of a stacked bar chart.
 *
 * Attributes:
 *     kind (Literal["stacked_bar_chart_data"]): The type of the chart.
 *     x_axis_label (str): The label for the x-axis.
 *     y_axis_label (str): The label for the y-axis.
 *     stacked_bars (List[ChartStackedBar]): A list of stacked bars in the chart.
 */
export interface PictureStackedBarChartData {
  title: string;
  kind?: "stacked_bar_chart_data";
  x_axis_label: string;
  y_axis_label: string;
  stacked_bars: ChartStackedBar[];
}
/**
 * Represents a stacked bar in a stacked bar chart.
 *
 * Attributes:
 *     label (List[str]): The labels for the stacked bars. Multiple values are stored
 *         in cases where the chart is "double stacked," meaning bars are stacked both
 *         horizontally and vertically.
 *     values (List[Tuple[str, int]]): A list of values representing different segments
 *         of the stacked bar along with their label.
 */
export interface ChartStackedBar {
  label: string[];
  values: [unknown, unknown][];
}
/**
 * Represents data of a pie chart.
 *
 * Attributes:
 *     kind (Literal["pie_chart_data"]): The type of the chart.
 *     slices (List[ChartSlice]): A list of slices in the pie chart.
 */
export interface PicturePieChartData {
  title: string;
  kind?: "pie_chart_data";
  slices: ChartSlice[];
}
/**
 * Represents a slice in a pie chart.
 *
 * Attributes:
 *     label (str): The label for the slice.
 *     value (float): The value represented by the slice.
 */
export interface ChartSlice {
  label: string;
  value: number;
}
/**
 * Represents data of a scatter chart.
 *
 * Attributes:
 *     kind (Literal["scatter_chart_data"]): The type of the chart.
 *     x_axis_label (str): The label for the x-axis.
 *     y_axis_label (str): The label for the y-axis.
 *     points (List[ChartPoint]): A list of points in the scatter chart.
 */
export interface PictureScatterChartData {
  title: string;
  kind?: "scatter_chart_data";
  x_axis_label: string;
  y_axis_label: string;
  points: ChartPoint[];
}
/**
 * Represents a point in a scatter chart.
 *
 * Attributes:
 *     value (Tuple[float, float]): A (x, y) coordinate pair representing a point in a
 *         chart.
 */
export interface ChartPoint {
  /**
   * @minItems 2
   * @maxItems 2
   */
  value: [unknown, unknown];
}
/**
 * TableItem.
 */
export interface TableItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer12;
  label?: "document_index" | "table";
  prov?: ProvenanceItem[];
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
  data: TableData;
}
/**
 * BaseTableData.
 */
export interface TableData {
  table_cells?: TableCell[];
  num_rows?: number;
  num_cols?: number;
  /**
   * grid.
   */
  grid: TableCell[][];
}
/**
 * TableCell.
 */
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
}
/**
 * KeyValueItem.
 */
export interface KeyValueItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer13;
  label?: "key_value_region";
  prov?: ProvenanceItem[];
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
  graph: GraphData;
}
/**
 * GraphData.
 */
export interface GraphData {
  cells?: GraphCell[];
  links?: GraphLink[];
}
/**
 * GraphCell.
 */
export interface GraphCell {
  label: GraphCellLabel;
  cell_id: number;
  text: string;
  orig: string;
  prov?: ProvenanceItem | null;
  item_ref?: RefItem | null;
}
/**
 * GraphLink.
 */
export interface GraphLink {
  label: GraphLinkLabel;
  source_cell_id: number;
  target_cell_id: number;
}
/**
 * FormItem.
 */
export interface FormItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer14;
  label?: "form";
  prov?: ProvenanceItem[];
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
  graph: GraphData;
}
/**
 * PageItem.
 */
export interface PageItem {
  size: Size;
  image?: ImageRef | null;
  page_no: number;
}
/**
 * FloatingItem.
 */
export interface FloatingItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer15;
  label: DocItemLabel;
  prov?: ProvenanceItem[];
  captions?: RefItem[];
  references?: RefItem[];
  footnotes?: RefItem[];
  image?: ImageRef | null;
}
/**
 * NodeItem.
 */
export interface NodeItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  content_layer?: ContentLayer16;
}
/**
 * BasePictureData.
 */
export interface BasePictureData {
  kind: string;
}
/**
 * Base class for picture chart data.
 *
 * Attributes:
 *     title (str): The title of the chart.
 */
export interface PictureChartData {
  title: string;
}
