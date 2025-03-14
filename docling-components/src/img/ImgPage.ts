import * as dl from '@docling/docling-core';
import { CommonPageProps } from '../props';
import { DocItem } from '@docling/docling-core';

export default function({
    page,
    items = [],
    pagenumbers,
    backdrop,
    // tooltip,
    itemPart,
    itemStyle,
    onclick
} :{
    page: dl.PageItem;
    items?: dl.DocItem[];
    // tooltip?: Snippet<[DocItem]>;
    backdrop?: boolean;
  } & CommonPageProps) {

}