<svelte:options customElement="docling-img-page" />

<script lang="ts">
  import * as dl from '@docling/docling-core';

  let {
    page,
    items = [],
    backdrop = false,
  }: {
    page: dl.PageItem;
    items?: dl.DocItem[];
    backdrop?: boolean;
  } = $props();

  const { page_no, size } = page;
  const { width = 1, height = 1 } = size;
  const id = `pages/${page_no}`;
</script>

{#if page.image}
  <div {id} part="page" class="page">
    <svg width={page.image.size.width} viewBox="0 0 {width} {height}">
      <!-- Suppressed backdrop image. -->
      {#if backdrop}
        <image class="backdrop" href={page.image.uri} {width} {height} />

        <clipPath id="clip-page-{page.page_no}">
          {#each items as item}
            {@const prov = item.prov?.find(p => p.page_no === page.page_no)}

            {#if prov}
              {@const { l, r, t, b } = prov.bbox}

              <rect x={l} y={height - t} width={r - l} height={t - b} />
            {/if}
          {/each}
        </clipPath>
      {/if}

      <!-- Foreground image. -->
      <image
        id="image"
        href={page.image.uri}
        clip-path="url(#clip-page-{page.page_no})"
        {width}
        {height}
      />

      {#each items as item}
        {@const prov = item.prov?.find(p => p.page_no === page.page_no)}

        {#if prov}
          {@const { l, r, t, b } = prov.bbox}

          <rect
            x={l}
            y={height - t}
            width={r - l}
            height={t - b}
            vector-effect="non-scaling-stroke"
          />
        {/if}
      {/each}
    </svg>

    <header part="page-number" title="Page {page.page_no}">
      {page.page_no}
    </header>
  </div>
{:else}
  Invalid page image.
{/if}

<style>
  svg {
    max-width: 100%;
  }

  .page {
    position: relative;
    width: fit-content;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .backdrop {
    opacity: 0.3;
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

  rect {
    fill-opacity: 0.0001; /* To activate hover. */
    stroke: grey;
    stroke-width: 1px;
    stroke-dasharray: 1;
    cursor: pointer;
  }

  rect:hover {
    fill-opacity: 0.1;
    stroke: black;
  }

  rect:target {
    stroke: blue;
    stroke-width: 3px;
    stroke-dasharray: none;
  }
</style>
