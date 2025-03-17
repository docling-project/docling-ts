import { DocItem } from '@docling/docling-core';
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

export abstract class DoclingItemElement extends LitElement {
  @property()
  item?: DocItem;

  static canDraw(item: DocItem): boolean {
    return false;
  }
}
