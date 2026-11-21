import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { deserializeDocLang } from '../src/doclang';

interface Case {
  xml: string;
  tests: string[];
  kwargs?: Record<string, unknown>;
  doc?: Record<string, unknown>;
  error?: string;
  warnings?: string[];
}

const cases: Case[] = JSON.parse(
  readFileSync(join(__dirname, 'data/doclang-upstream/cases.json'), 'utf8')
);

const options = (
  kwargs: Case['kwargs'] = {},
  onWarning: (message: string) => void = () => {}
) => ({
  DOMParser,
  pageNo: kwargs.page_no as number | undefined,
  maxXmlBytes: kwargs.max_xml_bytes as number | undefined,
  maxDepth: kwargs.max_xml_depth as number | undefined,
  maxElements: kwargs.max_xml_elements as number | undefined,
  repairUnescapedText: kwargs.repair_unescaped_text as boolean | undefined,
  onWarning,
});

// Fresh `export_to_dict()` of the Python DocLangDocDeserializer (v2.108.0) for
// the input of every upstream DocLang test. Regenerate with the capture plugin
// described in the PR body.
describe('upstream DocLang test inputs', () => {
  for (const [i, c] of cases.entries()) {
    const name = `${c.tests[0].replace(/^tests\//, '')} #${i}`;
    it(name, () => {
      if (c.error !== undefined) {
        expect(() => deserializeDocLang(c.xml, options(c.kwargs))).toThrow();
        return;
      }
      const warnings: string[] = [];
      const doc = deserializeDocLang(
        c.xml,
        options(c.kwargs, m => warnings.push(m))
      );
      expect(JSON.parse(JSON.stringify(doc))).toEqual(c.doc);
      expect(warnings).toEqual(c.warnings ?? []);
    });
  }
});
