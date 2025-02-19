<script lang="ts">
  import { ListItem } from '@docling/docling-core';

  let {
    item,
  }: {
    item: ListItem;
  } = $props();
</script>

<div>
  <span>{item.text}</span>
</div>

<style>
  div {
    display: flex;
    gap: 0.5rem;
  }
</style>
