import { PageItem, ProvenanceItem } from '@docling/docling-core';
import { LitElement, TemplateResult, css } from 'lit';
import { property } from 'lit/decorators.js';
import { DocItem } from '../util';

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
      const level = this.item.level ?? 0;
      this.setAttribute('data-level', String(level));
      this.style.setProperty('--docling-level', String(level));
      this.setAttribute('data-layer', this.item.content_layer ?? '');
      return this.renderItem(this.item, this.page, this.prov);
    }
  }

  static styles = css`
    :host([data-layer='furniture']) {
      opacity: 0.33;
    }
  `;
}
