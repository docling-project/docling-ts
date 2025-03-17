import { DocItem, isDoclingDocItem } from '@docling/docling-core';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-view')
export class ItemView extends DoclingItemElement {
  render() {
    if (this.item) {
      return html`
        <docling-item-list .item=${this.item}></docling-item-list>
        <docling-section-header .item=${this.item}></docling-item-list>
        <docling-item-table .item=${this.item}></docling-item-table>
        <docling-item-text .item=${this.item}></docling-item-text>
      `;
    }
  }

  static canDraw(item: DocItem): boolean {
      return !isDoclingDocItem.PictureItem(item);
  }
}
