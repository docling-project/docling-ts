import { DocItem, DoclingDocument, PageItem } from '@docling/docling-core';

export interface CommonComponentProps extends CommonPageProps {
  src?: string | DoclingDocument;
  items?: string | DocItem[];
  alt?: string;
}

export interface CommonPageProps {
  pagenumbers?: boolean;

  itemPart?(page: PageItem, item: DocItem): string;
  itemStyle?(page: PageItem, item: DocItem): string;
  onclick?(ev: MouseEvent, page: PageItem, item?: DocItem): void;
}
