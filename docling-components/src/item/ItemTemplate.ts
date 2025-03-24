import { isDocling, PageItem, TextItem } from '@docling/docling-core';
import { css, html, TemplateResult } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customElement } from 'lit/decorators.js';

@customElement('docling-template')
export class ItemTemplate extends DoclingItemElement<TextItem> {

  renderItem = Function(
      'item',
      'page',
      `"use strict"; return this.html\`${this.innerHTML}\`;`
    ).bind({ html });

  canDraw(item: object): item is TextItem {
    return isDocling.DocItem(item);
  }
}
