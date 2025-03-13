<svelte:options customElement="docling-item-text" />

<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';

  let {
    item,
  }: {
    item: DocItem;
  } = $props();
</script>

{#if isDoclingDocItem.TextItem(item)}
  <p>
    {item.text}
  </p>
{/if}

<style>
  p {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 1rem;
    line-height: 1.25rem;
  }
</style>
