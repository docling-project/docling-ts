import {
  isDoclingAnnotation,
  isDoclingDocItem,
  PageItem,
  PictureDescriptionData,
  PictureItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { css, html, TemplateResult } from 'lit';
import { customDoclingAnnotationElement } from './registry';
import { DoclingAnnotationElement } from './AnnotationElement';

@customDoclingAnnotationElement('docling-picture-description')
export class AnnotationPictureDescription extends DoclingAnnotationElement<
  PictureItem,
  PictureDescriptionData
> {
  renderAnnotation(
    annotation: PictureDescriptionData,
    item: PictureItem,
    page: PageItem,
    prov?: ProvenanceItem
  ): TemplateResult {
    return html`<p><span>Description</span>${annotation.text}</p>`;
  }

  canDrawAnnotation(
    annotation: PictureDescriptionData
  ): annotation is PictureDescriptionData {
    return isDoclingAnnotation.PictureDescription(annotation);
  }

  canDrawItem(item: PictureItem): item is PictureItem {
    return isDoclingDocItem.PictureItem(item);
  }

  static styles = css`
    p {
      font-size: 1rem;
      line-height: 1.25rem;
      white-space: pre-line;
    }

    span {
      padding-right: 1rem;
      font-weight: bold;
    }
  `;
}
