import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-view')
export class ItemView extends DoclingItemElement<DocItem> {
  renderItem(item: DocItem, page: PageItem) {
    return html`
      <docling-item-list .item=${item} .page=${page}></docling-item-list>
      <docling-item-section-header .item=${item} .page=${page}></docling-item-section-header>
      <docling-item-table .item=${item} .page=${page}></docling-item-table>
      <docling-item-text .item=${item} .page=${page}></docling-item-text>
    `;
  }

  canDraw(item: object) {
    return isDocling.DocItem(item);
  }
}
