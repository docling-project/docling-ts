import { DocItem, PageItem } from '@docling/docling-core';
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Task } from '@lit/task';
import { loadItems } from '../util';
import ImgPage from './ImgPage';

@customElement('docling-img')
export class ImgPages extends LitElement {
  @property()
  alt?: string;

  @property()
  backdrop?: string;

  @property()
  items?: string | DocItem[];

  @property()
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
  onclickitem?: (ev: MouseEvent, page: PageItem, item?: DocItem) => void;

  render() {
    return this._fetchTask.render({
      pending: () => html`<p>...</p>`,
      complete: paged => html`
        <div part="paged">
            ${paged.filter(p => !this.trim || p.items.length > 0).map(p => ImgPage({ page: page.page, }))}
        </div>
      `,
    });
  }

  private _fetchTask = new Task(this, {
    task: async ([src, items]) => loadItems(src, { items }),
    args: () => [this.src, this.items],
  });

  static styles = css`
    div {
      width: fit-content;
      max-width: 100%;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;

      color: black;
    }
  `;
}
