import { isDoclingDocItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-section-header')
export class ItemSectionHeader extends DoclingItemElement {
  render() {
    if (this.item && isDoclingDocItem.SectionHeaderItem(this.item)) {
      return html`<h2>${this.item.text}</h2>`;
    }
  }

  static styles = css`
    h2 {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 1.5rem;
      line-height: 2rem;
    }
  `;
}
