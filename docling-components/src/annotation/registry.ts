import { customElement, CustomElementDecorator } from 'lit/decorators.js';
import { DoclingAnnotationElement } from './AnnotationElement';

export const customDoclingAnnotationElements: (typeof DoclingAnnotationElement)[] =
  [];

export function customDoclingAnnotationElement(
  tagName: string
): CustomElementDecorator {
  const decorator = customElement(tagName);

  return function (target, context?: ClassDecoratorContext) {
    customDoclingAnnotationElements.push(
      target as typeof DoclingAnnotationElement
    );

    return decorator(target, context as any);
  };
}
