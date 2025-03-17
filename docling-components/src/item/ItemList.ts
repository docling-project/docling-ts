import { isDoclingDocItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-list')
export class ItemList extends DoclingItemElement {
  render() {
    if (this.item && isDoclingDocItem.ListItem(this.item)) {
      return html` <div>
        <span>${this.item.text}</span>
      </div>`;
    }
  }

  static styles = css`
    div {
      display: flex;
      gap: 0.5rem;
    }
  `;
}
