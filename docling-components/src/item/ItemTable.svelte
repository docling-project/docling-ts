<svelte:options customElement="docling-item-table" />

<script lang="ts">
  import { DocItem, isDoclingDocItem, TableCell } from '@docling/docling-core';

  let {
    item,
  }: {
    item: DocItem;
  } = $props();

  const isCovered = $derived(
    (function () {
      const coveredCells = new Set<string>();

      return function (cell: TableCell) {
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
      };
    })()
  );
</script>

{#if isDoclingDocItem.TableItem(item)}
  <div class="container">
    <table>
      <tbody>
        {#each item.data.grid as row}
          <tr>
            {#each row as cell}
              {#if !isCovered(cell)}
                <!-- Ignore cell that has already been covered by a previous multi-span cell. -->

                {@const id =
                  `${item.self_ref}/${cell.start_col_offset_idx}/${cell.start_row_offset_idx}`.slice(
                    1
                  )}

                <td
                  {id}
                  class={cell.column_header || cell.row_header ? 'header' : ''}
                  colSpan={cell.col_span}
                  rowSpan={cell.row_span}
                >
                  {cell.text}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
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
</style>
