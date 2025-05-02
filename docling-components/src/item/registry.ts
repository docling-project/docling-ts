import { customElement, CustomElementDecorator } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

export const customDoclingItemElements: (typeof DoclingItemElement)[] = [];

export function customDoclingItemElement(
  tagName: string
): CustomElementDecorator {
  const decorator = customElement(tagName);

  return function (target, context?: ClassDecoratorContext) {
    customDoclingItemElements.push(target as typeof DoclingItemElement);

    return decorator(target, context as any);
  };
}
