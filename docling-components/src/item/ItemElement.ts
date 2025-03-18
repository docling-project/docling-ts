import { PageItem } from '@docling/docling-core';
import { LitElement, TemplateResult } from 'lit';
import {
  customElement,
  CustomElementDecorator,
  property,
} from 'lit/decorators.js';
import { customDoclingItemElements } from './registry';

export abstract class DoclingItemElement<I extends object> extends LitElement {
  @property({ attribute: false })
  item?: object;

  @property({ attribute: false })
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

export function customDoclingElement(
  tagName: string,
  template?: (item: object, page: PageItem) => TemplateResult<1>
): CustomElementDecorator {
  const decorator = customElement(tagName);

  return function (target, context?: ClassDecoratorContext) {
    customDoclingItemElements.push({
      cls: target as Omit<typeof DoclingItemElement, 'new'>,
      template,
    });

    return decorator(target, context as any);
  };
}
