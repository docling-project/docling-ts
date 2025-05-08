import {
  isDoclingAnnotation,
  isDoclingDocItem,
  PageItem,
  PictureClassificationData,
  PictureItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { css, html, nothing, TemplateResult } from 'lit';
import { customDoclingAnnotationElement } from './registry';
import { DoclingAnnotationElement } from './AnnotationElement';
import { property } from 'lit/decorators.js';

@customDoclingAnnotationElement('docling-picture-classification')
export class AnnotationPictureClassification extends DoclingAnnotationElement<
  PictureItem,
  PictureClassificationData
> {
  @property()
  precision: number = 2;

  renderAnnotation(
    annotation: PictureClassificationData,
    item: PictureItem,
    page: PageItem,
    prov?: ProvenanceItem
  ): TemplateResult {
    const classes = annotation.predicted_classes ?? [];
    const threshold = Math.pow(10, -1 * this.precision);
    const topClasses = classes.filter(c => threshold < c.confidence);
    const restClasses = classes.filter(c => c.confidence < threshold);

    const format = (value: number) =>
      value.toLocaleString(undefined, {
        maximumFractionDigits: this.precision,
      });

    return html`<table>
      <thead>
        <tr>
          <th>Class</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${topClasses.map(
          ({ class_name, confidence }) =>
            html`<tr>
              <td>${class_name}</td>
              <td>${format(confidence)}</td>
            </tr>`
        )}
        ${restClasses.length === 0
          ? nothing
          : html`<tr
              class="more"
              title=${restClasses
                .map(c => `${c.class_name}\t\t\t${c.confidence}`)
                .join('\n')}
            >
              <td>${restClasses.length} more</td>
              <td>< ${format(threshold)}</td>
            </tr>`}
      </tbody>
    </table>`;
  }

  canDrawAnnotation(
    annotation: PictureClassificationData
  ): annotation is PictureClassificationData {
    return isDoclingAnnotation.PictureClassification(annotation);
  }

  canDrawItem(item: PictureItem): item is PictureItem {
    return isDoclingDocItem.PictureItem(item);
  }

  static styles = css`
    table {
      margin: 0.5rem;
      font-size: inherit;
      line-height: 1.25;
    }

    td,
    th {
      padding: 0 1rem 0 0;
    }

    th {
      font-weight: bold;
      text-align: left;
    }

    tr.more td {
      padding-top: 0.25rem;
      color: gray;
    }
  `;
}
