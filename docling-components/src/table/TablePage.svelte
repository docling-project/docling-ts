<script lang="ts">
  import * as dl from '@docling/docling-core';
  import { CommonPageProps } from '../props';
  import Item from './TableRow.svelte';

  let {
    columns = 'parsed,image',
    items = [],
    pagenumbers = false,
    page,
    itemPart,
    itemStyle,
    onclick,
  }: {
    columns?: string;
    items?: dl.DocItem[];
    page: dl.PageItem;
  } & CommonPageProps = $props();

  const id = $derived(`pages/${page.page_no}`);
  const cols = $derived(columns.split(',').map(c => c.trim()));
</script>

<tbody {id} part="page">
  {#if pagenumbers}
    <tr>
      <td
        part="page-number-top"
        class="page-number"
        title="Page {page.page_no}"
        colspan={cols.length}
      >
        {page.page_no}
      </td>
    </tr>
  {/if}

  {#each items as item}
    <Item {columns} {page} {item} {itemPart} {itemStyle} {onclick} />
  {/each}

  {#if pagenumbers}
    <tr>
      <td
        part="page-number-bottom"
        class="page-number"
        title="Page {page.page_no}"
        colspan={cols.length}
      >
        {page.page_no}
      </td>
    </tr>
  {/if}
</tbody>

<style>
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
</style>
