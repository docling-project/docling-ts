import { DocItem, isDocling, PageItem } from '@docling/docling-core';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElements } from './registry';
import { customElement } from 'lit/decorators.js';
import { html } from 'lit';

@customElement('docling-view')
export abstract class ItemView extends DoclingItemElement<DocItem> {
  abstract type: string;

  renderItem(item: DocItem, page: PageItem) {
    let shadowNodes: DoclingItemElement[];

    const itemChildren = Array.from(this.childNodes).filter(item =>
      item.nodeName.toLowerCase().startsWith('docling')
    );

    // Fallback to default, applicable children.
    if (itemChildren.length > 0) {
      shadowNodes = itemChildren.map(
        c => c.cloneNode(true) as DoclingItemElement
      );
    } else {
      shadowNodes = customDoclingItemElements
        .filter(el => el.prototype.canDraw(item))
        .map(el => new (el as any)());
    }

    shadowNodes.forEach(node => {
      node.item = item;
      node.page = page;
    });

    return html`${shadowNodes}`;
  }

  canDraw(item: object): item is DocItem {
    const children = Array.from(this.childNodes ?? []).filter(
      c => c instanceof DoclingItemElement
    );

    return (
      isDocling.DocItem(item) &&
      (children.length > 0
        ? children.some((c: any) => c.canDraw(item))
        : customDoclingItemElements.some(el => el.prototype.canDraw(item)))
    );
  }
}

@customElement('docling-tooltip')
export class ItemTooltip extends ItemView {
  type = 'tooltip';
}
