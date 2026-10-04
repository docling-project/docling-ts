import {
  type AutoSubmitResult,
  type ConfidenceScores,
  type DoclingComponentType,
  DoclingClient,
  type DoclingJob,
  type ConversionItem,
  type ConversionResult,
  type ConvertDocumentsOptions,
  type ExportDocumentResponse,
  type ExportResult,
  type FailureCategory,
  type HeadingHierarchyOptions,
  type InBodyTarget,
  type PictureClassificationLabel,
  type PresignedUrlConvertResponse,
  type ProfilingScope,
  type QualityGrade,
} from '../src';

export function compileTimeParity(client: DoclingClient): unknown[] {
  const auto = client.submitUrl('https://example.test/manual.pdf');
  const autoCheck: Promise<DoclingJob<AutoSubmitResult>> = auto;

  const inBody = client.submitUrl(
    'https://example.test/manual.pdf',
    {},
    { target: { kind: 'inbody' } satisfies InBodyTarget }
  );
  const inBodyCheck: Promise<DoclingJob<ConversionResult>> = inBody;

  const presigned = client.submitFile(
    'ZmlsZQ==',
    'manual.pdf',
    {},
    {
      target: { kind: 'presigned_url' },
    }
  );
  const presignedCheck: Promise<DoclingJob<PresignedUrlConvertResponse>> = presigned;

  const autoFanout: AsyncGenerator<
    [ConversionItem & { metadata?: unknown }, AutoSubmitResult | Error]
  > = client.submitAndRetrieveEach([{ source: 'https://example.test/a.pdf' }]);

  const confidence = {
    parse_score: 0.91,
    layout_score: null,
    mean_grade: 'good',
    low_grade: 'fair',
  } satisfies ConfidenceScores;
  const category: FailureCategory = 'backend_failure';
  const component: DoclingComponentType = 'document_backend';
  const scope: ProfilingScope = 'document';
  const grade: QualityGrade = 'excellent';
  const pictureLabel: PictureClassificationLabel = 'engineering_drawing';
  const pictureOptions: ConvertDocumentsOptions = {
    picture_description_local: {
      repo_id: 'model',
      classification_allow: [pictureLabel],
    },
  };

  const compactTablesOptions: ConvertDocumentsOptions = {
    md_compact_tables: true,
  };

  const s3WithRegion = {
    kind: 's3' as const,
    endpoint: 's3.us-east-2.amazonaws.com',
    region: 'us-east-2',
    bucket: 'input',
  };

  // PDF heading hierarchy
  const headingHierarchyOpts: HeadingHierarchyOptions = {
    use_bookmarks: true,
    use_outline_levels: false,
    use_style: true,
    max_level: 4,
  };
  const pdfHeadingOptions: ConvertDocumentsOptions = {
    do_pdf_heading_hierarchy: true,
    pdf_heading_hierarchy_options: headingHierarchyOpts,
  };

  // Chart extraction preset/custom config
  const chartExtractionPresetOptions: ConvertDocumentsOptions = {
    do_chart_extraction: true,
    chart_extraction_preset: 'granite_vision_v4',
  };
  const chartExtractionCustomOptions: ConvertDocumentsOptions = {
    do_chart_extraction: true,
    chart_extraction_custom_config: {
      model_spec: { name: 'Granite-Vision-4.1-4B' },
      chart2csv: true,
    },
  };

  // Inline chunking in convert options
  const chunkingPresetOptions: ConvertDocumentsOptions = {
    chunking_preset: 'granite_embedding_278m',
  };
  const chunkingInlineOptions: ConvertDocumentsOptions = {
    chunking_options: {
      chunker: 'hybrid',
      max_tokens: 512,
      tokenizer: 'sentence-transformers/all-MiniLM-L6-v2',
    },
  };

  // v2.133.0: ExportResult.document field (Python DocumentResultItem rename from content)
  const exportDocPayload: ExportDocumentResponse = {
    filename: 'manual.pdf',
    md_content: '# Title',
  };
  const exportResult: ExportResult = {
    kind: 'ExportResult',
    document: exportDocPayload,
    status: 'success',
    errors: [],
    timings: {},
  };
  // @ts-expect-error ExportResult no longer has a `content` field; use `document`.
  const _exportResultContent: ExportDocumentResponse = exportResult.content;

  // Formats and pipeline options
  const nativePipelineOptions: ConvertDocumentsOptions = {
    pipeline: 'native',
    pdf_backend: '_docling_parse',
    from_formats: ['rtf', 'mhtml', 'iwork_pages', 'iwork_keynote', 'ebcdic', 'afp'],
    to_formats: ['latex'],
  };

  // @ts-expect-error Python's wire contract does not accept arbitrary categories.
  const invalidCategory: FailureCategory = 'made_up';
  // @ts-expect-error Python's wire contract does not accept arbitrary grades.
  const invalidGrade: QualityGrade = 'great';
  // @ts-expect-error Python's wire contract does not accept arbitrary scopes.
  const invalidScope: ProfilingScope = 'task';
  // @ts-expect-error Picture labels are the exact Docling Core enum.
  const invalidPictureLabel: PictureClassificationLabel = 'diagram';

  return [
    autoCheck,
    inBodyCheck,
    presignedCheck,
    autoFanout,
    confidence,
    category,
    component,
    scope,
    grade,
    invalidCategory,
    invalidGrade,
    invalidScope,
    pictureOptions,
    invalidPictureLabel,
    compactTablesOptions,
    s3WithRegion,
    headingHierarchyOpts,
    pdfHeadingOptions,
    chartExtractionPresetOptions,
    chartExtractionCustomOptions,
    chunkingPresetOptions,
    chunkingInlineOptions,
    nativePipelineOptions,
    exportResult,
    _exportResultContent,
  ];
}
