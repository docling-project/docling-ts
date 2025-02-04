<script lang="ts">
  import { PageItem, DocItem, isDoclingDocItem } from '@docling/docling-core';
  import CroppedItem from '../item/CroppedItem.svelte';
  import TableItem from '../item/TableItem.svelte';

  let {
    page,
    item,
  }: {
    page: PageItem;
    item: DocItem;
  } = $props();

  const id = $derived(item.self_ref.slice(1));
  const baseWidth = $derived.by(() => {
    const pageScale = (page.image?.size.width ?? 1) / (page.size.width ?? 1);
    const provs = item.prov ?? [];

    return provs.length === 0
      ? undefined
      : pageScale *
          (provs.map(p => p.bbox.r - p.bbox.l).reduce((aw, cw) => aw + cw) /
            provs.length);
  });
  // Certain item types do not have a parsed form to show.
  const isParsed = $derived(!isDoclingDocItem.PictureItem(item));
</script>

<div {id} part="item" class="item">
  {#if isParsed}
    <div class="parsed">
      <div style:max-width="{baseWidth}px">
        <!-- Disciminate by item type. -->
        {#if isDoclingDocItem.TextItem(item)}
          <p>{item.text}</p>
        {:else if isDoclingDocItem.SectionHeaderItem(item)}
          <h2>{item.text}</h2>
        {:else if isDoclingDocItem.ListItem(item)}
          <div style:display="flex" style:gap="0.5rem">
            <span>{item.text}</span>
          </div>
        {:else if isDoclingDocItem.TableItem(item)}
          <TableItem {item} />
        {:else}
          <div>{item.self_ref}</div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="cropped {isParsed ? '' : 'centered'}">
    <CroppedItem {page} {item} />
  </div>
</div>

<style>
  .item {
    position: relative;
    padding: 1rem;

    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 2rem;
    justify-content: space-around;

    color: black;
    text-decoration: none;
    background-color: white;
    cursor: pointer;
  }

  @media (max-width: 40rem) {
    .item {
      flex-direction: column;
      justify-content: flex-start;
    }
  }

  .item:hover {
    filter: brightness(95%);
  }

  .item:target {
    outline: 3px solid blue;
  }

  .parsed,
  .cropped {
    flex: 1;
  }

  .centered {
    margin: 0 auto;
  }

  p,
  h2 {
    margin: 0;
  }

  p {
    font-size: 1rem;
    line-height: 1.25rem;
    word-wrap: break-word;
  }

  h2 {
    font-size: 1.5rem;
    line-height: 2rem;
  }
</style>
