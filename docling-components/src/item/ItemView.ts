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

    // Item elements.
    if (isCustomized) {
      this.itemChildren
        .filter(c => c.canDrawItem(item))
        .forEach(c => shadowElements.push(c));
    } else {
      customDoclingItemElements
        .filter((el: any) => el.prototype.canDrawItem(item))
        .forEach(el => shadowElements.push(new (el as any)()));
    }

    // Annotation elements.
    const annotations = ((item as any).annotations ?? []) as Annotation[];
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
            (el: any) =>
              el.prototype.canDrawItem(item) &&
              el.prototype.canDrawAnnotation(ann)
          )
          .forEach(el => annElements.push(new (el as any)()));
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
    if (isDocling.DocItem(item) && this.isCustomized) {
      return (
        this.itemChildren.some((c: any) => c.canDrawItem(item)) ||
        this.annotationChildren.some(
          (c: any) =>
            c.canDrawItem(item) &&
            (item as any).annotations?.some((a: any) => c.canDrawAnnotation(a))
        )
      );
    } else {
      return (
        customDoclingItemElements.some(el => el.prototype.canDrawItem(item)) ||
        customDoclingAnnotationElements.some(
          el =>
            el.prototype.canDrawItem(item) &&
            (item as any).annotations?.some((a: any) =>
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
