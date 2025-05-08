import { DocItem, PageItem } from '@docling/docling-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { TableColumn } from './TableColumn';

@customElement('docling-table-page')
export class TablePage extends LitElement {
  @property({ type: Object })
  page?: PageItem;

  @property({ type: Array })
  items?: DocItem[];

  @property({ type: Array })
  columns: TableColumn[] = [];

  @property({ type: Boolean })
  pagenumbers?: boolean;

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  render() {
    return html`
      ${this.pagenumbers
        ? html`
            <tr>
              <td
                part="page-number-top"
                class="page-number"
                title="Page ${this.page?.page_no}"
                colspan=${this.columns?.length ?? 1}
              >
                ${this.page?.page_no}
              </td>
            </tr>
          `
        : nothing}
      ${this.items?.map(
        item =>
          html`<tr
            part=${'item' +
            (this.itemPart ? ' ' + this.itemPart(this.page!, item) : '')}
            style=${ifDefined(this.itemStyle?.(this.page!, item))}
          >
            ${this.columns.map(col => {
              const copy = col.cloneNode(true) as TableColumn;
              copy.item = item;
              copy.page = this.page;

              return html`
                <td
                  @onclick=${(e: MouseEvent) =>
                    this.onClickItem?.(e, this.page!, item)}
                >
                  ${copy}
                </td>
              `;
            })}
          </tr>`
      )}
      ${this.pagenumbers
        ? html`<tr>
            <td
              part="page-number-bottom"
              class="page-number"
              title="Page ${this.page?.page_no}"
              colspan=${this.columns?.length ?? 1}
            >
              ${this.page?.page_no}
            </td>
          </tr>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      display: table-row-group;
    }

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
