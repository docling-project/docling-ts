<script lang="ts">
  import { DocItem } from '@docling/docling-core';
  import { componentOfItem } from '.';

  let {
    item,
  }: {
    item: DocItem;
  } = $props();

  const Component = $derived(componentOfItem(item));
</script>

<Component {item} />
