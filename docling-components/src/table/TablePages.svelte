<svelte:options customElement="docling-table" />

<script lang="ts">
  import { DocItem } from '@docling/docling-core';
  import { CommonComponentProps } from '../props';
  import { loadItems } from '../util';
  import Page from './TablePage.svelte';

  let {
    columns = 'parsed,image',
    src = '',
    items,
    pagenumbers,
    alt,
    itemPart,
    itemStyle,
    onclick,
  }: {
    columns?: string;
    src?: string;
    items?: string | DocItem[];
    alt?: string;
  } & CommonComponentProps = $props();

  const docPagedFetch = $derived(loadItems(src, { items }));
</script>

{#await docPagedFetch}
  <p>...</p>
{:then paged}
  <table part="pages">
    {#each paged as page}
      <!-- Trim empty pages. -->
      {#if page.items.length > 0}
        <Page
          {columns}
          items={page.items}
          pagenumbers={pagenumbers !== undefined}
          page={page.page}
          {itemPart}
          {itemStyle}
          {onclick}
        />
      {/if}
    {/each}
  </table>
{:catch}
  <img {alt} src="none" />
{/await}

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
</style>
