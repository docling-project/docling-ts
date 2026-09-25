import {
  DocItem,
  isDocling,
  PageItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { customElement } from 'lit/decorators.js';
import { html } from 'lit';
import {
  Annotation,
  DoclingAnnotationElement,
} from '../annotation/AnnotationElement';
import { customDoclingAnnotationElements } from '../annotation/registry';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElements } from './registry';

@customElement('docling-view')
export abstract class ItemView extends DoclingItemElement<DocItem> {
  abstract type: string;

  private get itemChildren() {
    return Array.from(this.childNodes ?? []).filter(
      c => c instanceof DoclingItemElement
    );
  }

  private get annotationChildren() {
    return Array.from(this.childNodes).filter(
      c => c instanceof DoclingAnnotationElement
    );
  }

  private get isCustomized() {
    return this.itemChildren.length > 0 || this.annotationChildren.length > 0;
  }

  renderItem(item: DocItem, page: PageItem, prov: ProvenanceItem) {
    const shadowElements: (DoclingItemElement | DoclingAnnotationElement)[] =
      [];
    const isCustomized = this.isCustomized;

    type ElementClass = new () => DoclingItemElement | DoclingAnnotationElement;

    // Item elements.
    if (isCustomized) {
      this.itemChildren
        .filter(c => c.canDrawItem(item))
        .forEach(c => shadowElements.push(c));
    } else {
      customDoclingItemElements
        .filter(el => el.prototype.canDrawItem(item))
        .forEach(el =>
          shadowElements.push(new (el as unknown as ElementClass)())
        );
    }

    // Annotation elements.
    const annotations = ((item as unknown as Record<string, unknown>)
      .annotations ?? []) as Annotation[];
    for (const ann of annotations) {
      const annElements: DoclingAnnotationElement[] = [];

      if (isCustomized) {
        this.annotationChildren
          .filter(c => c.canDrawItem(c) && c.canDrawAnnotation(ann))
          .forEach(c =>
            annElements.push(c.cloneNode(true) as DoclingAnnotationElement)
          );
      } else {
        customDoclingAnnotationElements
          .filter(
            el =>
              el.prototype.canDrawItem(item) &&
              el.prototype.canDrawAnnotation(ann)
          )
          .forEach(el =>
            annElements.push(
              new (el as unknown as ElementClass)() as DoclingAnnotationElement
            )
          );
      }

      for (const el of annElements) {
        el.annotation = ann;
      }

      shadowElements.push(...annElements);
    }

    for (const el of shadowElements) {
      el.item = item;
      el.page = page;
      el.prov = prov;
    }

    return html`${shadowElements}`;
  }

  canDrawItem(item: object): item is DocItem {
    type WithAnnotations = { annotations?: Annotation[] };
    if (isDocling.DocItem(item) && this.isCustomized) {
      return (
        this.itemChildren.some(c => c.canDrawItem(item)) ||
        this.annotationChildren.some(
          c =>
            c.canDrawItem(item) &&
            (item as WithAnnotations).annotations?.some(a =>
              c.canDrawAnnotation(a)
            )
        )
      );
    } else {
      return (
        customDoclingItemElements.some(el => el.prototype.canDrawItem(item)) ||
        customDoclingAnnotationElements.some(
          el =>
            el.prototype.canDrawItem(item) &&
            (item as WithAnnotations).annotations?.some(a =>
              el.prototype.canDrawAnnotation(a)
            )
        )
      );
    }
  }
}

@customElement('docling-overlay')
export class ItemOverlay extends ItemView {
  type = 'overlay';
}

@customElement('docling-tooltip')
export class ItemTooltip extends ItemView {
  type = 'tooltip';
}
