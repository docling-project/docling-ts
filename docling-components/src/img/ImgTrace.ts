import { DocItem, PageItem } from '@docling/docling-core';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('docling-trace')
export class ImgTrace extends LitElement {
  @property({ type: Object })
  page?: PageItem;

  @property({ type: Array })
  items?: DocItem[];

  render() {
    if (this.page && this.items && this.items.length > 0) {
      const { page_no, size } = this.page;
      const { width = 1, height = 1 } = size;

      const bbox = (item: DocItem) =>
        item.prov?.find(p => p.page_no === page_no)?.bbox;

      const topLefts = this.items.map(item => {
        const box = bbox(item)!;
        return [box.l, height - box.t];
      });

      return html`<svg viewBox="0 0 ${width} ${height}">
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10" />
        </marker>

        <path
          vector-effect="non-scaling-stroke"
          d="M${topLefts[0][0]} 0 ${topLefts.map(tl => `L${tl[0]} ${tl[1]}`)} L${topLefts.at(-1)![0]} ${height}"
          marker-start="url(#arrow)"
          marker-end="url(#arrow)"
        />
      </svg>`;
    }
  }

  static styles = css`
    svg {
      position: absolute;
      inset: 0;
    }

    path {
      fill: none;
      stroke-width: 3px;
      stroke: black;
    }

    marker > path {
      fill: black;
      stroke: none;
    }
  `;
}
