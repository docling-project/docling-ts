import {
  GraphCell,
  isDoclingDocItem,
  KeyValueItem,
  PageItem,
  ProvenanceItem,
} from '@docling/docling-core';
import { css, html, nothing, TemplateResult } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElement } from '.';

@customDoclingItemElement('docling-item-key-value')
export class ItemKeyValue extends DoclingItemElement<KeyValueItem> {
  renderItem(
    item: KeyValueItem,
    _page: PageItem,
    _prov?: ProvenanceItem
  ): TemplateResult {
    const cells = item.graph?.cells ?? [];

    // Build key→value pairs by matching graph links.
    const links = item.graph?.links ?? [];
    const cellById = new Map<number, GraphCell>(cells.map(c => [c.cell_id, c]));

    // Collect pairs: for each "to_value" link, find the key cell.
    const pairs: { key: string; value: string }[] = [];
    for (const link of links) {
      if (link.label === 'to_value') {
        const keyCell = cellById.get(link.source_cell_id);
        const valCell = cellById.get(link.target_cell_id);
        if (keyCell && valCell) {
          pairs.push({ key: keyCell.text, value: valCell.text });
        }
      }
    }

    // Fallback: if no links, just show key cells alongside value cells
    // in declaration order.
    if (pairs.length === 0) {
      const keys = cells.filter(c => c.label === 'key');
      const values = cells.filter(c => c.label === 'value');
      const len = Math.max(keys.length, values.length);
      for (let i = 0; i < len; i++) {
        pairs.push({ key: keys[i]?.text ?? '', value: values[i]?.text ?? '' });
      }
    }

    if (pairs.length === 0) return html`${nothing}`;

    return html`
      <table class="kv">
        <tbody>
          ${pairs.map(
            ({ key, value }) => html`
              <tr>
                <td class="key">${key}</td>
                <td class="value">${value}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  canDrawItem(item: object): item is KeyValueItem {
    return isDoclingDocItem.KeyValueItem(item);
  }

  static styles = css`
    .kv {
      border-collapse: collapse;
      font-size: 75%;
      line-height: 1.25;
      width: 100%;
    }

    td {
      padding: 0.1rem 0.3rem;
      border: 1px solid rgb(220, 220, 220);
      vertical-align: top;
      word-break: break-word;
    }

    td.key {
      font-weight: bold;
      white-space: nowrap;
      color: #444;
      width: 40%;
    }

    td.value {
      color: #111;
    }
  `;
}
