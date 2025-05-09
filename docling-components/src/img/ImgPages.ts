import { DocItem, PageItem } from '@docling/docling-core';
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Task } from '@lit/task';
import { loadItems } from '../util';
import { ItemOverlay, ItemTooltip } from '../item/ItemView';
import { ImgTrace } from './ImgTrace';

@customElement('docling-img')
export class ImgPages extends LitElement {
  @property()
  alt?: string;

  @property()
  backdrop?: string;

  @property()
  items?: string | DocItem[];

  @property({ type: Boolean })
  pagenumbers?: boolean;

  @property()
  src: string = '';

  @property()
  trim: 'pages' = 'pages';

  @property()
  itemPart?: (page: PageItem, item: DocItem) => string;

  @property()
  itemStyle?: (page: PageItem, item: DocItem) => string;

  @property()
  onClickItem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  private fetchTask = new Task(this, {
    task: async ([src, items]) => loadItems(src, { items }),
    args: () => [this.src, this.items],
  });

  render() {
    const children = Array.from(this.childNodes);

    return this.fetchTask.render({
      pending: () => html`<p>...</p>`,
      complete: paged => html`
        ${paged
          .filter(p => !this.trim || p.items.length > 0)
          .map(
            ({ page, items }) =>
              html`<docling-img-page
                part="page"
                .page=${page}
                .items=${items}
                .pagenumbers=${this.pagenumbers !== undefined}
                .itemPart=${this.itemPart}
                .itemStyle=${this.itemStyle}
                .onClickItem=${this.onClickItem}
                .backdrop=${this.backdrop !== undefined}
                .overlay=${children.find(c => c instanceof ItemOverlay)}
                .tooltip=${children.find(c => c instanceof ItemTooltip)}
                .trace=${children.find(c => c instanceof ImgTrace)}
              />`
          )}
      `,
    });
  }

  static styles = css`
    :host {
      width: fit-content;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;

      color: black;
    }
  `;
}
