import { isDocling, PageItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { normalBbox } from '.';
import { DocItem } from '../util';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-provenance')
export class ItemProvenance extends DoclingItemElement<DocItem> {
  renderItem(item: DocItem, page: PageItem) {
    const { image } = page;
    const prov = item.prov?.find(p => p.page_no === this.page?.page_no);

    if (image && prov) {
      const { width = 1, height = 1 } = this.page!.size;
      const { l, r, t, b } = normalBbox(prov.bbox, page);

      const pixelRatio = (image.size.width ?? 1) / width;
      const w = (r - l) * pixelRatio;
      const h = (b - t) * pixelRatio;

      return html`
        <svg
          data-width=${w}
          data-height=${h}
          style="--docling-width: ${w}px; --docling-height: ${h}px;"
          viewBox="${l} ${t} ${r - l} ${b - t}"
        >
          <image href=${image.uri} width=${width} height=${height} />
        </svg>
      `;
    } else {
      return html`<span>Invalid provenance.</span>`;
    }
  }

  canDrawItem(item: object): item is DocItem {
    return isDocling.DocItem(item);
  }

  static styles = css`
    svg {
      width: calc(var(--docling-width, 100%) * var(--docling-provenance-scale, 1));
      max-width: 100%;
    }
  `;
}
