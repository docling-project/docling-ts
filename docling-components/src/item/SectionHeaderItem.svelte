<script lang="ts">
  import { SectionHeaderItem } from '@docling/docling-core';

  let {
    item,
  }: {
    item: SectionHeaderItem;
  } = $props();
</script>

<h2>{item.text}</h2>

<style>
  h2 {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 1.5rem;
    line-height: 2rem;
  }
</style>
