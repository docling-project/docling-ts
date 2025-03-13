<script lang="ts">
  import { DocItem, isDoclingDocItem } from '@docling/docling-core';

  let {
    host,
    item,
    style
  }: {
    host: HTMLElement;
    item: DocItem;
    style: string;
  } = $props();


  const views = $derived(Array.from(host.querySelectorAll('docling-view[type=tooltip]') ?? []));

</script>


<div style={style}>

</div>

