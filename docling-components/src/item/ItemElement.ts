import { DocItem, PageItem, ProvenanceItem } from '@docling/docling-core';
import { LitElement, TemplateResult } from 'lit';
import {
  customElement,
  CustomElementDecorator,
  property,
} from 'lit/decorators.js';
import { customDoclingItemElements } from './registry';

export abstract class DoclingItemElement<
  I extends object = object,
> extends LitElement {
  @property({ attribute: false })
  item?: DocItem;

  @property({ attribute: false })
  page?: PageItem;

  @property({ attribute: false })
  prov?: ProvenanceItem;

  abstract renderItem(item: I, page: PageItem, prov?: ProvenanceItem): TemplateResult;

  canDraw(item: object): item is I {
    return false;
  }

  render() {
    if (this.item && this.page && this.canDraw(this.item)) {
      return this.renderItem(this.item, this.page, this.prov);
    }
  }
}

export function customDoclingElement(tagName: string): CustomElementDecorator {
  const decorator = customElement(tagName);

  return function (target, context?: ClassDecoratorContext) {
    customDoclingItemElements.push(target as typeof DoclingItemElement);

    return decorator(target, context as any);
  };
}
