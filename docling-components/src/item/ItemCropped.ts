import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customDoclingElement, DoclingItemElement } from './ItemElement';

@customDoclingElement('docling-item-cropped')
export class ItemCropped extends DoclingItemElement<DocItem> {
  renderItem(item: DocItem, page: PageItem) {
    const { image } = page;
    const prov = item.prov?.find(p => p.page_no === this.page?.page_no);

    if (image && prov) {
      const { width = 1, height = 1 } = this.page!.size;
      const { l, r, t, b } = prov.bbox;

      return html`
        <svg
          width=${(r - l) * ((image.size.width ?? 1) / width)}
          viewBox="${l} ${height - t} ${r - l} ${t - b}"
        >
          <image href=${image.uri} width=${width} height=${height} />
        </svg>
      `;
    } else {
      return html`<span>Invalid provenance.</span>`;
    }
  }

  canDraw(item: object): item is DocItem {
    return isDocling.DocItem(item);
  }

  static styles = css`
    svg {
      max-width: 100%;
    }
  `;
}
