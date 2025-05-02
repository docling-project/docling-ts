import {
  DocItem,
  PageItem,
  PictureItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { LitElement, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

export type Annotation = NonNullable<PictureItem['annotations']>[number];

export abstract class DoclingAnnotationElement<
  I extends object = object,
  A extends object = object,
> extends LitElement {
  @property({ attribute: false })
  annotation?: Annotation;

  @property({ attribute: false })
  item?: DocItem;

  @property({ attribute: false })
  page?: PageItem;

  @property({ attribute: false })
  prov?: ProvenanceItem;

  abstract renderAnnotation(
    annotation: A,
    item: I,
    page: PageItem,
    prov?: ProvenanceItem 
  ): TemplateResult;

  abstract canDrawAnnotation(annotation: object): annotation is A;

  abstract canDrawItem(item: object): item is I;

  render() {
    if (
      this.annotation &&
      this.item &&
      this.page &&
      this.canDrawAnnotation(this.annotation) &&
      this.canDrawItem(this.item)
    ) {
      return this.renderAnnotation(
        this.annotation,
        this.item,
        this.page,
        this.prov
      );
    }
  }
}
