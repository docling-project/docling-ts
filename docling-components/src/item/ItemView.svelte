<svelte:options customElement="docling-view" />

<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';
  import ItemList from './ItemList.svelte';
  import ItemSectionHeader from './ItemSectionHeader.svelte';
  import ItemTable from './ItemTable.svelte';
  import ItemText from './ItemText.svelte';

  let {
    item,
    supportsItem = supports
  }: {
    item?: DocItem;
    supportsItem?: (item: DocItem) => boolean;
  } = $props();

  function supports(item: DocItem) {
    return !isDoclingDocItem.PictureItem(item);
  }
</script>

{#if item}
  <ItemList {item} />
  <ItemSectionHeader {item} />
  <ItemTable {item} />
  <ItemText {item} />
{/if}
