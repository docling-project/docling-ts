<script lang="ts">
  import * as dl from '@docling/docling-core';
  import Item from './ListItem.svelte';

  let {
    page,
    items = [],
  }: {
    page: dl.PageItem;
    items?: dl.DocItem[];
  } = $props();

  const id = $derived(`pages/${page.page_no}`);
</script>

<div {id} part="part" class="page">
  {#each items as item}
    <Item {page} {item} />
  {/each}

  <header part="page-number" title="Page {page.page_no}">{page.page_no}</header>
</div>

<style>
  .page {
    position: relative;
    max-width: 100%;

    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  header {
    position: absolute;
    top: 0;
    width: fit-content;
    padding: 0 0.25rem;

    font-size: 0.75rem;
    line-height: 1rem;
    background-color: white;
    color: rgb(120, 120, 120);
  }
</style>
