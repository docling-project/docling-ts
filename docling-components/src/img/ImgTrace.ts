import { DocItem, PageItem } from '@docling/docling-core';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { normalBbox } from '../item';

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

      const centers = this.items.map(item => {
        const box = normalBbox(item.prov?.find(p => p.page_no === page_no)?.bbox!, this.page!);
        return [
          (box.l + box.r) / 2,
          (box.t + box.b) / 2,
        ];
      });

      const d = `M${centers[0][0]} 0 ${centers.slice(0).map((c) => `L${c[0]} ${c[1]}`)} L${centers.at(-1)![0]} ${height}`;

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
          class="halo"
          vector-effect="non-scaling-stroke"
          d=${d}
          marker-start="url(#arrow)"
        />

        <path
          class="trace"
          vector-effect="non-scaling-stroke"
          d=${d}
          marker-start="url(#arrow)"
        />
      </svg>`;
    }
  }

  static styles = css`
    svg {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .halo {
      fill: none;
      stroke-width: 5px;
      stroke: white;
      stroke-linejoin: round;
    }

    .trace {
      fill: none;
      stroke-width: 3px;
      stroke: rgba(0, 0, 255);
      stroke-linejoin: round;
    }

    marker > path {
      fill: rgba(0, 0, 255);
      stroke: none;
    }
  `;
}
