import {
  CodeItem,
  DocItem,
  DoclingDocument,
  GroupItem,
  ListItem,
  NodeItem,
  PictureBarChartData,
  PictureClassificationData,
  PictureDescriptionData,
  PictureItem,
  PictureLineChartData,
  PictureMiscData,
  PictureMoleculeData,
  PicturePieChartData,
  PictureScatterChartData,
  PictureStackedBarChartData,
  SectionHeaderItem,
  TableItem,
  TextItem,
} from './models';

/**
 * Produce a type identification function for a DocItem subtype.
 *
 * @param labels The values that can be present in the label of the DocItem
 * @returns Function for discriminating a specific DocItem sub-type.
 */
function isItemByLabel<D extends Partial<DocItem>>(...labels: D['label'][]) {
  return function (item: object): item is D {
    return isDocling.DocItem(item) && labels.includes(item.label);
  };
}

/**
 * DocItem sub-type discrimination functions.
 */
export const isDoclingDocItem = {
  CodeItem: isItemByLabel<CodeItem>('code'),
  ListItem: isItemByLabel<ListItem>('list_item'),
  PictureItem: isItemByLabel<PictureItem>('picture'),
  SectionHeaderItem: isItemByLabel<SectionHeaderItem>('section_header'),
  TableItem: isItemByLabel<TableItem>('document_index', 'table'),
  TextItem: isItemByLabel<TextItem>(
    'caption',
    'checkbox_selected',
    'checkbox_unselected',
    'footnote',
    'formula',
    'page_footer',
    'page_header',
    'paragraph',
    'reference',
    'text',
    'title'
  ),
};

type PictureAnnotation = NonNullable<PictureItem['annotations']>[number];

/**
 * Produce a type identification function for an annotation type of a PictureItem.
 * @param kinds The values that can be present in the kind property of the PictureItem.
 * @returns Function for discriminating a specific PictureItem annotation type.
 */
function isPictureAnnotationByKind<D extends PictureAnnotation>(
  ...kinds: D['kind'][]
) {
  return function (item: PictureAnnotation): item is D {
    return kinds.includes(item.kind);
  };
}

/**
 * DocItem annotation type discrimination functions.
 */
export const isDoclingAnnotation = {
  PictureBarChart:
    isPictureAnnotationByKind<PictureBarChartData>('bar_chart_data'),
  PictureClassification:
    isPictureAnnotationByKind<PictureClassificationData>('classification'),
  PictureDescription:
    isPictureAnnotationByKind<PictureDescriptionData>('description'),
  PictureMisc: isPictureAnnotationByKind<PictureMiscData>('misc'),
  PictureMolecule:
    isPictureAnnotationByKind<PictureMoleculeData>('molecule_data'),
  PictureLineChart:
    isPictureAnnotationByKind<PictureLineChartData>('line_chart_data'),
  PicturePieChart:
    isPictureAnnotationByKind<PicturePieChartData>('pie_chart_data'),
  PictureScatterChart:
    isPictureAnnotationByKind<PictureScatterChartData>('scatter_chart_data'),
  PictureStackedBarChart: isPictureAnnotationByKind<PictureStackedBarChartData>(
    'stacked_bar_chart_data'
  ),
};

/**
 * Docling type discrimination functions.
 */
export const isDocling = {
  DocItem(item: object): item is DocItem {
    return isDocling.NodeItem(item) && !isDocling.GroupItem(item);
  },
  Document(item: object): item is DoclingDocument {
    return 'schema_name' in item && item.schema_name === 'DoclingDocument';
  },
  GroupItem(item: object): item is GroupItem {
    return (
      isDocling.NodeItem(item) &&
      (item.self_ref.startsWith('#/groups/') || item.self_ref === '#/body')
    );
  },
  NodeItem(item: object): item is NodeItem {
    return 'self_ref' in item;
  },
  ...isDoclingAnnotation,
  ...isDoclingDocItem,
};
