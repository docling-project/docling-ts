<svelte:options customElement="docling-img" />

<script lang="ts">
  import { DocItem } from '@docling/docling-core';
  import { pagedItems } from '../util';
  import Page from './ImgPage.svelte';

  let {
    src = '',
    items,
    trim,
    backdrop = false,
  }: {
    src?: string;
    items?: string | DocItem[];
    trim?: 'pages';
    backdrop?: boolean;
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
      {#if !trim || page.items.length > 0}
        <Page
          page={page.page}
          items={page.items}
          backdrop={backdrop && page.trimmed}
        />
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
    align-items: center;
    gap: 2px;
  }
</style>
