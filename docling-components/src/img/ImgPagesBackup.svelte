<!-- <svelte:options customElement="docling-img" /> -->

<script lang="ts">
  import { DocItem } from '@docling/docling-core';
  import { CommonComponentProps } from '../props';
  import { loadItems } from '../util';
  import Page from './ImgPage.svelte';

  let {
    src = '',
    items,
    pagenumbers,
    trim,
    backdrop,
    alt,
    itemPart,
    itemStyle,
    onclick,
  }: {
    trim?: 'pages';
    backdrop?: string;
  } & CommonComponentProps = $props();

  const docPagedFetch = $derived(loadItems(src, { items }));
</script>

{#snippet tooltip(style: string, item: DocItem)}
  <ImgTooltip host={$host()} item={item} />
{/snippet}

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
          backdrop={backdrop !== undefined}
          tooltip={tooltip}
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

<!-- function tooltipSnippet(host?: HTMLElement) {
  const views = Array.from($host()?.querySelectorAll('docling-view[type=tooltip]') ?? []);

  if (views.some((v: any) => v.supportsItem?.(item()))) {
    return createRawSnippet<[DocItem]>(item => {
      return {
        setup(element: Element) {
          $effect(() => {
            const copies: Node[] = [];

            views.forEach(el => {
              if ((el as any).supportsItem(item())) {
                const copy = el.cloneNode(true) as Element;
                (copy as any).item = item();

                if (copy.shadowRoot?.hasChildNodes()) {
                  copies.push(copy);
                }
              }
            });

            element.replaceChildren(...copies);

            return () => {};
          });
        },
        render() {
          return `<div></div>`;
        },
      };
    });
  } else {
    return undefined;
  }
} -->
