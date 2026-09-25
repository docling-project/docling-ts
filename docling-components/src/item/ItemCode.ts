import {
  CodeItem,
  isDoclingDocItem,
  PageItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { css, html, nothing, TemplateResult } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElement } from '.';

@customDoclingItemElement('docling-item-code')
export class ItemCode extends DoclingItemElement<CodeItem> {
  renderItem(
    item: CodeItem,
    _page: PageItem,
    _prov?: ProvenanceItem
  ): TemplateResult {
    return html`
      <div class="code-block">
        ${
          item.code_language
            ? html`<span class="lang">${item.code_language}</span>`
            : nothing
        }
        <pre><code>${item.text}</code></pre>
      </div>
    `;
  }

  canDrawItem(item: object): item is CodeItem {
    return isDoclingDocItem.CodeItem(item);
  }

  static styles = css`
    .code-block {
      position: relative;
      margin: 0;
      background: #f4f4f4;
      border-left: 3px solid #bbb;
      border-radius: 2px;
      overflow: auto;
    }

    .lang {
      position: absolute;
      top: 0.15rem;
      right: 0.4rem;
      font-size: 0.65rem;
      color: #888;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    pre {
      margin: 0;
      padding: 0.4rem 0.5rem;
      font-size: 0.75rem;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: monospace;
    }

    code {
      font-family: inherit;
    }
  `;
}
