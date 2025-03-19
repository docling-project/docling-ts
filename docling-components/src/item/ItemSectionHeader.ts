import { isDoclingDocItem, SectionHeaderItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customDoclingElement, DoclingItemElement } from './ItemElement';

@customDoclingElement('docling-item-section-header')
export class ItemSectionHeader extends DoclingItemElement<SectionHeaderItem> {
  renderItem(item: SectionHeaderItem) {
    return html`<h2>${item.text}</h2>`;
  }

  canDraw(item: object) {
    return isDoclingDocItem.SectionHeaderItem(item);
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
