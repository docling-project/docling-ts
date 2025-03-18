import { isDoclingDocItem, TextItem } from '@docling/docling-core';
import { css, html, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-text')
export class ItemText extends DoclingItemElement<TextItem> {
  renderItem(item: TextItem): TemplateResult {
    return html`<p>${item.text}</p>`;
  }

  canDraw(item: object): item is TextItem {
    return isDoclingDocItem.TextItem(item);
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
