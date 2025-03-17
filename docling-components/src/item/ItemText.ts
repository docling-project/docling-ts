import { isDoclingDocItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-text')
export class ItemText extends DoclingItemElement {
  render() {
    if (this.item && isDoclingDocItem.TextItem(this.item)) {
      return html` <p>${this.item.text}</p>`;
    }
  }

  static styles = css`
    p {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 1rem;
      line-height: 1.25rem;
    }
  `;
}
