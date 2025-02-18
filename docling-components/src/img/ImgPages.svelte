<svelte:options customElement="docling-img" />

<script lang="ts">
  import { CommonComponentProps } from '../props';
  import { loadItems } from '../util';
  import Page from './ImgPage.svelte';

  let {
    src = '',
    items,
    pagenumbers,
    trim,
    backdrop,
    tooltip,
    alt,
    itemPart,
    itemStyle,
    onclick,
  }: {
    trim?: 'pages';
    backdrop?: string;
    tooltip?: string;
  } & CommonComponentProps = $props();

  const docPagedFetch = $derived(loadItems(src, { items }));
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
          pagenumbers={pagenumbers !== undefined}
          backdrop={backdrop !== undefined && page.trimmed}
          {tooltip}
          {itemPart}
          {itemStyle}
          {onclick}
        />
      {/if}
    {/each}
  </div>
{:catch}
  <img {alt} src="none" />
{/await}

<style>
  div {
    width: fit-content;
    max-width: 100%;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;

    color: black;
  }
</style>
