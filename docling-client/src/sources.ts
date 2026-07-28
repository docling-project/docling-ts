import { DoclingProtocolError } from './errors';
import type {
  BinaryFileSource,
  ConversionInput,
  ConversionSource,
  ConversionSourceInput,
  ConvertDocumentsOptions,
  FileSource,
  HttpSource,
  InputFormat,
} from './types';

export interface NormalizedJsonSource {
  kind: 'json';
  source: ConversionSource;
  descriptor: ConversionInput;
}

export interface NormalizedMultipartSource {
  kind: 'multipart';
  blob: Blob;
  descriptor: ConversionInput;
}

export type NormalizedSource = NormalizedJsonSource | NormalizedMultipartSource;

const EXTENSION_FORMATS: Readonly<Record<string, InputFormat>> = {
  pdf: 'pdf',
  docx: 'docx',
  dotx: 'docx',
  docm: 'docx',
  dotm: 'docx',
  doc: 'doc',
  dot: 'doc',
  pptx: 'pptx',
  potx: 'pptx',
  ppsx: 'pptx',
  pptm: 'pptx',
  potm: 'pptx',
  ppsm: 'pptx',
  ppt: 'ppt',
  pot: 'ppt',
  pps: 'ppt',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  md: 'md',
  markdown: 'md',
  txt: 'md',
  text: 'md',
  qmd: 'md',
  rmd: 'md',
  csv: 'csv',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xls',
  xlt: 'xls',
  asciidoc: 'asciidoc',
  adoc: 'asciidoc',
  asc: 'asciidoc',
  json: 'json_docling',
  dclx: 'dclx',
  'dclg.xml': 'xml_doclang',
  dclg: 'xml_doclang',
  xml: 'xml_jats',
  nxml: 'xml_jats',
  xbrl: 'xml_xbrl',
  'tar.gz': 'mets_gbs',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  tif: 'image',
  tiff: 'image',
  bmp: 'image',
  webp: 'image',
  wav: 'audio',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  mp4: 'video',
  avi: 'video',
  mov: 'video',
  mkv: 'video',
  webm: 'video',
  vtt: 'vtt',
  odt: 'odt',
  ott: 'odt',
  ods: 'ods',
  ots: 'ods',
  odp: 'odp',
  otp: 'odp',
  tex: 'latex',
  latex: 'latex',
  eml: 'email',
  epub: 'epub',
  boxnote: 'boxnote',
};

export async function normalizeSourceInput(
  input: ConversionSourceInput,
  signal?: AbortSignal
): Promise<NormalizedSource> {
  throwIfAborted(signal);
  if (typeof input === 'string') {
    return normalizeStringSource(input, signal);
  }
  if (input instanceof URL) {
    return normalizeHttpUrl(input.toString());
  }
  if (isHttpSource(input)) {
    validateHttpUrl(input.url, true);
    const normalized: NormalizedJsonSource = {
      kind: 'json',
      source: clone(input),
      descriptor: describeHttpSource(input.url),
    };
    throwIfAborted(signal);
    return normalized;
  }
  if (isFileSource(input)) {
    const normalized: NormalizedJsonSource = {
      kind: 'json',
      source: clone(input),
      descriptor: {
        filename: input.filename,
        source: input.filename,
        format: guessInputFormat(input.filename),
        file_size: base64ByteLength(input.base64_string),
      },
    };
    throwIfAborted(signal);
    return normalized;
  }
  if (isBinaryFileSource(input)) {
    const blob = await toBlob(input.data, input.contentType);
    throwIfAborted(signal);
    return {
      kind: 'multipart',
      blob,
      descriptor: {
        filename: input.filename,
        source: input.filename,
        format: guessInputFormat(input.filename),
        file_size: blob.size,
      },
    };
  }
  throw new DoclingProtocolError('Unsupported Docling conversion source');
}

export function resolveConvertOptions(
  defaults: ConvertDocumentsOptions,
  overrides: ConvertDocumentsOptions | undefined
): ConvertDocumentsOptions {
  const resolved = clone(defaults);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      delete resolved[key];
      continue;
    }
    resolved[key] = clone(value);
  }
  decodeNestedConfigStrings(resolved);
  validateConvertOptions(resolved);
  return resolved;
}

function decodeNestedConfigStrings(options: ConvertDocumentsOptions): void {
  for (const key of JSON_STRING_CONFIG_OPTIONS) {
    const value = options[key];
    if (typeof value !== 'string') {
      continue;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(value) as unknown;
    } catch (error) {
      throw new DoclingProtocolError(`${key} contains invalid JSON`, {
        cause: error,
      });
    }
    if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new DoclingProtocolError(`${key} JSON must decode to an object`);
    }
    options[key] = decoded as Record<string, unknown>;
  }
}

export function withJsonOutput(
  options: ConvertDocumentsOptions
): ConvertDocumentsOptions {
  const formats = options.to_formats ?? ['md'];
  if (formats.includes('json')) {
    return clone(options);
  }
  return {
    ...clone(options),
    to_formats: [...formats, 'json'],
  };
}

export function validateConvertOptions(options: ConvertDocumentsOptions): void {
  validateStringEnumArray(options.from_formats, INPUT_FORMATS, 'from_formats');
  validateStringEnumArray(options.to_formats, OUTPUT_FORMATS, 'to_formats');
  validateStringEnum(options.pipeline, PIPELINES, 'pipeline');
  validateStringEnum(
    options.image_export_mode,
    IMAGE_EXPORT_MODES,
    'image_export_mode'
  );
  validateStringEnum(options.table_mode, TABLE_MODES, 'table_mode');
  validateStringEnum(options.pdf_backend, PDF_BACKENDS, 'pdf_backend');
  if (options.vlm_pipeline_model !== undefined && options.vlm_pipeline_model !== null) {
    validateStringEnum(
      options.vlm_pipeline_model,
      LEGACY_VLM_MODELS,
      'vlm_pipeline_model'
    );
  }
  if (options.page_range !== undefined) {
    validatePageRange(options.page_range);
  }

  for (const key of BOOLEAN_OPTIONS) {
    const value = options[key];
    if (value !== undefined && typeof value !== 'boolean') {
      throw new DoclingProtocolError(`${key} must be a boolean`);
    }
  }
  for (const key of NUMBER_OPTIONS) {
    const value = options[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'number' || !Number.isFinite(value))
    ) {
      throw new DoclingProtocolError(`${key} must be a finite number or null`);
    }
  }
  for (const key of STRING_OPTIONS) {
    const value = options[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new DoclingProtocolError(`${key} must be a string or null`);
    }
  }
  if (
    options.ocr_lang !== undefined &&
    options.ocr_lang !== null &&
    (!Array.isArray(options.ocr_lang) ||
      options.ocr_lang.some(value => typeof value !== 'string'))
  ) {
    throw new DoclingProtocolError('ocr_lang must be an array of strings or null');
  }
  for (const key of RECORD_OPTIONS) {
    const value = options[key];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'object' || Array.isArray(value))
    ) {
      throw new DoclingProtocolError(`${key} must be an object or null`);
    }
  }
  validateLegacyPictureDescription(options.picture_description_local);
  validateLegacyPictureDescription(options.picture_description_api, true);
  validateLegacyVlmModel(options.vlm_pipeline_model_local);
  validateLegacyVlmModel(options.vlm_pipeline_model_api, true);
  validateOptionExclusivity(options);
}

function validateLegacyPictureDescription(value: unknown, api = false): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isRecord(value)) {
    throw new DoclingProtocolError(
      `${api ? 'picture_description_api' : 'picture_description_local'} must be an object`
    );
  }
  const path = api ? 'picture_description_api' : 'picture_description_local';
  if (api) {
    validateAbsoluteUrl(value.url, `${path}.url`);
    validateOptionalStringRecord(value.headers, `${path}.headers`);
    validateOptionalRecord(value.params, `${path}.params`);
    validateOptionalPositiveInteger(value.concurrency, `${path}.concurrency`);
    validateOptionalFiniteNumber(value.timeout, `${path}.timeout`);
  } else {
    validateRequiredString(value.repo_id, `${path}.repo_id`);
    validateOptionalRecord(value.generation_config, `${path}.generation_config`);
  }
  validateOptionalString(value.prompt, `${path}.prompt`);
  validateOptionalEnumArray(
    value.classification_allow,
    PICTURE_CLASSIFICATION_LABELS,
    `${path}.classification_allow`
  );
  validateOptionalEnumArray(
    value.classification_deny,
    PICTURE_CLASSIFICATION_LABELS,
    `${path}.classification_deny`
  );
  const minimum = value.classification_min_confidence;
  if (
    minimum !== undefined &&
    (typeof minimum !== 'number' ||
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      minimum > 1)
  ) {
    throw new DoclingProtocolError(
      `${path}.classification_min_confidence must be between 0 and 1`
    );
  }
}

function validateLegacyVlmModel(value: unknown, api = false): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isRecord(value)) {
    throw new DoclingProtocolError(
      `${api ? 'vlm_pipeline_model_api' : 'vlm_pipeline_model_local'} must be an object`
    );
  }
  const path = api ? 'vlm_pipeline_model_api' : 'vlm_pipeline_model_local';
  if (api) {
    validateAbsoluteUrl(value.url, `${path}.url`);
    validateOptionalStringRecord(value.headers, `${path}.headers`);
    validateOptionalRecord(value.params, `${path}.params`);
    validateOptionalPositiveInteger(value.concurrency, `${path}.concurrency`);
    validateOptionalFiniteNumber(value.timeout, `${path}.timeout`);
  } else {
    validateRequiredString(value.repo_id, `${path}.repo_id`);
    validateRequiredEnum(
      value.inference_framework,
      VLM_INFERENCE_FRAMEWORKS,
      `${path}.inference_framework`
    );
    validateStringEnum(
      value.transformers_model_type as string | undefined,
      TRANSFORMERS_MODEL_TYPES,
      `${path}.transformers_model_type`
    );
    validateOptionalRecord(
      value.extra_generation_config,
      `${path}.extra_generation_config`
    );
  }
  validateRequiredEnum(
    value.response_format,
    VLM_RESPONSE_FORMATS,
    `${path}.response_format`
  );
  validateOptionalString(value.prompt, `${path}.prompt`);
  validateOptionalFiniteNumber(value.scale, `${path}.scale`);
  validateOptionalFiniteNumber(value.temperature, `${path}.temperature`);
}

function validateOptionExclusivity(options: ConvertDocumentsOptions): void {
  const present = (...values: unknown[]) =>
    values.filter(value => value !== undefined && value !== null).length;
  const conflicting = (preset: unknown, custom: unknown) =>
    typeof preset === 'string' &&
    preset !== '' &&
    isRecord(custom) &&
    Object.keys(custom).length > 0;

  if (present(options.picture_description_local, options.picture_description_api) > 1) {
    throw new DoclingProtocolError(
      'picture_description_local and picture_description_api are mutually exclusive'
    );
  }
  const legacyVlmCount = present(
    options.vlm_pipeline_model,
    options.vlm_pipeline_model_local,
    options.vlm_pipeline_model_api
  );
  if (legacyVlmCount > 1) {
    throw new DoclingProtocolError(
      'vlm_pipeline_model, vlm_pipeline_model_local, and vlm_pipeline_model_api are mutually exclusive'
    );
  }
  if (conflicting(options.vlm_pipeline_preset, options.vlm_pipeline_custom_config)) {
    throw new DoclingProtocolError(
      'vlm_pipeline_preset and vlm_pipeline_custom_config are mutually exclusive'
    );
  }
  if (
    legacyVlmCount > 0 &&
    present(options.vlm_pipeline_preset, options.vlm_pipeline_custom_config) > 0
  ) {
    throw new DoclingProtocolError(
      'Legacy VLM model options cannot be mixed with VLM preset/custom options'
    );
  }
  const legacyPictureCount = present(
    options.picture_description_local,
    options.picture_description_api
  );
  if (
    conflicting(
      options.picture_description_preset,
      options.picture_description_custom_config
    )
  ) {
    throw new DoclingProtocolError(
      'picture_description_preset and picture_description_custom_config are mutually exclusive'
    );
  }
  if (
    legacyPictureCount > 0 &&
    present(
      options.picture_description_preset,
      options.picture_description_custom_config
    ) > 0
  ) {
    throw new DoclingProtocolError(
      'Legacy picture-description options cannot be mixed with picture-description preset/custom options'
    );
  }
  for (const [name, preset, custom] of [
    ['code_formula', options.code_formula_preset, options.code_formula_custom_config],
    ['layout', options.layout_preset, options.layout_custom_config],
    [
      'picture_classification',
      options.picture_classification_preset,
      options.picture_classification_custom_config,
    ],
  ] as const) {
    if (conflicting(preset, custom)) {
      throw new DoclingProtocolError(
        `${name}_preset and ${name}_custom_config are mutually exclusive`
      );
    }
  }
  if (
    options.ocr_preset !== undefined &&
    options.ocr_preset !== 'auto' &&
    isRecord(options.ocr_custom_config) &&
    Object.keys(options.ocr_custom_config).length > 0
  ) {
    throw new DoclingProtocolError(
      'ocr_preset and ocr_custom_config are mutually exclusive'
    );
  }
}

export function applyPageLimits(
  options: ConvertDocumentsOptions,
  pageRange?: [number, number],
  maxNumPages?: number
): ConvertDocumentsOptions {
  let effectiveRange = pageRange ?? options.page_range;
  if (maxNumPages !== undefined) {
    validateNonNegativeSafeInteger(maxNumPages, 'maxNumPages');
    effectiveRange = [
      effectiveRange?.[0] ?? 1,
      Math.min(effectiveRange?.[1] ?? Number.MAX_SAFE_INTEGER, maxNumPages),
    ];
  }
  if (effectiveRange !== undefined) {
    validatePageRange(effectiveRange);
    return { ...clone(options), page_range: [...effectiveRange] };
  }
  return clone(options);
}

export function validateMaxFileSize(value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  validateNonNegativeSafeInteger(value, 'maxFileSize');
}

export function preflightFileSize(
  source: NormalizedSource,
  maxFileSize: number | undefined
): string | null {
  if (
    maxFileSize === undefined ||
    source.descriptor.file_size === undefined ||
    source.descriptor.file_size === null ||
    source.descriptor.file_size <= maxFileSize
  ) {
    return null;
  }
  return `File size ${source.descriptor.file_size} exceeds the configured limit of ${maxFileSize} bytes`;
}

export function formValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export async function fileSourceFromBinary(
  source: BinaryFileSource,
  signal?: AbortSignal
): Promise<FileSource> {
  throwIfAborted(signal);
  const bytes = new Uint8Array(await (await toBlob(source.data)).arrayBuffer());
  throwIfAborted(signal);
  return {
    kind: 'file',
    filename: source.filename,
    base64_string: bytesToBase64(bytes),
  };
}

async function normalizeStringSource(
  value: string,
  signal?: AbortSignal
): Promise<NormalizedSource> {
  const scheme = /^([a-z][a-z\d+.-]*):\/\//i.exec(value)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    if (!['http', 'https'].includes(scheme)) {
      throw new DoclingProtocolError(
        `Unsupported document source URL scheme: ${scheme}`
      );
    }
    return normalizeHttpUrl(value);
  }

  let bytes: Uint8Array;
  try {
    const { readFile } = await import('node:fs/promises');
    bytes = await readFile(value, { signal });
  } catch (error) {
    if (signal?.aborted === true) {
      throw abortReason(signal);
    }
    throw new DoclingProtocolError(`Could not read local document: ${value}`, {
      cause: error,
    });
  }
  throwIfAborted(signal);
  const filename = fileNameFromPath(value);
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: guessMimeType(filename),
  });
  return {
    kind: 'multipart',
    blob,
    descriptor: {
      filename,
      source: value,
      format: guessInputFormat(filename),
      file_size: bytes.byteLength,
    },
  };
}

function normalizeHttpUrl(value: string): NormalizedJsonSource {
  validateHttpUrl(value, true);
  const source: HttpSource = { kind: 'http', url: value, headers: {} };
  return {
    kind: 'json',
    source,
    descriptor: describeHttpSource(value),
  };
}

function validateHttpUrl(value: string, rejectZip: boolean): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new DoclingProtocolError('Document source must be a valid URL', {
      cause: error,
    });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new DoclingProtocolError(
      `Unsupported document source URL scheme: ${url.protocol.replace(':', '')}`
    );
  }
  if (rejectZip && url.pathname.toLowerCase().endsWith('.zip')) {
    throw new DoclingProtocolError(
      'ZIP URLs are not accepted on the Docling convert endpoint'
    );
  }
  return url;
}

function describeHttpSource(value: string): ConversionInput {
  const url = validateHttpUrl(value, true);
  const pathParts = url.pathname.split('/').filter(part => part !== '');
  const filename = pathParts.at(-1) ?? 'document';
  return {
    filename,
    source: value,
    format: guessInputFormat(filename),
    file_size: null,
  };
}

function guessInputFormat(filename: string): InputFormat {
  const normalized = filename.toLowerCase();
  const extension =
    ['dclg.xml', 'tar.gz'].find(suffix => normalized.endsWith(`.${suffix}`)) ??
    normalized.split('.').at(-1) ??
    '';
  return EXTENSION_FORMATS[extension] ?? 'pdf';
}

function guessMimeType(filename: string): string {
  const extension = filename.toLowerCase().split('.').at(-1) ?? '';
  return (
    {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      html: 'text/html',
      htm: 'text/html',
      md: 'text/markdown',
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      tif: 'image/tiff',
      tiff: 'image/tiff',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      vtt: 'text/vtt',
      eml: 'message/rfc822',
      epub: 'application/epub+zip',
    }[extension] ?? 'application/octet-stream'
  );
}

const INPUT_FORMATS = new Set<InputFormat>([
  'docx',
  'doc',
  'pptx',
  'html',
  'image',
  'pdf',
  'asciidoc',
  'md',
  'csv',
  'xlsx',
  'xml_uspto',
  'xml_jats',
  'json_docling',
  'dclx',
  'audio',
  'vtt',
  'xml_xbrl',
  'mets_gbs',
  'latex',
  'ppt',
  'xls',
  'odt',
  'ods',
  'odp',
  'xml_doclang',
  'video',
  'email',
  'epub',
  'boxnote',
]);
const OUTPUT_FORMATS = new Set([
  'md',
  'json',
  'yaml',
  'html',
  'html_split_page',
  'text',
  'doctags',
  'vtt',
  'doclang',
  'dclx',
  'chunks',
]);
const PIPELINES = new Set(['legacy', 'standard', 'vlm', 'asr']);
const IMAGE_EXPORT_MODES = new Set(['placeholder', 'embedded', 'referenced']);
const TABLE_MODES = new Set(['fast', 'accurate']);
const PDF_BACKENDS = new Set([
  'pypdfium2',
  'docling_parse',
  'threaded_docling_parse',
  'dlparse_v1',
  'dlparse_v2',
  'dlparse_v4',
]);
const LEGACY_VLM_MODELS = new Set([
  'smoldocling',
  'smoldocling_vllm',
  'granite_vision',
  'granite_vision_vllm',
  'granite_vision_ollama',
  'got_ocr_2',
  'granite_docling',
  'granite_docling_vllm',
  'nanonets_ocr2',
  'nanonets_ocr2_vllm',
  'nanonets_ocr2_lmstudio',
  'glm_ocr',
  'glm_ocr_vllm',
  'lightonocr',
  'lightonocr_vllm',
  'deepseekocr_ollama',
]);
const VLM_RESPONSE_FORMATS = new Set([
  'doctags',
  'doclang',
  'markdown',
  'deepseekocr_markdown',
  'html',
  'otsl',
  'plaintext',
  'chandra_html',
  'dots_json',
]);
const VLM_INFERENCE_FRAMEWORKS = new Set(['mlx', 'transformers', 'vllm']);
const TRANSFORMERS_MODEL_TYPES = new Set([
  'automodel',
  'automodel-causallm',
  'automodel-imagetexttotext',
]);
const PICTURE_CLASSIFICATION_LABELS = new Set([
  'bar_chart',
  'box_plot',
  'flow_chart',
  'line_chart',
  'pie_chart',
  'scatter_plot',
  'table',
  'other_chart',
  'full_page_image',
  'page_thumbnail',
  'photograph',
  'chemistry_structure',
  'bar_code',
  'icon',
  'logo',
  'qr_code',
  'signature',
  'stamp',
  'engineering_drawing',
  'screenshot_from_computer',
  'screenshot_from_manual',
  'geographical_map',
  'topographical_map',
  'calendar',
  'crossword_puzzle',
  'music',
  'other',
  'cad_drawing',
  'electrical_diagram',
  'map',
  'heatmap',
  'chemistry_markush_structure',
  'chemistry_molecular_structure',
  'natural_image',
  'picture_group',
  'remote_sensing',
  'scatter_chart',
  'screenshot',
  'stacked_bar_chart',
  'stratigraphic_chart',
]);
const BOOLEAN_OPTIONS = [
  'do_ocr',
  'force_ocr',
  'table_cell_matching',
  'do_table_structure',
  'include_images',
  'include_page_images',
  'do_code_enrichment',
  'do_formula_enrichment',
  'do_picture_classification',
  'do_chart_extraction',
  'do_picture_description',
  'abort_on_error',
] as const;
const NUMBER_OPTIONS = [
  'document_timeout',
  'images_scale',
  'picture_description_area_threshold',
] as const;
const STRING_OPTIONS = [
  'ocr_engine',
  'ocr_preset',
  'md_page_break_placeholder',
  'vlm_pipeline_preset',
  'picture_description_preset',
  'code_formula_preset',
  'table_structure_preset',
  'layout_preset',
  'picture_classification_preset',
] as const;
const RECORD_OPTIONS = [
  'ocr_custom_config',
  'vlm_pipeline_custom_config',
  'picture_description_custom_config',
  'code_formula_custom_config',
  'table_structure_custom_config',
  'layout_custom_config',
  'picture_classification_custom_config',
  'picture_description_local',
  'picture_description_api',
  'vlm_pipeline_model_local',
  'vlm_pipeline_model_api',
] as const;
const JSON_STRING_CONFIG_OPTIONS = [
  'ocr_custom_config',
  'table_structure_custom_config',
  'layout_custom_config',
  'picture_classification_custom_config',
] as const;

function validateStringEnum<T extends string>(
  value: T | undefined,
  allowed: ReadonlySet<string>,
  name: string
): void {
  if (value !== undefined && !allowed.has(value)) {
    throw new DoclingProtocolError(`${name} contains an unsupported value`);
  }
}

function validateRequiredEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  name: string
): void {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new DoclingProtocolError(`${name} contains an unsupported value`);
  }
}

function validateRequiredString(value: unknown, name: string): void {
  if (typeof value !== 'string') {
    throw new DoclingProtocolError(`${name} must be a string`);
  }
}

function validateOptionalString(value: unknown, name: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new DoclingProtocolError(`${name} must be a string or null`);
  }
}

function validateOptionalEnumArray(
  value: unknown,
  allowed: ReadonlySet<string>,
  name: string
): void {
  if (
    value !== undefined &&
    value !== null &&
    (!Array.isArray(value) ||
      value.some(item => typeof item !== 'string' || !allowed.has(item)))
  ) {
    throw new DoclingProtocolError(`${name} contains an unsupported value`);
  }
}

function validateOptionalRecord(value: unknown, name: string): void {
  if (value !== undefined && value !== null && !isRecord(value)) {
    throw new DoclingProtocolError(`${name} must be an object or null`);
  }
}

function validateOptionalStringRecord(value: unknown, name: string): void {
  if (
    value !== undefined &&
    value !== null &&
    (!isRecord(value) || Object.values(value).some(item => typeof item !== 'string'))
  ) {
    throw new DoclingProtocolError(`${name} must contain string values`);
  }
}

function validateOptionalFiniteNumber(value: unknown, name: string): void {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new DoclingProtocolError(`${name} must be a finite number or null`);
  }
}

function validateOptionalPositiveInteger(value: unknown, name: string): void {
  if (
    value !== undefined &&
    value !== null &&
    (!Number.isSafeInteger(value) || (value as number) < 1)
  ) {
    throw new DoclingProtocolError(`${name} must be a positive integer or null`);
  }
}

function validateAbsoluteUrl(value: unknown, name: string): void {
  if (typeof value !== 'string') {
    throw new DoclingProtocolError(`${name} must be an absolute URL`);
  }
  try {
    const url = new URL(value);
    if (url.protocol === '') {
      throw new Error('missing scheme');
    }
  } catch (error) {
    throw new DoclingProtocolError(`${name} must be an absolute URL`, {
      cause: error,
    });
  }
}

function validateStringEnumArray<T extends string>(
  value: T[] | undefined,
  allowed: ReadonlySet<string>,
  name: string
): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      value.some(item => typeof item !== 'string' || !allowed.has(item)))
  ) {
    throw new DoclingProtocolError(`${name} contains an unsupported value`);
  }
}

function base64ByteLength(value: string): number {
  const normalized = value.replace(/\s/g, '');
  if (normalized === '') {
    return 0;
  }
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

async function toBlob(
  data: Blob | ArrayBuffer | ArrayBufferView,
  contentType = 'application/octet-stream'
): Promise<Blob> {
  if (data instanceof Blob) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: contentType });
  }
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Blob([Uint8Array.from(bytes).buffer], { type: contentType });
}

function isHttpSource(value: unknown): value is HttpSource {
  return isRecord(value) && value.kind === 'http' && typeof value.url === 'string';
}

function isFileSource(value: unknown): value is FileSource {
  return (
    isRecord(value) &&
    value.kind === 'file' &&
    typeof value.base64_string === 'string' &&
    typeof value.filename === 'string'
  );
}

function isBinaryFileSource(value: unknown): value is BinaryFileSource {
  return (
    isRecord(value) &&
    typeof value.filename === 'string' &&
    'data' in value &&
    (value.data instanceof Blob ||
      value.data instanceof ArrayBuffer ||
      ArrayBuffer.isView(value.data))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw abortReason(signal);
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

function fileNameFromPath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  return normalized.split('/').at(-1) || 'document';
}

function validatePageRange(value: unknown): asserts value is [number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !Number.isSafeInteger(value[0]) ||
    !Number.isSafeInteger(value[1]) ||
    value[0] < 1 ||
    value[1] < value[0]
  ) {
    throw new DoclingProtocolError(
      'pageRange must contain positive integers with end >= start'
    );
  }
}

function validateNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DoclingProtocolError(`${name} must be a non-negative safe integer`);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
