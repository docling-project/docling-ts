import { DocItem, PageItem } from '@docling/docling-core';
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Task } from '@lit/task';
import { loadItems } from '../util';
import { TableColumn } from './TableColumn';
import { ItemProvenance } from '../item/ItemProvenance';

@customElement('docling-table')
export class TablePages extends LitElement {
  @property()
  alt?: string;

  @property()
  items?: string | DocItem[];

  @property({ type: Boolean })
  pagenumbers?: boolean;

  @property()
  src: string = '';

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  private fetchTask = new Task(this, {
    task: async ([src, items]) => loadItems(src, { items }),
    args: () => [this.src, this.items],
  });

  render() {
    // TODO: Try instanceof.
    const itemChildren = Array.from(this.childNodes).filter(item =>
      item.nodeName.toLowerCase().startsWith('docling-column')
    );

    // Fallback to default, applicable children.
    const columns =
      itemChildren.length > 0
        ? (itemChildren as TableColumn[])
        : [new TableColumn(), new TableColumn()];

    if (itemChildren.length === 0) {
      columns[1].appendChild(new ItemProvenance());
    }

    return this.fetchTask.render({
      pending: () => html`<p>...</p>`,
      complete: paged => html`
        <table part="pages">
          ${paged
            .filter(p => p.items.length > 0)
            .map(
              ({ page, items }) =>
                html`<docling-table-page
                  .page=${page}
                  .items=${items}
                  .columns=${columns}
                  .pagenumbers=${this.pagenumbers !== undefined}
                  .itemPart=${this.itemPart}
                  .itemStyle=${this.itemStyle}
                  .onClickItem=${this.onClickItem}
                />`
            )}
        </table>
      `,
    });
  }

  static styles = css`
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background-color: white;
    }
  `;
}
