import { PageItem } from '@docling/docling-core';
import { LitElement, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

export abstract class DoclingItemElement<I extends object> extends LitElement {
  @property()
  item?: object;

  @property()
  page?: PageItem;

  abstract renderItem(item: I, page: PageItem): TemplateResult | undefined;

  canDraw(item: object): item is I {
    return false;
  }

  render() {
    if (this.item && this.page && this.canDraw(this.item)) {
      return this.renderItem(this.item, this.page);
    }
  }
}
