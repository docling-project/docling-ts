<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';
  import TableItem from './TableItem.svelte';

  let {
    item,
  }: {
    item: DocItem;
  } = $props();
</script>

<!-- Discriminate by item type. -->
{#if isDoclingDocItem.TextItem(item)}
  <p>{item.text}</p>
{:else if isDoclingDocItem.SectionHeaderItem(item)}
  <h2>{item.text}</h2>
{:else if isDoclingDocItem.ListItem(item)}
  <div style:display="flex" style:gap="0.5rem">
    <span>{item.text}</span>
  </div>
{:else if isDoclingDocItem.TableItem(item)}
  <TableItem {item} />
{/if}

<style>
  p,
  h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }

  p {
    font-size: 1rem;
    line-height: 1.25rem;
  }

  h2 {
    font-size: 1.5rem;
    line-height: 2rem;
  }
</style>
