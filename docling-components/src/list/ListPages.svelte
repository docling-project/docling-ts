<svelte:options customElement="docling-list" />

<script lang="ts">
  import { DocItem } from '@docling/docling-core';
  import { pagedItems } from '../util';
  import Page from './ListPage.svelte';

  let {
    src = '',
    items,
  }: {
    src?: string;
    items?: string | DocItem[];
  } = $props();

  const docPagedFetch = $derived(
    fetch(src)
      .then(d => d.json())
      .then(d => pagedItems(d, { items }))
  );
</script>

{#await docPagedFetch}
  <p>...</p>
{:then paged}
  <div part="pages">
    {#each paged as page}
      <!-- Trim empty pages. -->
      {#if page.items.length > 0}
        <Page page={page.page} items={page.items} />
      {/if}
    {/each}
  </div>
{:catch}
  <p>Document load error</p>
{/await}

<style>
  div {
    width: fit-content;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }
</style>
