import { isDoclingDocItem, ListItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customDoclingElement, DoclingItemElement } from './ItemElement';

@customDoclingElement(
  'docling-item-list',
  (item, page) =>
    html`<docling-item-list .item=${item} .page=${page}></docling-item-list>`
)
export class ItemList extends DoclingItemElement<ListItem> {
  renderItem(item: ListItem) {
    return html`<div><span>${item.text}</span></div>`;
  }

  canDraw(item: object): item is ListItem {
    return isDoclingDocItem.ListItem(item);
  }

  static styles = css`
    div {
      display: flex;
      gap: 0.5rem;
    }
  `;
}
