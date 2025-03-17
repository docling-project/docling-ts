import { DocItem, PageItem } from '@docling/docling-core';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('docling-table-page')
export class TablePage extends LitElement {
  @property()
  page?: PageItem;

  @property()
  items?: DocItem[];

  @property()
  columns?: string = 'parsed, image';

  @property()
  pagenumbers?: boolean;

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  render() {
    const cols = this.columns?.split(',')?.map(c => c.trim()) ?? [];

    return html`
      <tbody part="page">
        ${this.pagenumbers &&
        html`
          <tr>
            <td
              part="page-number-top"
              class="page-number"
              title="Page {page.page_no}"
              colspan="{cols.length}"
            >
              ${this.page?.page_no}
            </td>
          </tr>
        `}
        ${this.items?.map(
          item =>
            html`<tr
              part=${'item' +
              (this.itemPart ? ' ' + this.itemPart(this.page!, item) : '')}
              style=${this.itemStyle?.(this.page!, item)}
            >
              ${cols.map(
                col => html`
                  <td
                    @onclick=${(e: MouseEvent) =>
                      this.onClickItem?.(e, this.page!, item)}
                  >
                    ${col === 'parsed'
                      ? html`<docling-item-view .item=${item} />`
                      : col === 'image'
                        ? html`<docling-item-cropped
                            .page=${this.page}
                            .item=${item}
                          />`
                        : undefined}
                  </td>
                `
              )}
            </tr>`
        )}
        ${this.pagenumbers &&
        html`<tr>
          <td
            part="page-number-bottom"
            class="page-number"
            title="Page {page.page_no}"
            colspan="{cols.length}"
          >
            ${this.page?.page_no}
          </td>
        </tr>`}
      </tbody>
    `;
  }

  static styles = css`
    tbody {
      border-bottom: 1px solid rgb(220, 220, 220);
    }

    .page-number {
      padding: 0.25rem;

      background-color: white;
      color: rgb(120, 120, 120);
      font-size: 0.75rem;
      line-height: 1rem;
    }

    tr {
      cursor: pointer;
    }

    tr:not(:nth-last-child(2)) {
      border-bottom: 1px dotted rgb(220, 220, 220);
    }

    td {
      padding: 1rem;
      background-color: white;
      vertical-align: top;
    }

    tr:hover td {
      filter: brightness(95%);
    }
  `;
}
