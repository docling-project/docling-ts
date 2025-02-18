<script lang="ts">
  import { PageItem, DocItem } from '@docling/docling-core';
  import { CommonPageProps } from '../props';
  import CroppedItem from '../item/CroppedItem.svelte';
  import ParsedItem from '../item/ParsedItem.svelte';

  let {
    columns = 'parsed,image',
    item,
    page,
    itemPart,
    itemStyle,
    onclick,
  }: {
    columns?: string;
    item: DocItem;
    page: PageItem;
  } & CommonPageProps = $props();

  const cols = $derived(columns.split(',').map(c => c.trim()));

  const handleClick = $derived(
    onclick ? (e: MouseEvent) => onclick(e, page, item) : undefined
  );
</script>

<tr
  part={'item' + (itemPart ? ' ' + itemPart(page, item) : '')}
  style={itemStyle?.(page, item)}
>
  {#each cols as col}
    <td onclick={handleClick}>
      {#if col === 'parsed'}
        <ParsedItem {item} />
      {:else if col === 'image'}
        <!-- Show figure as part of parsed column when it is the only one. -->
        <CroppedItem {page} {item} />
      {/if}
    </td>
  {/each}
</tr>

<style>
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
</style>
