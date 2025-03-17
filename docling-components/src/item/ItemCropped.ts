import { PageItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DoclingItemElement } from './ItemElement';

@customElement('docling-item-cropped')
export class ItemCropped extends DoclingItemElement {
  @property()
  page?: PageItem;

  render() {
    const image = this.page?.image;
    const prov = this.item?.prov?.find(p => p.page_no === this.page?.page_no);

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

  static styles = css`
    svg {
      max-width: 100%;
    }
  `;
}
