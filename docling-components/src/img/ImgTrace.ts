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

      const ltmb = this.items.map(item => {
        const box = bbox(item)!;
        return [
          box.l,
          height - box.t,
          height - 0.5 * (box.t + box.b),
          height - box.b,
        ];
      });

      return html`<svg viewBox="0 0 ${width} ${height}">
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10" />
        </marker>

        <path
          vector-effect="non-scaling-stroke"
          d="M${ltmb[0][0]} 0 L${ltmb[0][0]} ${ltmb[0][1]} ${ltmb.slice(0).map(
            (c, i) => `L${c[0]} ${c[1]} L${c[0]} ${c[3]}`
          )} L${ltmb.at(-1)![0]} ${height}"
          marker-start="url(#arrow)"
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
      stroke: rgba(0, 0, 255, 0.5);
      stroke-linejoin: round;
    }

    marker > path {
      fill: rgba(0, 0, 255);
      stroke: none;
    }
  `;
}
