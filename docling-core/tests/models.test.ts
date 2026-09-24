import { describe, expect, it } from 'vitest';
import {
  type CodeItem,
  type DoclingDocument,
  type FieldHeadingItem,
  type FieldItem,
  type FieldRegionItem,
  type FieldValueItem,
  type FormItem,
  type FormulaItem,
  type InlineGroup,
  type KeyValueItem,
  type ListGroup,
  type ListItem,
  type NodeItem,
  type OrderedList,
  type PictureBarChartData,
  type PictureClassificationData,
  type PictureDescriptionData,
  type PictureItem,
  type PictureLineChartData,
  type PictureMiscData,
  type PictureMoleculeData,
  type PicturePieChartData,
  type PictureScatterChartData,
  type PictureStackedBarChartData,
  type PictureTabularChartData,
  type SectionHeaderItem,
  type TableItem,
  type TextItem,
  type TitleItem,
  isDocling,
  isDoclingAnnotation,
  isDoclingDocItem,
} from '../src/types';

// ---------------------------------------------------------------------------
// isDocling — NodeItem / GroupItem / DocItem
// ---------------------------------------------------------------------------

describe('isDocling.NodeItem', () => {
  it('accepts any object with self_ref', () => {
    expect(isDocling.NodeItem({ self_ref: '#/body' })).toBe(true);
  });

  it('rejects objects without self_ref', () => {
    expect(isDocling.NodeItem({ label: 'text' })).toBe(false);
    expect(isDocling.NodeItem({})).toBe(false);
  });
});

describe('isDocling.GroupItem', () => {
  it('identifies body by self_ref', () => {
    const body: NodeItem = { self_ref: '#/body' };
    expect(isDocling.GroupItem(body)).toBe(true);
  });

  it('identifies furniture by self_ref', () => {
    const furniture: NodeItem = { self_ref: '#/furniture' };
    expect(isDocling.GroupItem(furniture)).toBe(true);
  });

  it('identifies group by self_ref prefix', () => {
    const group: NodeItem = { self_ref: '#/groups/0' };
    expect(isDocling.GroupItem(group)).toBe(true);
  });

  it('identifies ListGroup, OrderedList, InlineGroup', () => {
    const lg: ListGroup = { self_ref: '#/groups/0', label: 'list' };
    const ol: OrderedList = { self_ref: '#/groups/1', label: 'ordered_list' };
    const ig: InlineGroup = { self_ref: '#/groups/2', label: 'inline' };
    expect(isDocling.ListGroup(lg)).toBe(true);
    expect(isDocling.ListGroup(ol)).toBe(false);
    expect(isDocling.OrderedList(ol)).toBe(true);
    expect(isDocling.InlineGroup(ig)).toBe(true);
  });

  it('rejects non-group nodes', () => {
    expect(isDocling.GroupItem({ self_ref: '#/texts/0' })).toBe(false);
    expect(isDocling.GroupItem({ self_ref: '#/tables/0' })).toBe(false);
    expect(isDocling.GroupItem({ self_ref: '#/pictures/0' })).toBe(false);
  });
});

describe('isDocling.DocItem', () => {
  it('accepts non-group node items', () => {
    expect(isDocling.DocItem({ self_ref: '#/texts/0', label: 'text' })).toBe(
      true
    );
    expect(isDocling.DocItem({ self_ref: '#/tables/0', label: 'table' })).toBe(
      true
    );
  });

  it('rejects group items', () => {
    expect(isDocling.DocItem({ self_ref: '#/body' })).toBe(false);
    expect(isDocling.DocItem({ self_ref: '#/groups/2' })).toBe(false);
  });

  it('rejects non-NodeItems', () => {
    expect(isDocling.DocItem({ label: 'text' })).toBe(false);
  });
});

describe('isDocling.Document', () => {
  it('identifies a DoclingDocument by schema_name', () => {
    const doc: DoclingDocument = {
      schema_name: 'DoclingDocument',
      version: '1.0.0',
      name: 'Test',
    };
    expect(isDocling.Document(doc)).toBe(true);
  });

  it('rejects objects without schema_name', () => {
    expect(isDocling.Document({ name: 'Test' })).toBe(false);
    expect(isDocling.Document({ schema_name: 'Other' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDoclingDocItem — label-based type narrowing
// ---------------------------------------------------------------------------

describe('isDoclingDocItem', () => {
  const cases: Array<[string, NodeItem, boolean]> = [
    ['CodeItem', { self_ref: '#/texts/0', label: 'code' } as CodeItem, true],
    [
      'CodeItem rejects non-code',
      { self_ref: '#/texts/0', label: 'text' } as TextItem,
      false,
    ],

    ['TitleItem', { self_ref: '#/texts/0', label: 'title' } as TitleItem, true],
    [
      'FormulaItem',
      { self_ref: '#/texts/0', label: 'formula' } as FormulaItem,
      true,
    ],
    [
      'KeyValueItem',
      {
        self_ref: '#/key_value_items/0',
        label: 'key_value_region',
      } as KeyValueItem,
      true,
    ],
    [
      'FormItem',
      { self_ref: '#/form_items/0', label: 'form' } as FormItem,
      true,
    ],
    [
      'ListItem',
      { self_ref: '#/texts/0', label: 'list_item' } as ListItem,
      true,
    ],
    [
      'SectionHeaderItem',
      { self_ref: '#/texts/0', label: 'section_header' } as SectionHeaderItem,
      true,
    ],
    [
      'TableItem - table',
      { self_ref: '#/tables/0', label: 'table' } as TableItem,
      true,
    ],
    [
      'TableItem - document_index',
      { self_ref: '#/tables/0', label: 'document_index' } as TableItem,
      true,
    ],
    [
      'PictureItem - picture',
      { self_ref: '#/pictures/0', label: 'picture' } as PictureItem,
      true,
    ],
    [
      'PictureItem - chart',
      { self_ref: '#/pictures/0', label: 'chart' } as PictureItem,
      true,
    ],

    [
      'TextItem - text',
      { self_ref: '#/texts/0', label: 'text' } as TextItem,
      true,
    ],
    [
      'TextItem - caption',
      { self_ref: '#/texts/0', label: 'caption' } as TextItem,
      true,
    ],
    [
      'TextItem - footnote',
      { self_ref: '#/texts/0', label: 'footnote' } as TextItem,
      true,
    ],
    [
      'TextItem - paragraph',
      { self_ref: '#/texts/0', label: 'paragraph' } as TextItem,
      true,
    ],
    [
      'TextItem - page_header',
      { self_ref: '#/texts/0', label: 'page_header' } as TextItem,
      true,
    ],
    [
      'TextItem - page_footer',
      { self_ref: '#/texts/0', label: 'page_footer' } as TextItem,
      true,
    ],
    [
      'TextItem - checkbox_selected',
      { self_ref: '#/texts/0', label: 'checkbox_selected' } as TextItem,
      true,
    ],
    [
      'TextItem - checkbox_unselected',
      { self_ref: '#/texts/0', label: 'checkbox_unselected' } as TextItem,
      true,
    ],
    [
      'TextItem - reference',
      { self_ref: '#/texts/0', label: 'reference' } as TextItem,
      true,
    ],
    [
      'TextItem - empty_value',
      { self_ref: '#/texts/0', label: 'empty_value' } as TextItem,
      true,
    ],
    [
      'TextItem - field_key',
      { self_ref: '#/texts/0', label: 'field_key' } as TextItem,
      true,
    ],
    [
      'TextItem - field_hint',
      { self_ref: '#/texts/0', label: 'field_hint' } as TextItem,
      true,
    ],
    [
      'TextItem - marker',
      { self_ref: '#/texts/0', label: 'marker' } as TextItem,
      true,
    ],
    [
      'TextItem - handwritten_text',
      { self_ref: '#/texts/0', label: 'handwritten_text' } as TextItem,
      true,
    ],

    [
      'FieldRegionItem',
      {
        self_ref: '#/field_regions/0',
        label: 'field_region',
      } as FieldRegionItem,
      true,
    ],
    [
      'FieldHeadingItem',
      { self_ref: '#/texts/0', label: 'field_heading' } as FieldHeadingItem,
      true,
    ],
    [
      'FieldItem',
      { self_ref: '#/field_items/0', label: 'field_item' } as FieldItem,
      true,
    ],
    [
      'FieldValueItem',
      { self_ref: '#/texts/0', label: 'field_value' } as FieldValueItem,
      true,
    ],
  ];

  it.each(cases)('%s', (_name, item, expected) => {
    const check = _name.split(' ')[0] as keyof typeof isDoclingDocItem;
    expect(isDoclingDocItem[check](item)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// isDoclingAnnotation — picture annotation kind discrimination
// ---------------------------------------------------------------------------

describe('isDoclingAnnotation', () => {
  const classification: PictureClassificationData = {
    kind: 'classification',
    provenance: 'model-v1',
    predicted_classes: [{ class_name: 'bar_chart', confidence: 0.9 }],
  };
  const description: PictureDescriptionData = {
    kind: 'description',
    text: 'A chart showing growth.',
    provenance: 'model-v1',
  };
  const misc: PictureMiscData = {
    kind: 'misc',
    content: { raw: 'data' },
  };
  const molecule: PictureMoleculeData = {
    kind: 'molecule_data',
    smi: 'CCO',
    confidence: 0.85,
    class_name: 'ethanol',
    segmentation: [[1, 2]],
    provenance: 'model-v1',
  };
  const lineChart: PictureLineChartData = {
    kind: 'line_chart_data',
    title: 'Sales',
    x_axis_label: 'Year',
    y_axis_label: 'Revenue',
    lines: [
      {
        label: 'Product A',
        values: [
          [2020, 100],
          [2021, 120],
        ],
      },
    ],
  };
  const barChart: PictureBarChartData = {
    kind: 'bar_chart_data',
    title: 'Bars',
    x_axis_label: 'X',
    y_axis_label: 'Y',
    bars: [{ label: 'Q1', values: 42 }],
  };
  const stackedBar: PictureStackedBarChartData = {
    kind: 'stacked_bar_chart_data',
    title: 'Stacked',
    x_axis_label: 'X',
    y_axis_label: 'Y',
    stacked_bars: [{ label: ['A', 'B'], values: [['X', 10]] }],
  };
  const pie: PicturePieChartData = {
    kind: 'pie_chart_data',
    title: 'Pie',
    slices: [
      { label: 'A', value: 0.6 },
      { label: 'B', value: 0.4 },
    ],
  };
  const scatter: PictureScatterChartData = {
    kind: 'scatter_chart_data',
    title: 'Scatter',
    x_axis_label: 'X',
    y_axis_label: 'Y',
    points: [{ value: [1, 2] }],
  };
  const tabularChart: PictureTabularChartData = {
    kind: 'tabular_chart_data',
    title: 'Tabular',
    chart_data: { grid: [] },
  };

  it('PictureClassification accepts classification, rejects others', () => {
    expect(isDoclingAnnotation.PictureClassification(classification)).toBe(
      true
    );
    expect(isDoclingAnnotation.PictureClassification(description)).toBe(false);
    expect(isDoclingAnnotation.PictureClassification(misc)).toBe(false);
  });

  it('PictureDescription accepts description, rejects others', () => {
    expect(isDoclingAnnotation.PictureDescription(description)).toBe(true);
    expect(isDoclingAnnotation.PictureDescription(classification)).toBe(false);
    expect(isDoclingAnnotation.PictureDescription(misc)).toBe(false);
  });

  it('PictureMisc accepts misc, rejects others', () => {
    expect(isDoclingAnnotation.PictureMisc(misc)).toBe(true);
    expect(isDoclingAnnotation.PictureMisc(classification)).toBe(false);
    expect(isDoclingAnnotation.PictureMisc(description)).toBe(false);
  });

  it('PictureMolecule accepts molecule_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureMolecule(molecule)).toBe(true);
    expect(isDoclingAnnotation.PictureMolecule(classification)).toBe(false);
    expect(isDoclingAnnotation.PictureMolecule(lineChart)).toBe(false);
  });

  it('PictureLineChart accepts line_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureLineChart(lineChart)).toBe(true);
    expect(isDoclingAnnotation.PictureLineChart(barChart)).toBe(false);
    expect(isDoclingAnnotation.PictureLineChart(scatter)).toBe(false);
  });

  it('PictureBarChart accepts bar_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureBarChart(barChart)).toBe(true);
    expect(isDoclingAnnotation.PictureBarChart(lineChart)).toBe(false);
    expect(isDoclingAnnotation.PictureBarChart(stackedBar)).toBe(false);
  });

  it('PictureStackedBarChart accepts stacked_bar_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureStackedBarChart(stackedBar)).toBe(true);
    expect(isDoclingAnnotation.PictureStackedBarChart(barChart)).toBe(false);
    expect(isDoclingAnnotation.PictureStackedBarChart(pie)).toBe(false);
  });

  it('PicturePieChart accepts pie_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PicturePieChart(pie)).toBe(true);
    expect(isDoclingAnnotation.PicturePieChart(scatter)).toBe(false);
    expect(isDoclingAnnotation.PicturePieChart(stackedBar)).toBe(false);
  });

  it('PictureScatterChart accepts scatter_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureScatterChart(scatter)).toBe(true);
    expect(isDoclingAnnotation.PictureScatterChart(pie)).toBe(false);
    expect(isDoclingAnnotation.PictureScatterChart(lineChart)).toBe(false);
  });

  it('PictureTabularChart accepts tabular_chart_data, rejects others', () => {
    expect(isDoclingAnnotation.PictureTabularChart(tabularChart)).toBe(true);
    expect(isDoclingAnnotation.PictureTabularChart(pie)).toBe(false);
    expect(isDoclingAnnotation.PictureTabularChart(barChart)).toBe(false);
  });
});
