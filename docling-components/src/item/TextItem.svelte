<script lang="ts">
  import { TextItem } from '@docling/docling-core';

  let {
    item,
  }: {
    item: TextItem;
  } = $props();
</script>

<p>{item.text}</p>

<style>
  p {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 1rem;
    line-height: 1.25rem;
  }
</style>
