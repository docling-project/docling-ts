import {
  type AutoSubmitResult,
  type BaseProgress,
  type ChunkedDocumentResult,
  type ClearResponse,
  type ConfidenceScores,
  type ConvertDocumentErrorResponse,
  type DoclingComponentType,
  DoclingClient,
  type DoclingJob,
  type DoclingTaskResult,
  type DocumentCompletedItem,
  type ConversionItem,
  type ConversionResult,
  type ConvertDocumentsOptions,
  type ExportDocumentResponse,
  type ExportResult,
  type FailureCategory,
  type FailurePhase,
  type HeadingHierarchyOptions,
  type InBodyTarget,
  type MessageKind,
  type PictureClassificationLabel,
  type PresignedArtifactResult,
  type PresignedUrlConvertResponse,
  type ProcessedDocsItem,
  type ProfilingScope,
  type ProgressCallbackRequest,
  type ProgressCallbackResponse,
  type ProgressDocumentCompleted,
  type ProgressKind,
  type ProgressSetNumDocs,
  type ProgressTaskCompleted,
  type ProgressUpdateProcessed,
  type QualityGrade,
  type ReadinessResponse,
  type RemoteTargetResult,
  TargetName,
  type UsageLimitExceededResponse,
  type WebsocketMessage,
  type ZipArchiveResult,
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

  const exportDocPayload: ExportDocumentResponse = {
    filename: 'manual.pdf',
    md_content: '# Title',
  };
  const exportResult: ExportResult = {
    kind: 'ExportResult',
    document: exportDocPayload,
    content: exportDocPayload,
    status: 'success',
    errors: [],
    timings: {},
  };
  const _exportResultContent: ExportDocumentResponse = exportResult.content;

  // Formats and pipeline options
  const nativePipelineOptions: ConvertDocumentsOptions = {
    pipeline: 'native',
    pdf_backend: '_docling_parse',
    from_formats: [
      'rtf',
      'mhtml',
      'iwork_pages',
      'iwork_keynote',
      'iwork_numbers',
      'ebcdic',
      'afp',
    ],
    to_formats: ['latex'],
  };

  // Callback types parity
  const progressKind: ProgressKind = 'document_completed';
  const baseProgress: BaseProgress = { kind: progressKind };
  const setNumDocsProgress: ProgressSetNumDocs = {
    kind: 'set_num_docs',
    num_docs: 5,
  };
  const processedDocItem: ProcessedDocsItem = {
    source: 'doc1.pdf',
    status: 'success',
    error: null,
  };
  const updateProcessedProgress: ProgressUpdateProcessed = {
    kind: 'update_processed',
    num_processed: 1,
    num_succeeded: 1,
    num_partially_succeeded: 0,
    num_failed: 0,
    docs: [processedDocItem],
  };
  const docCompletedItem: DocumentCompletedItem = {
    source: 'sheet.numbers',
    status: 'success',
    document_type: 'iwork_numbers',
    num_pages: 1,
    num_tables: 2,
  };
  const docCompletedProgress: ProgressDocumentCompleted = {
    kind: 'document_completed',
    document: docCompletedItem,
    total_processed: 1,
    total_docs: 5,
  };
  const taskCompletedProgress: ProgressTaskCompleted = {
    kind: 'task_completed',
    task_status: 'success',
  };
  const callbackRequest: ProgressCallbackRequest = {
    task_id: 'task-123',
    progress: docCompletedProgress,
  };
  const callbackResponse: ProgressCallbackResponse = {
    status: 'ack',
  };

  // FailurePhase parity
  const failurePhase: FailurePhase = 'admission';

  // Task & Response Models parity
  const readiness: ReadinessResponse = { status: 'ok' };
  const clear: ClearResponse = { status: 'ok' };
  const convertDocError: ConvertDocumentErrorResponse = { status: 'failure' };
  const usageExceeded: UsageLimitExceededResponse = {
    error: 'usage_limit_exceeded',
    message: 'Quota exceeded',
    details: { currentUsage: 100, limit: 100 },
  };
  const messageKind: MessageKind = 'update';
  const wsMessage: WebsocketMessage = {
    message: messageKind,
  };
  const zipResult: ZipArchiveResult = {
    kind: 'ZipArchiveResult',
    content: new Uint8Array(),
  };
  const remoteResult: RemoteTargetResult = {
    kind: 'RemoteTargetResult',
  };
  const presignedArtifactResult: PresignedArtifactResult = {
    kind: 'PresignedArtifactResult',
    documents: [],
  };
  const chunkedDocResult: ChunkedDocumentResult = {
    kind: 'ChunkedDocumentResponse',
    chunks: [],
    documents: [],
  };
  const taskResult: DoclingTaskResult = {
    num_converted: 1,
    num_succeeded: 1,
    num_partially_succeeded: 0,
    num_failed: 0,
    processing_time: 1.2,
    result: exportResult,
  };
  const targetNameInBody = TargetName.INBODY;

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
    progressKind,
    baseProgress,
    setNumDocsProgress,
    processedDocItem,
    updateProcessedProgress,
    docCompletedItem,
    docCompletedProgress,
    taskCompletedProgress,
    callbackRequest,
    callbackResponse,
    failurePhase,
    readiness,
    clear,
    convertDocError,
    usageExceeded,
    messageKind,
    wsMessage,
    zipResult,
    remoteResult,
    presignedArtifactResult,
    chunkedDocResult,
    taskResult,
    targetNameInBody,
  ];
}
