import {
  CodeItem,
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

function isByLabel<D extends Partial<DocItem>>(...labels: D['label'][]) {
  return function (item: object): item is D {
    return isDocling.DocItem(item) && labels.includes(item.label);
  };
}

export const isDoclingDocItem = {
  CodeItem: isByLabel<CodeItem>('code'),
  ListItem: isByLabel<ListItem>('list_item'),
  PictureItem: isByLabel<PictureItem>('picture'),
  SectionHeaderItem: isByLabel<SectionHeaderItem>('section_header'),
  TableItem: isByLabel<TableItem>('document_index', 'table'),
  TextItem: isByLabel<TextItem>(
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

export const isDocling = {
  Document(item: object): item is DoclingDocument {
    return 'schema_name' in item && item.schema_name === 'DoclingDocument';
  },
  NodeItem(item: object): item is NodeItem {
    return 'self_ref' in item;
  },
  GroupItem(item: object): item is GroupItem {
    return (
      isDocling.NodeItem(item) &&
      (item.self_ref.startsWith('#/groups/') || item.self_ref === '#/body')
    );
  },
  DocItem(item: object): item is DocItem {
    return isDocling.NodeItem(item) && !isDocling.GroupItem(item);
  },
  ...isDoclingDocItem,
};
