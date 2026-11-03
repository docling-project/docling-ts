import type {
  AnyTableCell,
  BaseMeta,
  CodeItem,
  CodeLanguageLabel,
  ContentLayer,
  DoclingDocument,
  FloatingItem,
  FieldItem,
  FieldRegionItem,
  FieldValueItem,
  FloatingMeta,
  Formatting,
  GroupItem,
  GroupLabel,
  NodeItem,
  PageItem,
  PictureItem,
  PictureMeta,
  ProvenanceItem,
  RefItem,
  RichTableCell,
  TableData,
  TableItem,
  TextItem,
} from '../types';
import { CURRENT_VERSION } from '../types';

export type Kind =
  'groups' | 'texts' | 'pictures' | 'tables' | 'field_regions' | 'field_items';

/** The item type stored in one of the document's collections. */
type ItemOf<K extends Kind> = NonNullable<DoclingDocument[K]>[number];

/** Any item of `DoclingDocument.texts`. */
export type TextItemLike = ItemOf<'texts'>;
export type TextLabel = NonNullable<TextItemLike['label']>;

/** An item's own fields, i.e. everything `add` doesn't allocate itself. */
type Fields<T extends NodeItem> = Omit<
  T,
  'self_ref' | 'parent' | 'children' | 'content_layer'
>;

/** A text item of any label, with the label-specific trailing fields. */
type TextFields = Omit<TextItem, 'label'> & { label: TextLabel } & TextExtra;

/** `TableData` whose cell list and dimensions are known to be present. */
export type FullTableData = TableData &
  Required<Pick<TableData, 'table_cells' | 'num_rows' | 'num_cols'>>;

/** Label-specific fields that follow the common ones on a text item. */
export type TextExtra = {
  level?: number;
  enumerated?: boolean;
  marker?: string;
  kind?: FieldValueItem['kind'];
  code_language?: CodeLanguageLabel;
} & Partial<Pick<CodeItem, 'captions' | 'references' | 'footnotes' | 'image'>>;

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** An object whose keys are the given words, all unset. */
const unset = (s: string): BaseMeta =>
  Object.fromEntries(s.split(' ').map(k => [k, undefined]));

export const fmt = (f: Partial<Formatting> = {}): Formatting => ({
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  script: 'baseline',
  ...f,
});

const BASE = 'summary language entities keywords topics';
const META = {
  base: BASE,
  floating: `${BASE} description`,
  picture: `${BASE} description classification molecule tabular_chart code`,
};

/** The item's meta, created on first use with fields in declaration order. */
export function metaOf(item: PictureItem): PictureMeta;
export function metaOf(item: FloatingItem): FloatingMeta;
export function metaOf(item: NodeItem): BaseMeta;
export function metaOf(item: NodeItem): BaseMeta {
  return (item.meta ??= unset(
    META[
      item.self_ref.startsWith('#/pictures/')
        ? 'picture'
        : 'captions' in item
          ? 'floating'
          : 'base'
    ]
  ));
}

export const cell = (c: Partial<RichTableCell>): AnyTableCell => ({
  bbox: undefined,
  row_span: 1,
  col_span: 1,
  start_row_offset_idx: 0,
  end_row_offset_idx: 1,
  start_col_offset_idx: 0,
  end_col_offset_idx: 1,
  text: '',
  column_header: false,
  row_header: false,
  row_section: false,
  fillable: false,
  ...c,
});

/** TableData whose computed `grid` follows `table_cells` / `num_*` live. */
export const tableData = (
  cells: AnyTableCell[] = [],
  rows = 0,
  cols = 0
): FullTableData => ({
  table_cells: cells,
  num_rows: rows,
  num_cols: cols,
  orientation: 'rot_0',
  get grid() {
    const g = range(this.num_rows).map(i =>
      range(this.num_cols).map(j =>
        cell({
          start_row_offset_idx: i,
          end_row_offset_idx: i + 1,
          start_col_offset_idx: j,
          end_col_offset_idx: j + 1,
        })
      )
    );
    for (const c of this.table_cells)
      for (
        let i = c.start_row_offset_idx;
        i < Math.min(c.end_row_offset_idx, this.num_rows);
        i++
      )
        for (
          let j = c.start_col_offset_idx;
          j < Math.min(c.end_col_offset_idx, this.num_cols);
          j++
        )
          g[i][j] = { ...c, ref: undefined }; // grid is typed `TableCell`
    return g;
  },
});

/** Floating-item trailing fields (captions, references, footnotes, image). */
export const floating = (caption?: NodeItem) => ({
  captions: caption ? [{ $ref: caption.self_ref }] : [],
  references: [] as RefItem[],
  footnotes: [] as RefItem[],
  image: undefined,
});

const root = (name: string, layer: ContentLayer): GroupItem => ({
  self_ref: `#/${name}`,
  children: [],
  content_layer: layer,
  name: '_root_',
  label: 'unspecified',
});

export class Doc {
  furniture = root('furniture', 'furniture');
  body = root('body', 'body');
  groups: ItemOf<'groups'>[] = [];
  texts: TextItemLike[] = [];
  pictures: PictureItem[] = [];
  tables: TableItem[] = [];
  field_regions: ItemOf<'field_regions'>[] = [];
  field_items: ItemOf<'field_items'>[] = [];
  pages: Record<string, PageItem> = {};

  /** Allocate `#/<kind>/<n>`, link it under `parent` (default: body). */
  add<T extends NodeItem>(
    kind: Kind,
    fields: Fields<T>,
    parent: NodeItem = this.body,
    layer?: ContentLayer
  ): T {
    const list: NodeItem[] = this[kind];
    const self_ref = `#/${kind}/${list.length}`;
    const item = {
      self_ref,
      parent: { $ref: parent.self_ref },
      children: [],
      content_layer: layer ?? 'body',
      ...fields,
    } as unknown as T;
    list.push(item);
    (parent.children ??= []).push({ $ref: self_ref });
    return item;
  }

  /** Any text-like item; `extra` carries the label-specific trailing fields. */
  text(
    label: TextLabel,
    text: string,
    {
      parent,
      prov = [],
      layer,
      formatting,
      ...extra
    }: {
      parent?: NodeItem;
      prov?: ProvenanceItem[];
      layer?: ContentLayer;
      formatting?: Formatting;
    } & TextExtra = {}
  ): TextItemLike {
    return this.add<TextFields>(
      'texts',
      {
        meta: undefined,
        label,
        prov,
        orig: text,
        text,
        formatting,
        hyperlink: undefined,
        ...extra,
      },
      parent,
      layer
    ) as TextItemLike;
  }

  group(
    label: GroupLabel = 'unspecified',
    name = 'group',
    parent?: NodeItem,
    layer?: ContentLayer
  ) {
    const fields = {
      meta: undefined,
      name,
      label: label === 'ordered_list' ? ('list' as const) : label,
    };
    return this.add<GroupItem>('groups', fields, parent, layer);
  }

  table(
    label: TableItem['label'],
    {
      caption,
      parent,
      layer,
      prov = [],
      data,
    }: {
      caption?: NodeItem;
      parent?: NodeItem;
      layer?: ContentLayer;
      prov?: ProvenanceItem[];
      data: TableData;
    }
  ) {
    const fields = {
      meta: undefined,
      label,
      prov,
      ...floating(caption),
      data,
      annotations: [],
    };
    return this.add<TableItem>('tables', fields, parent, layer);
  }

  fieldRegion(prov: ProvenanceItem[], parent?: NodeItem) {
    const fields = { meta: undefined, label: 'field_region' as const, prov };
    return this.add<FieldRegionItem>('field_regions', fields, parent);
  }

  fieldItem(prov: ProvenanceItem[], parent?: NodeItem, layer?: ContentLayer) {
    const fields = { meta: undefined, label: 'field_item' as const, prov };
    return this.add<FieldItem>('field_items', fields, parent, layer);
  }

  picture({
    caption,
    parent,
    layer,
    prov = [],
  }: {
    caption?: NodeItem;
    parent?: NodeItem;
    layer?: ContentLayer;
    prov?: ProvenanceItem[];
  }) {
    const fields = {
      meta: undefined,
      label: 'picture' as const,
      prov,
      ...floating(caption),
      annotations: [],
    };
    return this.add<PictureItem>('pictures', fields, parent, layer);
  }

  toJSON(): DoclingDocument {
    return {
      schema_name: 'DoclingDocument',
      version: CURRENT_VERSION,
      name: 'Document',
      furniture: this.furniture,
      body: this.body,
      groups: this.groups,
      texts: this.texts,
      pictures: this.pictures,
      tables: this.tables,
      key_value_items: [],
      form_items: [],
      ...(this.field_regions.length
        ? { field_regions: this.field_regions }
        : {}),
      ...(this.field_items.length ? { field_items: this.field_items } : {}),
      pages: this.pages,
    };
  }
}
