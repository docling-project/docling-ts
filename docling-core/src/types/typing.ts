import {
  DocItem,
  DoclingDocument,
  GroupItem,
  ListItem,
  NodeItem,
  PictureItem,
  SectionHeaderItem,
  TableItem,
  TextItem,
} from './models';

export const isDoclingDocItem = {
  ListItem(item: any): item is ListItem {
    const labels: ListItem['label'][] = ['list_item'];

    return isDocling.DocItem(item) && labels.includes(item.label as any);
  },
  PictureItem(item: any): item is PictureItem {
    const labels: PictureItem['label'][] = ['picture'];

    return isDocling.DocItem(item) && labels.includes(item.label as any);
  },
  SectionHeaderItem(item: any): item is SectionHeaderItem {
    const labels: SectionHeaderItem['label'][] = ['section_header'];

    return isDocling.DocItem(item) && labels.includes(item.label as any);
  },
  TableItem(item: any): item is TableItem {
    const labels: TableItem['label'][] = ['document_index', 'table'];

    return isDocling.DocItem(item) && labels.includes(item.label as any);
  },
  TextItem(item: any): item is TextItem {
    const labels: TextItem['label'][] = [
      'caption',
      'checkbox_selected',
      'checkbox_unselected',
      'code',
      'footnote',
      'formula',
      'page_footer',
      'page_header',
      'paragraph',
      'reference',
      'text',
      'title',
    ];

    return isDocling.DocItem(item) && labels.includes(item.label as any);
  },
};

export const isDocling = {
  Document(item: any): item is DoclingDocument {
    return item?.schema_name === 'DoclingDocument';
  },
  NodeItem(item: any): item is NodeItem {
    return 'self_ref' in item;
  },
  GroupItem(item: any): item is GroupItem {
    return (
      (isDocling.NodeItem(item) && item.self_ref === '#/body') ||
      item.self_ref.startsWith('#/groups/')
    );
  },
  DocItem(item: any): item is DocItem {
    return isDocling.NodeItem(item) && !isDocling.GroupItem(item);
  },
  ...isDoclingDocItem,
};
