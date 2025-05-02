import { isDoclingDocItem, TableCell, TableItem } from '@docling/docling-core';
import { css, html } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElement } from '.';

@customDoclingItemElement('docling-item-table')
export class ItemTable extends DoclingItemElement<TableItem> {
  renderItem(item: TableItem) {
    const coveredCells = new Set<string>();

    return html`
      <div class="container">
        <table>
          <tbody>
            ${item.data.grid.map(row => {
              return html`<tr>
                ${row.map(cell => {
                  if (!isCovered(cell)) {
                    return html`<td
                      class=${cell.column_header || cell.row_header
                        ? 'header'
                        : ''}
                      colspan=${cell.col_span ?? 1}
                      rowspan=${cell.row_span ?? 1}
                    >
                      ${cell.text}
                    </td>`;
                  }
                })}
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;

    function isCovered(cell: TableCell) {
      const covered = coveredCells.has(
        [cell.start_col_offset_idx, cell.start_row_offset_idx].join()
      );

      if (!covered) {
        for (
          let x = cell.start_col_offset_idx;
          x < cell.end_col_offset_idx;
          x++
        ) {
          for (
            let y = cell.start_row_offset_idx;
            y < cell.end_row_offset_idx;
            y++
          ) {
            coveredCells.add([x, y].join());
          }
        }
      }

      return covered;
    }
  }

  canDrawItem(item: object): item is TableItem {
    return isDoclingDocItem.TableItem(item);
  }

  static styles = css`
    .container {
      position: relative;
      min-width: 0;
      max-width: 100%;
      min-height: 0;
      overflow: auto;
    }

    table {
      border-collapse: collapse;
    }

    td {
      padding: 0 0.5rem;
      background-color: var(--cds-layer);
      border: 1px solid rgb(220, 220, 220);

      color: black;
      font-size: 0.75rem;
      line-height: 1.5rem;
      text-decoration: none;
      word-break: normal;
      text-align: left;
    }

    td.header {
      font-weight: bold;
    }

    td:hover {
      filter: brightness(95%);
    }

    td:target {
      outline: 3px solid blue;
    }
  `;
}
