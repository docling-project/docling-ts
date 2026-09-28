import {
  isDoclingDocItem,
  ListItem,
  PageItem,
  ProvenanceItem,
  SectionHeaderItem,
  TextItem,
  TitleItem,
} from '@docling/docling-core';
import { css, html, nothing, TemplateResult } from 'lit';
import { DoclingItemElement } from './ItemElement';
import { customDoclingItemElement, normalBbox } from '.';

@customDoclingItemElement('docling-item-text')
export class ItemText extends DoclingItemElement<TextItem> {
  renderItem(
    item: TextItem,
    page: PageItem,
    prov?: ProvenanceItem
  ): TemplateResult {
    const fmt = item.formatting;
    const fmtStyle = [
      fmt?.bold ? 'font-weight:bold' : '',
      fmt?.italic ? 'font-style:italic' : '',
      fmt?.underline ? 'text-decoration:underline' : '',
      fmt?.strikethrough ? 'text-decoration:line-through' : '',
    ]
      .filter(Boolean)
      .join(';');

    // Derive appropriate font size for drawing in a specific provenance.
    if (prov) {
      const { l, r, t, b } = normalBbox(prov.bbox, page);
      const sizeApprox = Math.sqrt(((r - l) * (b - t)) / item.text.length);
      const size = Math.min(Math.floor(1.25 * sizeApprox), (b - t) / 1.25);

      const [tl, tu] = (prov.charspan as [number, number]) ?? [
        0,
        item.text.length,
      ];
      const text = item.text.substring(tl, tu);

      return html`<p
        class=${this.textClass(item)}
        style="font-size:${size}px;line-height:${1.25 * size}px;${fmtStyle}"
      >
        ${this.listPrefix(item)}${text}
      </p>`;
    } else {
      return html`<p class=${this.textClass(item)} style=${fmtStyle || nothing}>
        ${this.listPrefix(item)}${item.text}
      </p>`;
    }
  }

  private textClass(item: TextItem): string {
    if (isDoclingDocItem.TitleItem(item)) return 'title';
    if (isDoclingDocItem.SectionHeaderItem(item)) {
      const lvl = (item as SectionHeaderItem).level ?? 1;
      return `header header-${Math.min(lvl, 6)}`;
    }
    if (isDoclingDocItem.ListItem(item)) return 'list-item';
    return '';
  }

  /** Render bullet or numbered prefix for list items. */
  private listPrefix(item: TextItem) {
    if (!isDoclingDocItem.ListItem(item)) return nothing;
    const li = item as ListItem;
    if (li.marker) return html`<span class="marker">${li.marker}</span>`;
    if (li.enumerated) return html`<span class="marker bullet">•</span>`;
    return html`<span class="marker bullet">–</span>`;
  }

  canDrawItem(item: object): item is TextItem | TitleItem {
    return (
      isDoclingDocItem.TextItem(item) ||
      isDoclingDocItem.TitleItem(item) ||
      isDoclingDocItem.SectionHeaderItem(item) ||
      isDoclingDocItem.ListItem(item) ||
      isDoclingDocItem.FormulaItem(item)
    );
  }

  static styles = css`
    p {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 1rem;
      line-height: 1.25rem;
    }

    .title {
      font-size: 1.1rem;
      font-weight: bold;
    }

    /* header-1 is largest (document section), header-6 is smallest. */
    .header {
      font-weight: bold;
    }
    .header-1 {
      font-size: 1rem;
    }
    .header-2 {
      font-size: 0.95rem;
    }
    .header-3 {
      font-size: 0.9rem;
    }
    .header-4,
    .header-5,
    .header-6 {
      font-size: 0.85rem;
    }

    .list-item {
      display: flex;
      gap: 0.25rem;
    }

    .marker {
      flex-shrink: 0;
      min-width: 1rem;
    }
  `;
}
