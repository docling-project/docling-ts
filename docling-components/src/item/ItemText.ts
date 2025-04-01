import {
  isDoclingDocItem,
  PageItem,
  ProvenanceItem,
  TextItem,
} from '@docling/docling-core';
import { css, html, TemplateResult } from 'lit';
import { customDoclingElement, DoclingItemElement } from './ItemElement';
import { normalBbox } from '.';

@customDoclingElement('docling-item-text')
export class ItemText extends DoclingItemElement<TextItem> {
  renderItem(
    item: TextItem,
    page: PageItem,
    prov?: ProvenanceItem
  ): TemplateResult {
    const hClass = isDoclingDocItem.SectionHeaderItem(item) ? 'header' : '';

    // Derive appropriate font size for drawing in a specific provenance.
    if (prov) {
      const { l, r, t, b } = normalBbox(prov.bbox, page);
      const sizeApprox = Math.sqrt(((r - l) * (b - t)) / item.text.length);
      const size = Math.min(Math.floor(1.25 * sizeApprox), (b - t) / 1.5);

      const [tl, tu] = (prov.charspan as [number, number]) ?? [
        0,
        item.text.length,
      ];
      const text = item.text.substring(tl, tu);

      return html`<p
        class=${hClass}
        style="font-size: ${size}px; line-height: ${1.25 * size}px"
      >
        ${text}
      </p>`;
    } else {
      return html`<p class=${hClass}>${item.text}</p>`;
    }
  }

  canDraw(item: object): item is TextItem {
    return (
      isDoclingDocItem.TextItem(item) ||
      isDoclingDocItem.SectionHeaderItem(item) ||
      isDoclingDocItem.ListItem(item)
    );
  }

  static styles = css`
    p {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 1rem;
      line-height: 1.25rem;
    }

    .header {
      font-weight: bold;
    }
  `;
}
