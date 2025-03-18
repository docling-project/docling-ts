import { DocItem, PageItem } from '@docling/docling-core';
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ItemView } from '../item/ItemView';

@customElement('docling-img-page')
export class ImgPage extends LitElement {
  @property()
  page?: PageItem;

  @property()
  items?: DocItem[];

  @property()
  backdrop?: boolean;

  @property()
  pagenumbers?: boolean;

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  @state()
  hovered?: { item: DocItem; bounds: DOMRect; quadrant: number };

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
        <div
          part="page"
          class="page"
          @onclick=${(e: MouseEvent) => handleClick?.(e)}
          role="tab"
        >
          <svg width=${image.size.width} viewBox="0 0 ${width} ${height}">
            <!-- Suppressed backdrop image. -->
            ${this.backdrop &&
            svg`
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
                      const { l, r, t, b } = prov.bbox;

                      return svg`<rect
                        x=${l}
                        y=${height - t}
                        width=${r - l}
                        height=${t - b}
                      />`;
                    }
                  })}
                </clippath>
              `}

            <!-- Foreground image. -->
            <image
              id="image"
              href=${image.uri}
              clip-path="url(#clip-page-${page_no})"
              width=${width}
              height=${height}
            />

            ${this.items?.map(item => {
              const prov = item.prov?.find(p => p.page_no === page_no);

              if (prov) {
                const { l, r, t, b } = prov.bbox;

                return svg`<rect
                  part=${'item' + (this.itemPart ? ' ' + this.itemPart(this.page!, item) : '')}
                  style=${this.itemStyle?.(this.page!, item)}
                  x=${l}
                  y=${height - t}
                  width=${r - l}
                  height=${t - b}
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

                    this.hovered = {
                      item,
                      bounds,
                      quadrant,
                    };
                  }}
                />`;
              }
            })}
          </svg>

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
            : ''}
        </div>

        ${this.tooltip()}
      `;
    } else {
      return html`Invalid page image.`;
    }
  }

  private tooltip() {
    if (this.hovered && ItemView.prototype.canDraw(this.hovered.item)) {
      const { quadrant, bounds } = this.hovered;

      return html`<div
        part="tooltip"
        class="tooltip"
        style="
              ${quadrant === 1
          ? `left: ${bounds.right}px`
          : quadrant === 3
            ? `right: ${document.body.clientWidth - bounds.left}px`
            : `left: calc(${bounds.left}px - 2rem)`};
              ${quadrant === 0
          ? `bottom: ${document.body.clientHeight - bounds.top}px`
          : quadrant === 2
            ? `top: ${bounds.bottom}px`
            : `top: calc(${bounds.top}px - 2rem)`};
            "
        bind:this="{slotRef}"
      >
        <docling-item-view
          .item=${this.hovered.item}
          .page=${this.page}
        ></docling-item-view>
      </div>`;
    }
  }

  static styles = css`
    svg {
      max-width: 100%;
    }

    .page {
      position: relative;
      width: fit-content;
      max-width: 100%;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;

      color: black;
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

// function tooltipSnippet(host?: HTMLElement) {
//   const views = Array.from($host()?.querySelectorAll('docling-view[type=tooltip]') ?? []);

//   if (views.some((v: any) => v.supportsItem?.(item()))) {
//     return createRawSnippet<[DocItem]>(item => {
//       return {
//         setup(element: Element) {
//           $effect(() => {
//             const copies: Node[] = [];

//             views.forEach(el => {
//               if ((el as any).supportsItem(item())) {
//                 const copy = el.cloneNode(true) as Element;
//                 (copy as any).item = item();

//                 if (copy.shadowRoot?.hasChildNodes()) {
//                   copies.push(copy);
//                 }
//               }
//             });

//             element.replaceChildren(...copies);

//             return () => {};
//           });
//         },
//         render() {
//           return `<div></div>`;
//         },
//       };
//     });
//   } else {
//     return undefined;
//   }
// }
