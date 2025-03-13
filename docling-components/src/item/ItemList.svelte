<svelte:options customElement="docling-item-list" />

<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';

  let {
    item
  }: {
    item: DocItem;
  } = $props();
</script>

{#if isDoclingDocItem.ListItem(item)}
  <div>
    <span>{item.text}</span>
  </div>
{/if}

<style>
  div {
    display: flex;
    gap: 0.5rem;
  }
</style>
