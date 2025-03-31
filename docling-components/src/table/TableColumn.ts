import { customElement } from 'lit/decorators.js';
import { ItemView } from '../item/ItemView';

@customElement('docling-column')
export class TableColumn extends ItemView {
  type = 'column';
}
