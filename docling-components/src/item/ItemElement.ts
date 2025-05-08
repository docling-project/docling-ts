import { DocItem, PageItem, ProvenanceItem } from '@docling/docling-core';
import { LitElement, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

export abstract class DoclingItemElement<
  I extends object = object,
> extends LitElement {
  @property({ attribute: false })
  item?: DocItem;

  @property({ attribute: false })
  page?: PageItem;

  @property({ attribute: false })
  prov?: ProvenanceItem;

  abstract renderItem(
    item: I,
    page: PageItem,
    prov?: ProvenanceItem
  ): TemplateResult;

  abstract canDrawItem(item: object): item is I;

  render() {
    if (this.item && this.page && this.canDrawItem(this.item)) {
      return this.renderItem(this.item, this.page, this.prov);
    }
  }
}
