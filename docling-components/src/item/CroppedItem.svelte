<script lang="ts">
  import { PageItem, DocItem } from '@docling/docling-core';
  import { normalBbox } from '.';

  let {
    page,
    item,
    id,
  }: {
    page: PageItem;
    item: DocItem;
    id?: string;
  } = $props();

  const prov = $derived(item.prov?.find(p => p.page_no === page.page_no));
</script>

{#if page.image && prov}
  {@const { width = 1, height = 1 } = page.size}
  {@const { l, r, t, b } = normalBbox(prov.bbox, page)}

  <svg
    {id}
    width={(r - l) * ((page.image.size.width ?? 1) / width)}
    viewBox="{l} {t} {r - l} {b - t}"
  >
    <image href={page.image.uri} {width} {height} />
  </svg>
{:else}
  Invalid provenance.
{/if}

<style>
  svg {
    max-width: 100%;
  }
</style>
