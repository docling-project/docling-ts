<svelte:options customElement="docling-img-page" />

<script lang="ts">
  import * as dl from '@docling/docling-core';
  import { CommonPageProps } from '../props';
  import ParsedItem from '../item/ParsedItem.svelte';
  import { isDisplayable, normalBbox } from '../item';

  let {
    page,
    items = [],
    pagenumbers,
    backdrop,
    tooltip = '',
    itemPart,
    itemStyle,
    onclick,
  }: {
    page: dl.PageItem;
    items?: dl.DocItem[];
    backdrop?: boolean;
    tooltip?: string;
  } & CommonPageProps = $props();

  const tooltipSupport = new Set(['parsed']);
  const tooltipTypes = tooltip
    .split(',')
    .map(s => s.trim())
    .filter(s => tooltipSupport.has(s));

  // In case of a defined tooltip.
  let hovered:
    | { item: dl.DocItem; bounds: DOMRect; quadrant: number }
    | undefined = $state();

  const handleClick = $derived(
    onclick
      ? (e: MouseEvent, item?: dl.DocItem) => onclick(e, page, item)
      : undefined
  );
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if page.image}
  {@const { size } = page}
  {@const { width = 1, height = 1 } = size}

  <div part="page" class="page" onclick={e => handleClick?.(e)} role="tab">
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
          {@const { l, r, t, b } = normalBbox(prov.bbox, page)}

          <rect
            part={'item' + (itemPart ? ' ' + itemPart(page, item) : '')}
            style={itemStyle?.(page, item)}
            x={l}
            y={t}
            width={r - l}
            height={b - t}
            vector-effect="non-scaling-stroke"
            onclick={e => {
              e.stopPropagation();
              handleClick?.(e, item);
            }}
            onmouseenter={e => {
              const bounds = e.currentTarget.getBoundingClientRect();

              // Sizes of surrounding areas: Top, right, bottom, left.
              const areas = [
                bounds.top * window.innerWidth,
                (window.innerWidth - bounds.right) * window.innerHeight,
                (window.innerHeight - bounds.bottom) * window.innerWidth,
                bounds.left * window.innerHeight,
              ];
              const maxArea = Math.max(...areas);
              const quadrant = areas.findIndex(a => a === maxArea);

              hovered = {
                item,
                bounds,
                quadrant,
              };
            }}
            onmouseleave={_ => (hovered = undefined)}
          />
        {/if}
      {/each}
    </svg>

    {#if pagenumbers}
      <header
        part="page-number-top"
        class="page-number-top"
        title="Page {page.page_no}"
      >
        {page.page_no}
      </header>

      <header
        part="page-number-bottom"
        class="page-number-bottom"
        title="Page {page.page_no}"
      >
        {page.page_no}
      </header>
    {/if}

    <!-- Tooltip. -->
    {#if tooltipTypes.length > 0 && hovered && isDisplayable(hovered.item)}
      <div
        part="tooltip"
        class="tooltip"
        style="
          {hovered.quadrant === 1
          ? `left: ${hovered.bounds.right}px`
          : hovered.quadrant === 3
            ? `right: ${document.body.clientWidth - hovered.bounds.left}px`
            : `left: calc(${hovered.bounds.left}px - 2rem)`};
          {hovered.quadrant === 0
          ? `bottom: ${document.body.clientHeight - hovered.bounds.top}px`
          : hovered.quadrant === 2
            ? `top: ${hovered.bounds.bottom}px`
            : `top: calc(${hovered.bounds.top}px - 2rem)`};
        "
      >
        {#each tooltipTypes as type}
          {#if type === 'parsed'}
            <ParsedItem item={hovered.item} />
          {/if}
        {/each}
      </div>
    {/if}
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

  .page-number-top,
  .page-number-bottom {
    position: absolute;
    width: fit-content;
    padding: 0 0.25rem;

    font-size: 0.75rem;
    line-height: 1rem;
    color: rgb(120, 120, 120);
    mix-blend-mode: difference;
  }

  .page-number-top {
    top: 0;
  }

  .page-number-bottom {
    bottom: 0;
  }

  rect {
    fill: blue;
    fill-opacity: 0.0001; /* To activate hover. */
    stroke: grey;
    stroke-width: 1px;
    stroke-dasharray: 1;
    cursor: pointer;
  }

  rect:hover {
    fill-opacity: 0.1;
    stroke: blue;
  }

  rect:target {
    stroke: blue;
    stroke-width: 3px;
    stroke-dasharray: none;
  }

  .tooltip {
    position: fixed;
    z-index: 100;
    padding: 1rem;
    margin: 1rem;

    background: white;
    border: 1px solid rgb(230, 230, 230);
    box-shadow: 0 0.5rem 1rem 0 rgba(0, 0, 0, 0.2);
  }
</style>
