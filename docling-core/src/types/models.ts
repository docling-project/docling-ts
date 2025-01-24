/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

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
  | "comment_section";
/**
 * CoordOrigin.
 */
export type CoordOrigin = "TOPLEFT" | "BOTTOMLEFT";
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
 * DoclingDocument.
 */
export interface DoclingDocument {
  schema_name?: "DoclingDocument";
  version?: string;
  name: string;
  origin?: DocumentOrigin | null;
  furniture?: GroupItem;
  body?: GroupItem1;
  groups?: GroupItem2[];
  texts?: (SectionHeaderItem | ListItem | TextItem)[];
  pictures?: PictureItem[];
  tables?: TableItem[];
  key_value_items?: KeyValueItem[];
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
 * GroupItem.
 */
export interface GroupItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  name?: string;
  label?: GroupLabel;
}
/**
 * RefItem.
 */
export interface RefItem {
  $ref: string;
}
/**
 * GroupItem.
 */
export interface GroupItem1 {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  name?: string;
  label?: GroupLabel;
}
/**
 * GroupItem.
 */
export interface GroupItem2 {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  name?: string;
  label?: GroupLabel;
}
/**
 * SectionItem.
 */
export interface SectionHeaderItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  label?: "section_header";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  level?: number;
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
 * SectionItem.
 */
export interface ListItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  label?: "list_item";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
  enumerated?: boolean;
  marker?: string;
}
/**
 * TextItem.
 */
export interface TextItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  label:
    | "caption"
    | "checkbox_selected"
    | "checkbox_unselected"
    | "code"
    | "footnote"
    | "formula"
    | "page_footer"
    | "page_header"
    | "paragraph"
    | "reference"
    | "text"
    | "title";
  prov?: ProvenanceItem[];
  orig: string;
  text: string;
}
/**
 * PictureItem.
 */
export interface PictureItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
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
  label?: "key_value_region";
  prov?: ProvenanceItem[];
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
 * A representation of a generic document.
 */
export interface Generic {
  /**
   * A short description or summary of the document.
   */
  _name?: string | null;
  "file-info": FileInfoObject;
}
/**
 * Minimal identification information of the document within a collection.
 */
export interface FileInfoObject {
  /**
   * The name of a persistent object that created this data object
   */
  filename: string;
  /**
   * The provenance of this data object, e.g. an archive file, a URL, or any other repository.
   */
  "filename-prov"?: string | null;
  /**
   * A unique identifier of this data object within a collection of a Docling database
   */
  "document-hash": string;
}
/**
 * Information on how the data was obtained.
 */
export interface Acquisition {
  /**
   * The method to obtain the data.
   */
  type: "API" | "FTP" | "Download" | "Link" | "Web scraping/Crawling" | "Other";
  /**
   * A string representation of the acquisition datetime in ISO 8601 format.
   */
  date?: string | null;
  /**
   * Link to the data source of this document.
   */
  link?: string | null;
  /**
   * Size in bytes of the raw document from the data source.
   */
  size?: number | null;
}
/**
 * Model for alias fields to ensure instantiation and serialization by alias.
 */
export interface AliasModel {}
/**
 * Filing information for any data object to be stored in a Docling database.
 */
export interface FileInfoObject1 {
  /**
   * The name of a persistent object that created this data object
   */
  filename: string;
  /**
   * The provenance of this data object, e.g. an archive file, a URL, or any other repository.
   */
  "filename-prov"?: string | null;
  /**
   * A unique identifier of this data object within a collection of a Docling database
   */
  "document-hash": string;
}
/**
 * Log entry to describe an ETL task on a document.
 */
export interface Log {
  /**
   * An identifier of this task. It may be used to identify this task from other tasks of the same agent and type.
   */
  task?: string | null;
  /**
   * The Docling agent that performed the task, e.g., CCS or CXS.
   */
  agent: string;
  /**
   * A task category.
   */
  type: string;
  /**
   * A description of the task or any comments in natural language.
   */
  comment?: string | null;
  /**
   * A string representation of the task execution datetime in ISO 8601 format.
   */
  date: string;
}
/**
 * DocItem.
 */
export interface DocItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
  label: DocItemLabel;
  prov?: ProvenanceItem[];
}
/**
 * FloatingItem.
 */
export interface FloatingItem {
  self_ref: string;
  parent?: RefItem | null;
  children?: RefItem[];
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
}
/**
 * Table cell.
 */
export interface TableCell1 {
  bbox?: [number, number, number, number] | null;
  spans?: [number, number][] | null;
  text: string;
  type: string;
}
/**
 * BasePictureData.
 */
export interface BasePictureData {
  kind: string;
}
/**
 * List item.
 */
export interface ListItem1 {
  prov?: Prov[] | null;
  text?: string | null;
  type: string;
  payload?: {
    [k: string]: unknown;
  } | null;
  name?: string | null;
  font?: string | null;
  identifier: string;
}
/**
 * Provenance.
 */
export interface Prov {
  /**
   * @minItems 4
   * @maxItems 4
   */
  bbox: [number, number, number, number];
  page: number;
  /**
   * @minItems 2
   * @maxItems 2
   */
  span: [number, number];
  __ref_s3_data?: string | null;
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
/**
 * Base cell.
 */
export interface BaseCell {
  prov?: Prov[] | null;
  text?: string | null;
  type: string;
  payload?: {
    [k: string]: unknown;
  } | null;
}
/**
 * Base model for text objects.
 */
export interface BaseText {
  prov?: Prov[] | null;
  text?: string | null;
  type: string;
  payload?: {
    [k: string]: unknown;
  } | null;
  name?: string | null;
  font?: string | null;
}
/**
 * Bitmap object.
 */
export interface BitmapObject {
  type: string;
  bounding_box: BoundingBoxContainer;
  prov: Prov;
}
/**
 * Bounding box container.
 */
export interface BoundingBoxContainer {
  /**
   * @minItems 4
   * @maxItems 4
   */
  min: [number, number, number, number];
  /**
   * @minItems 4
   * @maxItems 4
   */
  max: [number, number, number, number];
}
/**
 * Bounding box container.
 */
export interface BoundingBoxContainer1 {
  /**
   * @minItems 4
   * @maxItems 4
   */
  min: [number, number, number, number];
  /**
   * @minItems 4
   * @maxItems 4
   */
  max: [number, number, number, number];
}
/**
 * Cell container.
 */
export interface CellsContainer {
  data?: [unknown, unknown, unknown, unknown, unknown, unknown][] | null;
  /**
   * @minItems 6
   * @maxItems 6
   */
  header?: [unknown, unknown, unknown, unknown, unknown, unknown];
}
/**
 * Figure.
 */
export interface Figure {
  prov?: Prov[] | null;
  text?: string | null;
  type: string;
  payload?: {
    [k: string]: unknown;
  } | null;
  "bounding-box"?: BoundingBoxContainer1 | null;
}
/**
 * Glm Table cell.
 */
export interface GlmTableCell {
  bbox?: [number, number, number, number] | null;
  spans?: [number, number][] | null;
  text: string;
  type: string;
  col?: number | null;
  "col-header"?: boolean;
  "col-span"?: [number, number] | null;
  row?: number | null;
  "row-header"?: boolean;
  "row-span"?: [number, number] | null;
}
/**
 * Page dimensions.
 */
export interface PageDimensions {
  height: number;
  page: number;
  width: number;
}
/**
 * Page reference.
 */
export interface PageReference {
  hash: string;
  model: string;
  page: number;
}
/**
 * Reference.
 */
export interface Ref {
  name: string;
  type: string;
  $ref: string;
}
/**
 * Data object in a cloud object storage.
 */
export interface S3Data {
  "pdf-document"?: S3Resource[] | null;
  "pdf-pages"?: S3Resource[] | null;
  "pdf-images"?: S3Resource[] | null;
  "json-document"?: S3Resource | null;
  "json-meta"?: S3Resource | null;
  "glm-json-document"?: S3Resource | null;
  figures?: S3Resource[] | null;
}
/**
 * Resource in a cloud object storage.
 */
export interface S3Resource {
  mime: string;
  path: string;
  page?: number | null;
}
/**
 * References an s3 resource.
 */
export interface S3Reference {
  __ref_s3_data: string;
}
/**
 * Table.
 */
export interface Table {
  prov?: Prov[] | null;
  text?: string | null;
  type: string;
  payload?: {
    [k: string]: unknown;
  } | null;
  "#-cols": number;
  "#-rows": number;
  data?: (GlmTableCell | TableCell1)[][] | null;
  model?: string | null;
  "bounding-box"?: BoundingBoxContainer1 | null;
}
/**
 * Model for boolean values.
 */
export interface BooleanValue {
  value: boolean;
}
/**
 * Model for datetime values.
 */
export interface DatetimeValue {
  value: string;
}
/**
 * A representation of a geopoint (longitude and latitude coordinates).
 */
export interface GeopointValue {
  /**
   * @minItems 2
   * @maxItems 2
   */
  value: [number, number];
  conf?: number | null;
}
/**
 * Model for nominal (categorical) values.
 */
export interface NominalValue {
  value: string;
}
/**
 * Model for numerical values.
 */
export interface NumericalValue {
  min: number;
  max: number;
  val: number;
  err: number;
  unit: string;
}
/**
 * Model for textual values.
 */
export interface TextValue {
  value: string;
}
