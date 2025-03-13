<svelte:options customElement="docling-item-header" />

<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';

  let {
    item,
  }: {
    item: DocItem;
  } = $props();
</script>

{#if isDoclingDocItem.SectionHeaderItem(item)}
  <h2>{item.text}</h2>
{/if}

<style>
  h2 {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 1.5rem;
    line-height: 2rem;
  }
</style>
