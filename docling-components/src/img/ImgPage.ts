import {
  DocItem,
  isDoclingDocItem,
  PageItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { normalBbox } from '../item';
import { ItemOverlay, ItemTooltip } from '../item/ItemView';
import { ImgTrace } from './ImgTrace';

@customElement('docling-img-page')
export class ImgPage extends LitElement {
  @property({ type: Object })
  page?: PageItem;

  @property({ type: Array })
  items?: DocItem[];

  @property({ type: Boolean })
  pagenumbers: boolean = false;

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  @property({ type: Boolean })
  backdrop?: boolean;

  @property({ type: Object })
  overlay?: ItemOverlay;

  @property({ type: Object })
  tooltip?: ItemTooltip;

  @property({ type: Object })
  trace?: ImgTrace;

  render() {
    if (this.page?.image) {
      const { image, size, page_no } = this.page;
      const { width = 1, height = 1 } = size;

      const handleClick =
        this.onClickItem && this.page
          ? (e: MouseEvent, item?: DocItem) =>
              this.onClickItem?.(e, this.page!, item)
          : undefined;

      return html`
        <div class="page" @onclick=${(e: MouseEvent) => handleClick?.(e)}>
          <svg
            class="base"
            width=${image.size.width}
            viewBox="0 0 ${width} ${height}"
          >
            ${this.backdrop
              ? svg`
                <image
                  class="backdrop"
                  href=${image.uri}
                  width=${width}
                  height=${height}
                />

                <clippath id="clip-page-${page_no}">
                  ${this.items?.map(item => {
                    const prov = item.prov?.find(p => p.page_no === page_no);

                    if (prov) {
                      const { l, r, t, b } = normalBbox(prov.bbox, this.page!);

                      return svg`<rect
                        x=${l}
                        y=${t}
                        width=${r - l}
                        height=${b - t}
                      />`;
                    }
                  })}
                </clippath>
              `
              : nothing}

            <image
              id="image"
              href=${image.uri}
              clip-path="url(#clip-page-${page_no})"
              width=${width}
              height=${height}
            />

            ${this.items?.flatMap(item =>
              (item.prov ?? [])
                .filter(p => p.page_no === page_no)
                .map(prov => {
                  const { l, r, t, b } = normalBbox(prov.bbox, this.page!);

                  return svg`
                  ${this.layOver(item, prov)}

                  <rect
                  part=${'item' + (this.itemPart ? ' ' + this.itemPart(this.page!, item) : '')}
                  style=${this.itemStyle?.(this.page!, item)}
                  x=${l}
                  y=${t}
                  width=${r - l}
                  height=${b - t}
                  vector-effect="non-scaling-stroke"
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    handleClick?.(e, item);
                  }}
                  @mouseenter=${(e: MouseEvent) => {
                    const bounds = (
                      e.currentTarget as HTMLDivElement
                    ).getBoundingClientRect();

                    // Sizes of surrounding areas: Top, right, bottom, left.
                    const areas = [
                      bounds.top * window.innerWidth,
                      (window.innerWidth - bounds.right) * window.innerHeight,
                      (window.innerHeight - bounds.bottom) * window.innerWidth,
                      bounds.left * window.innerHeight,
                    ];
                    const maxArea = Math.max(...areas);
                    const quadrant = areas.findIndex(a => a === maxArea);

                    this.attachTooltip(item, prov, bounds, quadrant);
                  }}
                  @mouseleave=${() => this.removeTooltip()}
                  />
                `;
                })
            )}
          </svg>

          ${this.renderTrace()}
          ${this.pagenumbers
            ? html`<header
                  part="page-number-top"
                  class="page-number-top"
                  title="Page ${page_no}"
                >
                  ${page_no}
                </header>

                <header
                  part="page-number-bottom"
                  class="page-number-bottom"
                  title="Page ${page_no}"
                >
                  ${page_no}
                </header>`
            : nothing}
        </div>
      `;
    } else {
      return html`Invalid page image.`;
    }
  }

  private layOver(item: DocItem, prov: ProvenanceItem) {
    if (this.overlay?.canDrawItem(item)) {
      const clone = this.overlay.cloneNode(true) as ItemOverlay;
      clone.item = item;
      clone.page = this.page;
      clone.prov = prov;

      const { l, r, t, b } = normalBbox(prov.bbox, this.page!);
      const overlayClass = isDoclingDocItem.PictureItem(item)
        ? 'softOverlay'
        : 'hardOverlay';

      return svg`<foreignObject part="overlay" class=${overlayClass} x=${l} y=${t} width=${r - l} height=${b - t}>${clone}</foreignObject>`;
    }
  }

  private attachTooltip(
    item: DocItem,
    prov: ProvenanceItem,
    bounds: DOMRect,
    quadrant: number
  ) {
    if (this.tooltip?.canDrawItem(item)) {
      const clone = this.tooltip.cloneNode(true) as ItemTooltip;
      clone.id = 'tooltip';
      clone.setAttribute('part', 'tooltip');
      clone.className = 'tooltip';
      clone.setAttribute(
        'style',
        `
        ${
          quadrant === 1
            ? `left: ${bounds.right}px`
            : quadrant === 3
              ? `right: ${window.outerWidth - bounds.left}px`
              : `left: calc(${bounds.left}px - 2rem)`
        };
        ${
          quadrant === 0
            ? `bottom: ${window.innerHeight - bounds.top}px`
            : quadrant === 2
              ? `top: ${bounds.bottom}px`
              : `top: calc(${bounds.top}px - 2rem)`
        };
        max-width: ${2 * Math.max(prov.bbox.r - prov.bbox.l, 200)}px;
        `
      );
      clone.item = item;
      clone.page = this.page!;

      this.renderRoot.appendChild(clone);
    }
  }

  private removeTooltip() {
    this.renderRoot.querySelector('#tooltip')?.remove();
  }

  private renderTrace() {
    if (this.trace) {
      const clone = this.trace.cloneNode(true) as ImgTrace;
      clone.page = this.page;
      clone.items = this.items;
      return clone;
    }
  }

  static styles = css`
    .page {
      position: relative;
      width: fit-content;
      color: black;
    }

    .base {
      max-width: 100%;
    }

    svg:not(.base) {
      position: absolute;
      inset: 0;
    }

    .backdrop {
      opacity: 0.3;
    }

    .page-number-top,
    .page-number-bottom {
      position: absolute;
      left: 0;
      width: fit-content;
      padding: 0 0.25rem;

      font-size: 0.75rem;
      line-height: 1rem;
      color: rgb(120, 120, 120);
      mix-blend-mode: difference;
    }

    .page-number-top {
      top: 0;
    }

    .page-number-bottom {
      bottom: 0;
    }

    rect {
      fill: blue;
      fill-opacity: 0.0001; /* To activate hover. */
      stroke: grey;
      stroke-width: 1px;
      stroke-dasharray: 1;
      cursor: pointer;
    }

    rect:hover {
      fill-opacity: 0.1;
      stroke: blue;
    }

    rect:target {
      stroke: blue;
      stroke-width: 3px;
      stroke-dasharray: none;
    }

    .hardOverlay,
    .softOverlay {
      font-size: 62.5%;
      background-color: white;
    }

    .softOverlay {
      opacity: 0.9;
    }

    .tooltip {
      position: fixed;
      z-index: 100;
      padding: 1rem;
      margin: 1rem;

      background: white;
      border: 1px solid rgb(230, 230, 230);
      box-shadow: 0 0.5rem 1rem 0 rgba(0, 0, 0, 0.2);
    }
  `;
}
