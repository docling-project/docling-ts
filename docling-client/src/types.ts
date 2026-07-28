/**
 * Version-neutral Docling JSON boundary used by the service client.
 *
 * Supply `DoclingClient<import('@docling/docling-core').DoclingDocument>` when
 * an application wants the exact schema version from docling-core. Keeping the
 * remote client generic prevents its release cadence from pinning a document
 * schema version.
 */
export interface DoclingDocument {
  schema_name?: 'DoclingDocument';
  version?: string;
  name: string;
  [key: string]: unknown;
}

export type InputFormat =
  | 'docx'
  | 'doc'
  | 'pptx'
  | 'html'
  | 'image'
  | 'pdf'
  | 'asciidoc'
  | 'md'
  | 'csv'
  | 'xlsx'
  | 'xml_uspto'
  | 'xml_jats'
  | 'json_docling'
  | 'dclx'
  | 'audio'
  | 'vtt'
  | 'xml_xbrl'
  | 'mets_gbs'
  | 'latex'
  | 'ppt'
  | 'xls'
  | 'odt'
  | 'ods'
  | 'odp'
  | 'xml_doclang'
  | 'video'
  | 'email'
  | 'epub'
  | 'boxnote';

export type OutputFormat =
  | 'md'
  | 'json'
  | 'yaml'
  | 'html'
  | 'html_split_page'
  | 'text'
  | 'doctags'
  | 'vtt'
  | 'doclang'
  | 'dclx'
  | 'chunks';

export type ProcessingPipeline = 'legacy' | 'standard' | 'vlm' | 'asr';
export type TableMode = 'fast' | 'accurate';
export type ImageExportMode = 'placeholder' | 'embedded' | 'referenced';
export type PdfBackend =
  | 'pypdfium2'
  | 'docling_parse'
  | 'threaded_docling_parse'
  | 'dlparse_v1'
  | 'dlparse_v2'
  | 'dlparse_v4';
export type VlmResponseFormat =
  | 'doctags'
  | 'doclang'
  | 'markdown'
  | 'deepseekocr_markdown'
  | 'html'
  | 'otsl'
  | 'plaintext'
  | 'chandra_html'
  | 'dots_json';
export type VlmInferenceFramework = 'mlx' | 'transformers' | 'vllm';
export type TransformersModelType =
  | 'automodel'
  | 'automodel-causallm'
  | 'automodel-imagetexttotext';
export type LegacyVlmModelType =
  | 'smoldocling'
  | 'smoldocling_vllm'
  | 'granite_vision'
  | 'granite_vision_vllm'
  | 'granite_vision_ollama'
  | 'got_ocr_2'
  | 'granite_docling'
  | 'granite_docling_vllm'
  | 'nanonets_ocr2'
  | 'nanonets_ocr2_vllm'
  | 'nanonets_ocr2_lmstudio'
  | 'glm_ocr'
  | 'glm_ocr_vllm'
  | 'lightonocr'
  | 'lightonocr_vllm'
  | 'deepseekocr_ollama';
export type PictureClassificationLabel =
  | 'bar_chart'
  | 'box_plot'
  | 'flow_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'scatter_plot'
  | 'table'
  | 'other_chart'
  | 'full_page_image'
  | 'page_thumbnail'
  | 'photograph'
  | 'chemistry_structure'
  | 'bar_code'
  | 'icon'
  | 'logo'
  | 'qr_code'
  | 'signature'
  | 'stamp'
  | 'engineering_drawing'
  | 'screenshot_from_computer'
  | 'screenshot_from_manual'
  | 'geographical_map'
  | 'topographical_map'
  | 'calendar'
  | 'crossword_puzzle'
  | 'music'
  | 'other'
  | 'cad_drawing'
  | 'electrical_diagram'
  | 'map'
  | 'heatmap'
  | 'chemistry_markush_structure'
  | 'chemistry_molecular_structure'
  | 'natural_image'
  | 'picture_group'
  | 'remote_sensing'
  | 'scatter_chart'
  | 'screenshot'
  | 'stacked_bar_chart'
  | 'stratigraphic_chart';

/** @deprecated Prefer picture_description_preset or picture_description_custom_config. */
export interface PictureDescriptionLocal {
  repo_id: string;
  prompt?: string;
  generation_config?: Record<string, unknown>;
  classification_allow?: PictureClassificationLabel[] | null;
  classification_deny?: PictureClassificationLabel[] | null;
  classification_min_confidence?: number;
}

/** @deprecated Prefer picture_description_preset or picture_description_custom_config. */
export interface PictureDescriptionApi {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  concurrency?: number;
  prompt?: string;
  classification_allow?: PictureClassificationLabel[] | null;
  classification_deny?: PictureClassificationLabel[] | null;
  classification_min_confidence?: number;
}

/** @deprecated Prefer vlm_pipeline_preset or vlm_pipeline_custom_config. */
export interface VlmModelLocal {
  repo_id: string;
  prompt?: string;
  scale?: number;
  response_format: VlmResponseFormat;
  inference_framework: VlmInferenceFramework;
  transformers_model_type?: TransformersModelType;
  extra_generation_config?: Record<string, unknown>;
  temperature?: number;
}

/** @deprecated Prefer vlm_pipeline_preset or vlm_pipeline_custom_config. */
export interface VlmModelApi {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeout?: number;
  concurrency?: number;
  prompt?: string;
  scale?: number;
  response_format: VlmResponseFormat;
  temperature?: number;
}

/**
 * Common Docling Serve conversion controls.
 *
 * The string index preserves forward compatibility with options added by the
 * selected service. Its live OpenAPI document remains authoritative.
 */
export interface ConvertDocumentsOptions {
  [key: string]: unknown;
  from_formats?: InputFormat[];
  to_formats?: OutputFormat[];
  pipeline?: ProcessingPipeline;
  page_range?: [number, number];
  do_ocr?: boolean;
  force_ocr?: boolean;
  /** @deprecated Use ocr_preset instead. */
  ocr_engine?: string;
  ocr_preset?: string;
  ocr_lang?: string[] | null;
  ocr_custom_config?: Record<string, unknown> | string | null;
  pdf_backend?: PdfBackend;
  table_mode?: TableMode;
  table_cell_matching?: boolean;
  do_table_structure?: boolean;
  image_export_mode?: ImageExportMode;
  images_scale?: number;
  include_images?: boolean;
  include_page_images?: boolean;
  md_page_break_placeholder?: string;
  do_code_enrichment?: boolean;
  do_formula_enrichment?: boolean;
  do_picture_classification?: boolean;
  do_picture_description?: boolean;
  do_chart_extraction?: boolean;
  picture_description_area_threshold?: number;
  /** @deprecated Prefer picture_description_preset or picture_description_custom_config. */
  picture_description_local?: PictureDescriptionLocal | null;
  /** @deprecated Prefer picture_description_preset or picture_description_custom_config. */
  picture_description_api?: PictureDescriptionApi | null;
  /** @deprecated Prefer vlm_pipeline_preset or vlm_pipeline_custom_config. */
  vlm_pipeline_model?: LegacyVlmModelType | null;
  /** @deprecated Prefer vlm_pipeline_preset or vlm_pipeline_custom_config. */
  vlm_pipeline_model_local?: VlmModelLocal | null;
  /** @deprecated Prefer vlm_pipeline_preset or vlm_pipeline_custom_config. */
  vlm_pipeline_model_api?: VlmModelApi | null;
  vlm_pipeline_preset?: string | null;
  vlm_pipeline_custom_config?: Record<string, unknown> | null;
  picture_description_preset?: string | null;
  picture_description_custom_config?: Record<string, unknown> | null;
  code_formula_preset?: string | null;
  code_formula_custom_config?: Record<string, unknown> | null;
  table_structure_preset?: string | null;
  table_structure_custom_config?: Record<string, unknown> | string | null;
  layout_preset?: string | null;
  layout_custom_config?: Record<string, unknown> | string | null;
  picture_classification_preset?: string | null;
  picture_classification_custom_config?: Record<string, unknown> | string | null;
  abort_on_error?: boolean;
  document_timeout?: number | null;
}

export interface HttpSource {
  kind: 'http';
  url: string;
  headers?: Record<string, unknown>;
}

export interface FileSource {
  kind: 'file';
  base64_string: string;
  filename: string;
}

export type ConversionSource = HttpSource | FileSource;

export interface InBodyTarget {
  kind: 'inbody';
}

export interface ZipTarget {
  kind: 'zip';
}

export interface PresignedUrlTarget {
  kind: 'presigned_url';
}

export interface PutTarget {
  kind: 'put';
  url: string;
}

export interface S3Coordinates {
  endpoint: string;
  verify_ssl?: boolean;
  access_key: string;
  secret_key: string;
  bucket: string;
  key_prefix?: string;
  max_num_elements?: number | null;
}

export interface S3Source extends S3Coordinates {
  kind: 's3';
}

export interface S3Target extends S3Coordinates {
  kind: 's3';
}

export interface AzureBlobCoordinates {
  account_name: string;
  container: string;
  connection_string: string;
  blob_prefix?: string;
  max_num_elements?: number | null;
}

export interface AzureBlobSource extends AzureBlobCoordinates {
  kind: 'azure_blob';
}

export interface AzureBlobTarget extends AzureBlobCoordinates {
  kind: 'azure_blob';
}

export interface GoogleCloudStorageServiceAccountInfo {
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

export interface GoogleCloudStorageCoordinates {
  bucket: string;
  key_prefix?: string;
  max_num_elements?: number | null;
  project?: string | null;
  service_account_key?: GoogleCloudStorageServiceAccountInfo | null;
}

export interface GoogleCloudStorageSource extends GoogleCloudStorageCoordinates {
  kind: 'google_cloud_storage';
}

export interface GoogleCloudStorageTarget extends GoogleCloudStorageCoordinates {
  kind: 'google_cloud_storage';
}

export interface GoogleDriveCredentials {
  client_id: string;
  project_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_secret: string;
  redirect_uris: string[];
}

export interface GoogleDriveCoordinates {
  path_id: string;
  token_path?: string | null;
  refresh_token?: string | null;
  credentials_path?: string | null;
  credentials?: GoogleDriveCredentials | null;
}

export interface GoogleDriveSource extends GoogleDriveCoordinates {
  kind: 'google_drive';
}

export interface GoogleDriveTarget extends GoogleDriveCoordinates {
  kind: 'google_drive';
}

export interface GenericSource {
  kind: string;
  [key: string]: unknown;
}

export interface GenericTarget {
  kind: string;
  [key: string]: unknown;
}

export type StorageTarget =
  | S3Target
  | AzureBlobTarget
  | GoogleCloudStorageTarget
  | GoogleDriveTarget;

export type SubmitTarget =
  | InBodyTarget
  | ZipTarget
  | PresignedUrlTarget
  | PutTarget
  | StorageTarget;

export type BatchSource =
  | HttpSource
  | S3Source
  | AzureBlobSource
  | GoogleCloudStorageSource
  | GoogleDriveSource
  | GenericSource;

export type BatchTarget = PresignedUrlTarget | StorageTarget | GenericTarget;

export interface CallbackSpec {
  url: string;
  headers?: Record<string, string>;
  ca_cert?: string;
  [key: string]: unknown;
}

export interface ConvertSourcesRequest<TTarget extends SubmitTarget = SubmitTarget> {
  options?: ConvertDocumentsOptions;
  sources: ConversionSource[];
  target?: TTarget;
  callbacks?: CallbackSpec[];
}

export interface BatchConvertSourcesRequest<TTarget extends BatchTarget = BatchTarget> {
  options?: ConvertDocumentsOptions;
  sources: BatchSource[];
  target: TTarget;
  callbacks?: CallbackSpec[];
}

export type ChunkerKind = 'hybrid' | 'hierarchical';

export interface BaseChunkingOptions {
  use_markdown_tables?: boolean;
  use_markdown_images?: boolean;
  image_placeholder?: string;
  include_raw_text?: boolean;
}

export interface HybridChunkingOptions extends BaseChunkingOptions {
  max_tokens?: number | null;
  tokenizer?: string;
  merge_peers?: boolean;
}

export type HierarchicalChunkingOptions = BaseChunkingOptions;

interface BaseChunkSourcesRequest {
  convert_options?: ConvertDocumentsOptions;
  sources: ConversionSource[];
  include_converted_doc?: boolean;
  target?: InBodyTarget;
  callbacks?: CallbackSpec[];
}

export interface HybridChunkSourcesRequest extends BaseChunkSourcesRequest {
  chunker: 'hybrid';
  chunking_options?: HybridChunkingOptions;
}

export interface HierarchicalChunkSourcesRequest extends BaseChunkSourcesRequest {
  chunker: 'hierarchical';
  chunking_options?: HierarchicalChunkingOptions;
}

/**
 * A Docling Serve chunk job converts each source and then chunks the resulting
 * DoclingDocument in the same task.
 */
export type ChunkSourcesRequest =
  | HybridChunkSourcesRequest
  | HierarchicalChunkSourcesRequest;

export type ChunkSourceOptions =
  | Omit<HybridChunkSourcesRequest, 'sources'>
  | Omit<HierarchicalChunkSourcesRequest, 'sources'>;

export type TaskType = 'convert' | 'chunk';
export type TaskStatus =
  | 'pending'
  | 'started'
  | 'success'
  | 'failure'
  | 'partial_success'
  | 'skipped';

export interface TaskProcessingMeta {
  num_docs: number;
  num_processed: number;
  num_succeeded: number;
  num_partially_succeeded: number;
  num_failed: number;
}

export interface PublicFailureInfo {
  category: FailureCategory;
  message: string;
  retryable: boolean;
  phase: 'admission' | 'source_enumeration' | 'execution' | 'orchestration';
  details: Record<string, string>;
}

export interface TaskStatusResponse {
  task_id: string;
  task_type: TaskType;
  task_status: TaskStatus;
  task_position?: number | null;
  task_meta?: TaskProcessingMeta | null;
  error_message?: string | null;
  failure?: PublicFailureInfo | null;
}

export type ConversionStatus =
  | 'pending'
  | 'started'
  | 'success'
  | 'partial_success'
  | 'skipped'
  | 'failure';

export type FailureCategory =
  | 'policy'
  | 'capacity'
  | 'source_unavailable'
  | 'target_unavailable'
  | 'timeout'
  | 'internal'
  | 'backend_failure'
  | 'inference_failure'
  | 'unknown';

export type DoclingComponentType =
  | 'document_backend'
  | 'model'
  | 'doc_assembler'
  | 'user_input'
  | 'pipeline';

export type QualityGrade = 'poor' | 'fair' | 'good' | 'excellent' | 'unspecified';

export interface ConfidenceScores {
  parse_score?: number | null;
  layout_score?: number | null;
  table_score?: number | null;
  ocr_score?: number | null;
  mean_score?: number | null;
  low_score?: number | null;
  mean_grade?: QualityGrade;
  low_grade?: QualityGrade;
}

export interface ErrorItem {
  component_type: DoclingComponentType;
  module_name: string;
  error_message: string;
  category?: FailureCategory;
  page_no?: number | null;
}

export type ProfilingScope = 'page' | 'document';

export interface ProfilingItem {
  scope: ProfilingScope;
  count: number;
  times: number[];
  start_timestamps?: string[];
}

export interface ExportDocumentResponse<TDocument = DoclingDocument> {
  filename: string;
  md_content?: string | null;
  json_content?: TDocument | null;
  html_content?: string | null;
  text_content?: string | null;
  doctags_content?: string | null;
  doclang_content?: string | null;
}

export interface ExportResult<TDocument = DoclingDocument> {
  kind: 'ExportResult';
  content: ExportDocumentResponse<TDocument>;
  status: ConversionStatus;
  errors: ErrorItem[];
  timings: Record<string, ProfilingItem>;
  confidence?: ConfidenceScores | null;
}

export type ArtifactType =
  | 'json'
  | 'html'
  | 'markdown'
  | 'text'
  | 'doctags'
  | 'doclang'
  | 'resource_bundle';

export interface ArtifactRef {
  artifact_type: ArtifactType;
  mime_type: string;
  uri: string;
  url_expires_at?: string | null;
}

export interface DocumentArtifactItem {
  source_index: number;
  source_uri: string;
  filename: string;
  status: ConversionStatus;
  errors: ErrorItem[];
  timings: Record<string, ProfilingItem>;
  artifacts: ArtifactRef[];
  confidence?: ConfidenceScores | null;
}

export interface OutcomeCounts {
  num_converted: number;
  num_succeeded: number;
  num_partially_succeeded: number;
  num_failed: number;
}

export interface PresignedUrlConvertDocumentResponse extends OutcomeCounts {
  processing_time: number;
}

export interface PresignedUrlConvertResponse extends PresignedUrlConvertDocumentResponse {
  documents: DocumentArtifactItem[];
}

export interface RawServiceResult {
  content: Uint8Array;
  content_type: string;
  filename: string | null;
}

export interface ChunkedDocumentResultItem {
  filename: string;
  chunk_index: number;
  text: string;
  raw_text?: string | null;
  num_tokens?: number | null;
  headings?: string[] | null;
  captions?: string[] | null;
  doc_items: string[];
  page_numbers?: number[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface ChunkDocumentResponse<TDocument = DoclingDocument> {
  chunks: ChunkedDocumentResultItem[];
  documents: ExportResult<TDocument>[];
  processing_time: number;
}

export interface ConvertDocumentResponse<TDocument = DoclingDocument> {
  document: ExportDocumentResponse<TDocument>;
  status: ConversionStatus;
  errors: ErrorItem[];
  processing_time: number;
  timings: Record<string, ProfilingItem>;
  confidence?: ConfidenceScores | null;
}

export interface ConversionInput {
  filename: string;
  source: string;
  format?: InputFormat;
  file_size?: number | null;
}

/**
 * JavaScript counterpart of Python's high-level ConversionResult.
 *
 * The document remains plain Docling JSON so it works with @docling/docling-core
 * traversal utilities without embedding a conversion runtime.
 */
export interface ConversionResult<TDocument = DoclingDocument> {
  input: ConversionInput;
  document: TDocument;
  status: ConversionStatus;
  errors: ErrorItem[];
  processing_time: number;
  timings: Record<string, ProfilingItem>;
  confidence?: ConfidenceScores | null;
}

export type SubmitResultForTarget<
  TTarget extends SubmitTarget,
  TDocument = DoclingDocument,
> = TTarget extends InBodyTarget
  ? ConversionResult<TDocument>
  : TTarget extends ZipTarget
    ? RawServiceResult
    : TTarget extends PresignedUrlTarget
      ? PresignedUrlConvertResponse
      : PresignedUrlConvertDocumentResponse;

export type AutoSubmitResult<TDocument = DoclingDocument> =
  | ConversionResult<TDocument>
  | PresignedUrlConvertResponse;

/** Clearer alias for the legacy Python-compatible counts response name. */
export type RemoteTargetResponse = PresignedUrlConvertDocumentResponse;

export type BatchResultForTarget<TTarget extends BatchTarget> =
  TTarget extends PresignedUrlTarget
    ? PresignedUrlConvertResponse
    : PresignedUrlConvertDocumentResponse;

export type InBodyConversionResponse<TDocument = DoclingDocument> =
  | ConvertDocumentResponse<TDocument>
  | ChunkDocumentResponse<TDocument>;

export interface TaskFailureResult {
  kind: 'TaskFailureResult';
  failure: PublicFailureInfo;
}

export interface HealthCheckResponse {
  status: string;
}

export interface WaitForTaskOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  serverWaitSeconds?: number;
  statusWatcher?: 'websocket' | 'polling';
  signal?: AbortSignal;
  onStatus?: (status: TaskStatusResponse) => void | Promise<void>;
}

export interface DocumentLimits {
  maxNumPages?: number;
  maxFileSize?: number;
  pageRange?: [number, number];
}

export interface ConversionItem {
  source: ConversionSourceInput;
  options?: ConvertDocumentsOptions;
  headers?: Record<string, string>;
  metadata?: unknown;
}

export interface BinaryFileSource {
  data: Blob | ArrayBuffer | ArrayBufferView;
  filename: string;
  contentType?: string;
}

export type ConversionSourceInput = ConversionSource | URL | string | BinaryFileSource;

export interface SubmitAndRetrieveOptions<TTarget extends SubmitTarget> {
  maxInFlight?: number;
  ordered?: boolean;
  target?: TTarget;
  signal?: AbortSignal;
}
