import {
  ArtifactDownloader,
  type ArtifactDownloaderOptions,
  materializePresignedResult,
} from './artifacts';
import {
  DoclingConversionError,
  DoclingHttpError,
  DoclingProtocolError,
  DoclingResponseSchemaMismatchError,
  DoclingResultExpiredError,
  DoclingResultNotReadyError,
  DoclingServiceError,
  DoclingTaskError,
  DoclingTaskNotFoundError,
  DoclingTimeoutError,
} from './errors';
import { boundedOutcomes, validateConcurrency } from './scheduler';
import {
  appendFormValue,
  applyPageLimits,
  normalizeSourceInput,
  preflightFileSize,
  resolveConvertOptions,
  validateConvertOptions,
  validateMaxFileSize,
  withJsonOutput,
  type NormalizedSource,
} from './sources';
import {
  FetchTransport,
  type DoclingBinaryResponse,
  type DoclingRequestBodyType,
  type DoclingResponseType,
  type DoclingTransport,
  type DoclingTransportRequest,
  type FetchLike,
} from './transport';
import type {
  AutoSubmitResult,
  BatchConvertSourcesRequest,
  BatchResultForTarget,
  BatchTarget,
  BinaryFileSource,
  CallbackSpec,
  ChunkDocumentResponse,
  ChunkerKind,
  ChunkSourceOptions,
  ChunkSourcesRequest,
  ConfidenceScores,
  ConversionInput,
  ConversionItem,
  ConversionResult,
  ConversionSource,
  ConversionSourceInput,
  ConvertDocumentsOptions,
  ConvertDocumentResponse,
  ConvertSourcesRequest,
  DoclingDocument,
  ErrorItem,
  FailureCategory,
  FileSource,
  HealthCheckResponse,
  HttpSource,
  InBodyConversionResponse,
  InBodyTarget,
  PresignedUrlConvertDocumentResponse,
  PresignedUrlConvertResponse,
  PresignedUrlTarget,
  ProfilingItem,
  PublicFailureInfo,
  RawServiceResult,
  SubmitAndRetrieveOptions,
  SubmitResultForTarget,
  SubmitTarget,
  TaskFailureResult,
  TaskStatusResponse,
  WaitForTaskOptions,
} from './types';
import { watchTask, type StatusWatcherKind, type WebSocketFactory } from './watchers';

const DEFAULT_JOB_TIMEOUT_MS = 300_000;
export const DEFAULT_MAX_CONCURRENCY = 8;
export const MAX_CONCURRENCY_LIMIT = 512;

export interface DoclingClientOptions {
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  transport?: DoclingTransport;
  fetch?: FetchLike;
  httpRetries?: number;
  httpTimeoutMs?: number;
  httpBackoffBaseMs?: number;
  options?: ConvertDocumentsOptions;
  statusWatcher?: StatusWatcherKind;
  webSocketFallbackToPoll?: boolean;
  webSocketFactory?: WebSocketFactory;
  connectTimeoutMs?: number;
  pollServerWaitSeconds?: number;
  pollClientIntervalMs?: number;
  jobTimeoutMs?: number;
  maxConcurrency?: number;
  artifactDownloader?: ArtifactDownloader;
  artifactDownload?: ArtifactDownloaderOptions;
}

export interface SubmitCallOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface BatchSubmitCallOptions extends SubmitCallOptions {
  outputFormats?: ConvertDocumentsOptions['to_formats'];
}

export interface SubmitSourceOptions<
  TTarget extends SubmitTarget = SubmitTarget,
> extends SubmitCallOptions {
  options?: ConvertDocumentsOptions;
  outputFormats?: ConvertDocumentsOptions['to_formats'];
  target?: TTarget;
  callbacks?: CallbackSpec[];
}

export interface ConvertOptions extends WaitForTaskOptions {
  options?: ConvertDocumentsOptions;
  headers?: Record<string, string>;
  maxNumPages?: number;
  maxFileSize?: number;
  pageRange?: [number, number];
  raisesOnError?: boolean;
}

export interface ConvertAllOptions extends Omit<ConvertOptions, 'raisesOnError'> {
  maxConcurrency?: number;
}

export interface ChunkCallOptions extends WaitForTaskOptions {
  includeConvertedDoc?: boolean;
}

type AnySubmitResult<TDocument> =
  | AutoSubmitResult<TDocument>
  | RawServiceResult
  | PresignedUrlConvertDocumentResponse;

export class DoclingClient<TDocument = DoclingDocument> {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #headers: Readonly<Record<string, string>>;
  readonly #transport: DoclingTransport;
  readonly #defaultOptions: ConvertDocumentsOptions;
  readonly #statusWatcher: StatusWatcherKind;
  readonly #webSocketFallbackToPoll: boolean;
  readonly #webSocketFactory: WebSocketFactory | undefined;
  readonly #connectTimeoutMs: number;
  readonly #pollServerWaitSeconds: number;
  readonly #pollClientIntervalMs: number;
  readonly #jobTimeoutMs: number;
  readonly #maxConcurrency: number;
  readonly #artifactDownloader: ArtifactDownloader;
  #closed = false;

  constructor(options: DoclingClientOptions) {
    this.#baseUrl = normalizeBaseUrl(options.baseUrl);
    this.#apiKey = options.apiKey ?? '';
    this.#headers = {
      accept: 'application/json',
      ...normalizeHeaders(options.headers),
      ...(this.#apiKey === '' ? {} : { 'x-api-key': this.#apiKey }),
    };
    if (
      options.transport !== undefined &&
      (options.fetch !== undefined ||
        options.httpRetries !== undefined ||
        options.httpTimeoutMs !== undefined ||
        options.httpBackoffBaseMs !== undefined)
    ) {
      throw new DoclingProtocolError(
        'fetch/http retry options cannot be combined with a custom transport'
      );
    }
    this.#transport =
      options.transport ??
      new FetchTransport({
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.httpRetries === undefined ? {} : { retries: options.httpRetries }),
        ...(options.httpTimeoutMs === undefined
          ? {}
          : { timeoutMs: options.httpTimeoutMs }),
        ...(options.httpBackoffBaseMs === undefined
          ? {}
          : { backoffBaseMs: options.httpBackoffBaseMs }),
      });
    this.#defaultOptions = resolveConvertOptions({}, options.options);
    this.#statusWatcher = options.statusWatcher ?? 'websocket';
    this.#webSocketFallbackToPoll = options.webSocketFallbackToPoll ?? true;
    this.#webSocketFactory = options.webSocketFactory;
    this.#connectTimeoutMs = positiveNumber(
      options.connectTimeoutMs ?? 10_000,
      'connectTimeoutMs'
    );
    this.#pollServerWaitSeconds = nonNegativeNumber(
      options.pollServerWaitSeconds ?? 5,
      'pollServerWaitSeconds'
    );
    this.#pollClientIntervalMs = nonNegativeNumber(
      options.pollClientIntervalMs ?? this.#pollServerWaitSeconds * 1_000,
      'pollClientIntervalMs'
    );
    this.#jobTimeoutMs = positiveNumber(
      options.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS,
      'jobTimeoutMs'
    );
    this.#maxConcurrency = validateConcurrency(
      options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY
    );
    this.#artifactDownloader =
      options.artifactDownloader ?? new ArtifactDownloader(options.artifactDownload);
  }

  async health(options: { signal?: AbortSignal } = {}): Promise<HealthCheckResponse> {
    const value = await this.#request<unknown>('GET', '/health', {
      signal: options.signal,
      retries: 0,
    });
    if (!isRecord(value)) {
      throw new DoclingResponseSchemaMismatchError(
        'Docling health response must be an object',
        { status: 200 }
      );
    }
    if (value.status !== undefined && typeof value.status !== 'string') {
      throw new DoclingResponseSchemaMismatchError(
        'Docling health response status must be a string',
        { status: 200 }
      );
    }
    return { status: value.status ?? 'ok' };
  }

  async version(
    options: { signal?: AbortSignal } = {}
  ): Promise<Record<string, unknown>> {
    const value = await this.#request<unknown>('GET', '/version', {
      signal: options.signal,
      retries: 0,
    });
    if (!isRecord(value)) {
      throw new DoclingResponseSchemaMismatchError(
        'Docling version response must be an object',
        { status: 200 }
      );
    }
    return value;
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    await this.#transport.close?.();
  }

  async submit<TTarget extends SubmitTarget>(
    request: ConvertSourcesRequest<TTarget> & { target: TTarget },
    options?: SubmitCallOptions
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>>;
  async submit(
    request: ConvertSourcesRequest,
    options?: SubmitCallOptions
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  async submit(
    request: ConvertSourcesRequest,
    options: SubmitCallOptions = {}
  ): Promise<DoclingJob<AnySubmitResult<TDocument>>> {
    if (!Array.isArray(request.sources) || request.sources.length !== 1) {
      throw new DoclingProtocolError(
        'A single Docling submission requires exactly one source'
      );
    }
    const resolvedOptions = resolveConvertOptions(
      this.#defaultOptions,
      request.options
    );
    if (request.target === undefined) {
      return this.#submitWithAutoTarget(
        {
          ...request,
          options: resolvedOptions,
        },
        options
      );
    }
    return this.#submitRequestForTarget(
      {
        ...request,
        options: targetNeedsJson(request.target)
          ? withJsonOutput(resolvedOptions)
          : resolvedOptions,
        target: request.target,
      },
      options
    );
  }

  async submitSource<TTarget extends SubmitTarget>(
    source: ConversionSourceInput,
    options: SubmitSourceOptions<TTarget> & { target: TTarget }
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>>;
  async submitSource(
    source: ConversionSourceInput,
    options?: SubmitSourceOptions
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  async submitSource(
    source: ConversionSourceInput,
    options: SubmitSourceOptions = {}
  ): Promise<DoclingJob<AnySubmitResult<TDocument>>> {
    const normalized = await normalizeSourceInput(source, options.signal);
    let convertOptions = resolveConvertOptions(this.#defaultOptions, options.options);
    if (options.outputFormats !== undefined) {
      convertOptions = {
        ...convertOptions,
        to_formats: [...options.outputFormats],
      };
      validateConvertOptions(convertOptions);
    }
    if (options.target === undefined) {
      return this.#submitNormalizedWithAutoTarget(normalized, convertOptions, options);
    }
    return this.#submitNormalizedForTarget(
      normalized,
      targetNeedsJson(options.target) ? withJsonOutput(convertOptions) : convertOptions,
      options.target,
      options
    );
  }

  submitUrl<TTarget extends SubmitTarget>(
    url: string,
    options: ConvertDocumentsOptions,
    requestOptions: SubmitCallOptions & {
      sourceHeaders?: Record<string, unknown>;
      target: TTarget;
    }
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>>;
  submitUrl(
    url: string,
    options?: ConvertDocumentsOptions,
    requestOptions?: SubmitCallOptions & {
      sourceHeaders?: Record<string, unknown>;
      target?: undefined;
    }
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  submitUrl(
    url: string,
    options: ConvertDocumentsOptions = {},
    requestOptions: SubmitCallOptions & {
      sourceHeaders?: Record<string, unknown>;
      target?: SubmitTarget;
    } = {}
  ): Promise<DoclingJob<AnySubmitResult<TDocument>>> {
    const source: HttpSource = {
      kind: 'http',
      url,
      headers: requestOptions.sourceHeaders ?? {},
    };
    return this.submitSource(source, {
      options,
      ...(requestOptions.target === undefined ? {} : { target: requestOptions.target }),
      ...(requestOptions.headers === undefined
        ? {}
        : { headers: requestOptions.headers }),
      ...(requestOptions.signal === undefined ? {} : { signal: requestOptions.signal }),
    }) as Promise<DoclingJob<AnySubmitResult<TDocument>>>;
  }

  submitFile<TTarget extends SubmitTarget>(
    base64: string,
    filename: string,
    options: ConvertDocumentsOptions,
    requestOptions: SubmitCallOptions & { target: TTarget }
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>>;
  submitFile(
    base64: string,
    filename: string,
    options?: ConvertDocumentsOptions,
    requestOptions?: SubmitCallOptions & { target?: undefined }
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  submitFile(
    base64: string,
    filename: string,
    options: ConvertDocumentsOptions = {},
    requestOptions: SubmitCallOptions & { target?: SubmitTarget } = {}
  ): Promise<DoclingJob<AnySubmitResult<TDocument>>> {
    const source: FileSource = {
      kind: 'file',
      base64_string: base64,
      filename,
    };
    return this.submitSource(source, {
      options,
      ...requestOptions,
    }) as Promise<DoclingJob<AnySubmitResult<TDocument>>>;
  }

  submitBinary<TTarget extends SubmitTarget>(
    source: BinaryFileSource,
    options: SubmitSourceOptions<TTarget> & { target: TTarget }
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>>;
  submitBinary(
    source: BinaryFileSource,
    options?: SubmitSourceOptions & { target?: undefined }
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  submitBinary(
    source: BinaryFileSource,
    options: SubmitSourceOptions = {}
  ): Promise<DoclingJob<AnySubmitResult<TDocument>>> {
    return this.submitSource(source, options);
  }

  async submitBatch<TTarget extends BatchTarget>(
    request: BatchConvertSourcesRequest<TTarget>,
    options: BatchSubmitCallOptions = {}
  ): Promise<DoclingJob<BatchResultForTarget<TTarget>>> {
    throwIfAborted(options.signal);
    validateBatchRequest(request);
    let convertOptions = resolveConvertOptions(this.#defaultOptions, request.options);
    if (options.outputFormats !== undefined) {
      convertOptions = {
        ...convertOptions,
        to_formats: [...options.outputFormats],
      };
      validateConvertOptions(convertOptions);
    }
    const payload: BatchConvertSourcesRequest<TTarget> = {
      options: convertOptions,
      sources: structuredClone(request.sources),
      target: structuredClone(request.target),
      callbacks: structuredClone(request.callbacks ?? []),
    };
    throwIfAborted(options.signal);
    const status = parseTaskStatus(
      await this.#request<unknown>('POST', '/v1/convert/source/batch', {
        body: payload,
        headers: options.headers,
        signal: options.signal,
      })
    );
    const loader = isPresignedTarget(request.target)
      ? (
          taskId: string,
          lastStatus: TaskStatusResponse | undefined,
          signal?: AbortSignal
        ) => this.#fetchPresignedResult(taskId, lastStatus, signal)
      : (
          taskId: string,
          lastStatus: TaskStatusResponse | undefined,
          signal?: AbortSignal
        ) => this.#fetchCountsResult(taskId, lastStatus, signal);
    return new DoclingJob(
      this,
      status,
      loader as ResultLoader<BatchResultForTarget<TTarget>>
    );
  }

  async submitChunk(
    request: ChunkSourcesRequest,
    options: SubmitCallOptions = {}
  ): Promise<DoclingJob<ChunkDocumentResponse<TDocument>>> {
    throwIfAborted(options.signal);
    if (!Array.isArray(request.sources) || request.sources.length === 0) {
      throw new DoclingProtocolError('At least one Docling source is required');
    }
    if (!['hybrid', 'hierarchical'].includes(request.chunker)) {
      throw new DoclingProtocolError(
        `Unsupported Docling chunker: ${String(request.chunker)}`
      );
    }
    validateChunkRequestOptions(request);
    for (const source of request.sources) {
      validateConversionSource(source);
    }
    validateCallbacks(request.callbacks);
    if (request.target !== undefined && request.target.kind !== 'inbody') {
      throw new DoclingProtocolError('Chunk conversion only supports inbody targets');
    }
    const payload = {
      convert_options: resolveConvertOptions(
        this.#defaultOptions,
        request.convert_options
      ),
      chunking_options: {
        ...request.chunking_options,
        chunker: request.chunker,
      },
      sources: structuredClone(request.sources),
      include_converted_doc: request.include_converted_doc ?? false,
      target: request.target ?? { kind: 'inbody' },
      callbacks: structuredClone(request.callbacks ?? []),
    };
    throwIfAborted(options.signal);
    const status = parseTaskStatus(
      await this.#request<unknown>(
        'POST',
        `/v1/chunk/${request.chunker}/source/async`,
        {
          body: payload,
          headers: options.headers,
          signal: options.signal,
        }
      )
    );
    return new DoclingJob(this, status, (taskId, lastStatus, signal) =>
      this.#fetchChunkResult(taskId, lastStatus, signal)
    );
  }

  submitChunkUrl(
    url: string,
    request: ChunkSourceOptions,
    requestOptions: SubmitCallOptions & {
      sourceHeaders?: Record<string, unknown>;
    } = {}
  ): Promise<DoclingJob<ChunkDocumentResponse<TDocument>>> {
    return this.submitChunk(
      {
        ...request,
        sources: [
          {
            kind: 'http',
            url,
            headers: requestOptions.sourceHeaders ?? {},
          },
        ],
      } as ChunkSourcesRequest,
      requestOptions
    );
  }

  submitChunkFile(
    base64: string,
    filename: string,
    request: ChunkSourceOptions,
    requestOptions: SubmitCallOptions = {}
  ): Promise<DoclingJob<ChunkDocumentResponse<TDocument>>> {
    return this.submitChunk(
      {
        ...request,
        sources: [
          {
            kind: 'file',
            base64_string: base64,
            filename,
          },
        ],
      } as ChunkSourcesRequest,
      requestOptions
    );
  }

  async submitChunkBinary(
    source: BinaryFileSource,
    request: ChunkSourceOptions,
    requestOptions: SubmitCallOptions = {}
  ): Promise<DoclingJob<ChunkDocumentResponse<TDocument>>> {
    if (!['hybrid', 'hierarchical'].includes(request.chunker)) {
      throw new DoclingProtocolError(
        `Unsupported Docling chunker: ${String(request.chunker)}`
      );
    }
    validateChunkRequestOptions(request);
    if ((request.callbacks?.length ?? 0) > 0) {
      throw new DoclingProtocolError(
        'The multipart chunk endpoint does not support callbacks'
      );
    }
    const normalized = await normalizeSourceInput(source, requestOptions.signal);
    if (normalized.kind !== 'multipart') {
      throw new DoclingProtocolError('Binary chunk source normalization failed');
    }
    const form = new FormData();
    const convertOptions = resolveConvertOptions(
      this.#defaultOptions,
      request.convert_options
    );
    for (const [key, value] of Object.entries(convertOptions)) {
      if (value !== undefined && value !== null) {
        appendFormValue(form, `convert_${key}`, value);
      }
    }
    for (const [key, value] of Object.entries(request.chunking_options ?? {})) {
      if (key !== 'chunker' && value !== undefined && value !== null) {
        appendFormValue(form, `chunking_${key}`, value);
      }
    }
    form.append(
      'include_converted_doc',
      String(request.include_converted_doc ?? false)
    );
    form.append('target_type', 'inbody');
    form.append('files', normalized.blob, normalized.descriptor.filename);
    const status = parseTaskStatus(
      await this.#request<unknown>('POST', `/v1/chunk/${request.chunker}/file/async`, {
        body: form,
        bodyType: 'form',
        headers: requestOptions.headers,
        signal: requestOptions.signal,
      })
    );
    return new DoclingJob(this, status, (taskId, lastStatus, signal) =>
      this.#fetchChunkResult(taskId, lastStatus, signal)
    );
  }

  job<TResult = InBodyConversionResponse<TDocument>>(
    taskId: string,
    status?: TaskStatusResponse,
    resultLoader?: ResultLoader<TResult>
  ): DoclingJob<TResult> {
    if (taskId === '') {
      throw new DoclingProtocolError('taskId must not be empty');
    }
    return new DoclingJob(
      this,
      status ?? {
        task_id: taskId,
        task_type: 'convert',
        task_status: 'pending',
      },
      resultLoader ??
        ((id, lastStatus, signal) =>
          this.#fetchInBodyResult(id, lastStatus, signal) as Promise<TResult>)
    );
  }

  async poll(
    taskId: string,
    options: { waitSeconds?: number; signal?: AbortSignal } = {}
  ): Promise<TaskStatusResponse> {
    requireTaskId(taskId);
    const waitSeconds = nonNegativeNumber(options.waitSeconds ?? 0, 'waitSeconds');
    try {
      return parseTaskStatus(
        await this.#request<unknown>(
          'GET',
          `/v1/status/poll/${encodeURIComponent(taskId)}?wait=${encodeURIComponent(
            waitSeconds
          )}`,
          { signal: options.signal }
        )
      );
    } catch (error) {
      if (error instanceof DoclingHttpError && error.status === 404) {
        throw new DoclingTaskNotFoundError(taskId);
      }
      throw error;
    }
  }

  watch(
    taskId: string,
    options: WaitForTaskOptions = {}
  ): AsyncGenerator<TaskStatusResponse> {
    if (this.#closed) {
      throw new DoclingProtocolError('Docling client is closed');
    }
    requireTaskId(taskId);
    return watchTask({
      taskId,
      baseUrl: this.#baseUrl,
      apiKey: this.#apiKey,
      watcher: options.statusWatcher ?? this.#statusWatcher,
      fallbackToPoll: this.#webSocketFallbackToPoll,
      connectTimeoutMs: this.#connectTimeoutMs,
      ...(this.#webSocketFactory === undefined
        ? {}
        : { webSocketFactory: this.#webSocketFactory }),
      poll: (id, pollOptions) => this.poll(id, pollOptions),
      parseStatus: parseTaskStatus,
      timeoutMs: options.timeoutMs ?? this.#jobTimeoutMs,
      pollIntervalMs: options.pollIntervalMs ?? this.#pollClientIntervalMs,
      serverWaitSeconds: options.serverWaitSeconds ?? this.#pollServerWaitSeconds,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.onStatus === undefined ? {} : { onStatus: options.onStatus }),
    });
  }

  async waitForCompletion(
    taskId: string,
    options: WaitForTaskOptions = {}
  ): Promise<TaskStatusResponse> {
    let lastStatus: TaskStatusResponse | undefined;
    for await (const status of this.watch(taskId, options)) {
      lastStatus = status;
    }
    if (lastStatus === undefined) {
      throw new DoclingTimeoutError(taskId, options.timeoutMs ?? this.#jobTimeoutMs);
    }
    return lastStatus;
  }

  getResult(
    taskId: string,
    options: { signal?: AbortSignal; lastStatus?: TaskStatusResponse } = {}
  ): Promise<InBodyConversionResponse<TDocument>> {
    return this.#fetchInBodyResult(taskId, options.lastStatus, options.signal);
  }

  getBinaryResult(
    taskId: string,
    options: { signal?: AbortSignal; lastStatus?: TaskStatusResponse } = {}
  ): Promise<RawServiceResult> {
    return this.#fetchBinaryResult(taskId, options.lastStatus, options.signal);
  }

  getRawResult<TResult = unknown>(
    taskId: string,
    options: { signal?: AbortSignal; lastStatus?: TaskStatusResponse } = {}
  ): Promise<TResult> {
    return this.#fetchJsonResult(
      taskId,
      options.lastStatus,
      options.signal
    ) as Promise<TResult>;
  }

  async convert(
    source: ConversionSourceInput,
    options: ConvertOptions = {}
  ): Promise<ConversionResult<TDocument>> {
    const normalized = await normalizeSourceInput(source, options.signal);
    validateMaxFileSize(options.maxFileSize);
    let convertOptions = resolveConvertOptions(this.#defaultOptions, options.options);
    convertOptions = applyPageLimits(
      convertOptions,
      options.pageRange,
      options.maxNumPages
    );
    convertOptions = withJsonOutput(convertOptions);
    const preflight = preflightFileSize(normalized, options.maxFileSize);
    let result: ConversionResult<TDocument>;
    if (preflight !== null) {
      result = syntheticConversion(
        normalized.descriptor,
        'skipped',
        preflight,
        'policy'
      );
    } else {
      const job = await this.#submitNormalizedWithAutoTarget(
        normalized,
        convertOptions,
        options
      );
      const response = await job.result(options);
      result = isPresignedResponse(response)
        ? await materializePresignedResult(
            response,
            normalized.descriptor,
            this.#artifactDownloader,
            options.signal
          )
        : response;
    }

    if (
      (options.raisesOnError ?? true) &&
      !['success', 'partial_success'].includes(result.status)
    ) {
      throw new DoclingConversionError(conversionFailureMessage(result));
    }
    return result;
  }

  async *convertAll(
    sources: Iterable<ConversionSourceInput> | AsyncIterable<ConversionSourceInput>,
    options: ConvertAllOptions = {}
  ): AsyncGenerator<ConversionResult<TDocument>> {
    const items = mapSourcesToItems(sources, options.options, options.headers);
    for await (const completed of boundedOutcomes(
      items,
      async (item, _index, signal) => {
        try {
          return await this.convert(item.source, {
            ...options,
            options: item.options,
            headers: item.headers,
            raisesOnError: false,
            signal,
          });
        } catch (error) {
          if (signal.aborted || isAbortError(error)) {
            throw signal.reason ?? error;
          }
          return syntheticConversion<TDocument>(
            fallbackInput(item.source),
            'failure',
            error instanceof Error ? error.message : String(error)
          );
        }
      },
      {
        maxInFlight: validateConcurrency(
          options.maxConcurrency ?? this.#maxConcurrency
        ),
        ordered: true,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }
    )) {
      if (completed.outcome instanceof Error) {
        yield syntheticConversion<TDocument>(
          fallbackInput(completed.item.source),
          'failure',
          completed.outcome.message
        );
      } else {
        yield completed.outcome;
      }
    }
  }

  submitAndRetrieveEach<TMetadata = unknown>(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options?: Omit<SubmitAndRetrieveOptions<PresignedUrlTarget>, 'target'> & {
      target?: undefined;
    }
  ): AsyncGenerator<
    [ConversionItem & { metadata?: TMetadata }, AutoSubmitResult<TDocument> | Error]
  >;
  submitAndRetrieveEach<
    TMetadata = unknown,
    TTarget extends SubmitTarget = SubmitTarget,
  >(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options: SubmitAndRetrieveOptions<TTarget> & { target: TTarget }
  ): AsyncGenerator<
    [
      ConversionItem & { metadata?: TMetadata },
      SubmitResultForTarget<TTarget, TDocument> | Error,
    ]
  >;
  async *submitAndRetrieveEach<
    TMetadata = unknown,
    TTarget extends SubmitTarget = SubmitTarget,
  >(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options: SubmitAndRetrieveOptions<TTarget> = {}
  ): AsyncGenerator<
    [
      ConversionItem & { metadata?: TMetadata },
      AutoSubmitResult<TDocument> | SubmitResultForTarget<TTarget, TDocument> | Error,
    ]
  > {
    const maxInFlight = validateConcurrency(
      options.maxInFlight ?? DEFAULT_MAX_CONCURRENCY
    );
    for await (const completed of boundedOutcomes(
      items,
      async (item, _index, signal) => {
        const job = await this.submitSource(item.source, {
          options: item.options,
          ...(item.headers === undefined ? {} : { headers: item.headers }),
          ...(options.target === undefined ? {} : { target: options.target }),
          signal,
        });
        return job.result({
          timeoutMs: this.#jobTimeoutMs,
          ...(maxInFlight > 64 && this.#statusWatcher === 'websocket'
            ? { statusWatcher: 'polling' as const }
            : {}),
          signal,
        }) as Promise<
          AutoSubmitResult<TDocument> | SubmitResultForTarget<TTarget, TDocument>
        >;
      },
      {
        maxInFlight,
        ordered: options.ordered ?? false,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }
    )) {
      yield [completed.item, completed.outcome];
    }
  }

  /** @deprecated Use submitAndRetrieveEach instead. */
  submitAndRetrieveMany<TMetadata = unknown>(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options?: Omit<SubmitAndRetrieveOptions<PresignedUrlTarget>, 'target'> & {
      target?: undefined;
    }
  ): AsyncGenerator<
    [ConversionItem & { metadata?: TMetadata }, AutoSubmitResult<TDocument> | Error]
  >;
  submitAndRetrieveMany<
    TMetadata = unknown,
    TTarget extends SubmitTarget = SubmitTarget,
  >(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options: SubmitAndRetrieveOptions<TTarget> & { target: TTarget }
  ): AsyncGenerator<
    [
      ConversionItem & { metadata?: TMetadata },
      SubmitResultForTarget<TTarget, TDocument> | Error,
    ]
  >;
  submitAndRetrieveMany<
    TMetadata = unknown,
    TTarget extends SubmitTarget = SubmitTarget,
  >(
    items:
      | Iterable<ConversionItem & { metadata?: TMetadata }>
      | AsyncIterable<ConversionItem & { metadata?: TMetadata }>,
    options: SubmitAndRetrieveOptions<TTarget> = {}
  ): AsyncGenerator<
    [
      ConversionItem & { metadata?: TMetadata },
      AutoSubmitResult<TDocument> | SubmitResultForTarget<TTarget, TDocument> | Error,
    ]
  > {
    return this.submitAndRetrieveEach(
      items,
      options as SubmitAndRetrieveOptions<PresignedUrlTarget> & {
        target?: undefined;
      }
    );
  }

  async chunk(
    request: ChunkSourcesRequest,
    waitOptions?: WaitForTaskOptions
  ): Promise<ChunkDocumentResponse<TDocument>>;
  async chunk(
    source: ConversionSourceInput,
    request: ChunkSourceOptions,
    waitOptions?: WaitForTaskOptions
  ): Promise<ChunkDocumentResponse<TDocument>>;
  async chunk(
    source: ConversionSourceInput,
    chunker: ChunkerKind,
    options?: ConvertDocumentsOptions,
    waitOptions?: ChunkCallOptions
  ): Promise<ChunkDocumentResponse<TDocument>>;
  async chunk(
    sourceOrRequest: ConversionSourceInput | ChunkSourcesRequest,
    chunkerOrOptions: ChunkSourceOptions | ChunkerKind | WaitForTaskOptions = {},
    convertOrWaitOptions: ConvertDocumentsOptions | WaitForTaskOptions = {},
    explicitWaitOptions: ChunkCallOptions = {}
  ): Promise<ChunkDocumentResponse<TDocument>> {
    if (isChunkSourcesRequest(sourceOrRequest)) {
      const job = await this.submitChunk(sourceOrRequest, {
        signal: (chunkerOrOptions as WaitForTaskOptions).signal,
      });
      return job.result(chunkerOrOptions as WaitForTaskOptions);
    }
    const pythonShaped = typeof chunkerOrOptions === 'string';
    const request: ChunkSourceOptions = pythonShaped
      ? {
          chunker: chunkerOrOptions,
          convert_options: convertOrWaitOptions as ConvertDocumentsOptions,
          include_converted_doc: explicitWaitOptions.includeConvertedDoc ?? false,
        }
      : (chunkerOrOptions as ChunkSourceOptions);
    const waitOptions = pythonShaped
      ? explicitWaitOptions
      : (convertOrWaitOptions as WaitForTaskOptions);
    const normalized = await normalizeSourceInput(sourceOrRequest, waitOptions.signal);
    const job =
      normalized.kind === 'multipart'
        ? await this.submitChunkBinary(
            {
              data: normalized.blob,
              filename: normalized.descriptor.filename,
              contentType: normalized.blob.type,
            },
            request,
            { signal: waitOptions.signal }
          )
        : await this.submitChunk(
            {
              ...request,
              sources: [normalized.source],
            } as ChunkSourcesRequest,
            { signal: waitOptions.signal }
          );
    return job.result(waitOptions);
  }

  #submitWithAutoTarget(
    request: ConvertSourcesRequest,
    options: SubmitCallOptions
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>> {
    return this.#submitRequestForTarget(
      {
        ...request,
        options: request.options ?? {},
        target: { kind: 'presigned_url' },
      },
      options
    ).catch(error => {
      if (!shouldFallbackFromPresigned(error)) {
        throw error;
      }
      return this.#submitRequestForTarget(
        {
          ...request,
          options: withJsonOutput(request.options ?? {}),
          target: { kind: 'inbody' },
        },
        options
      );
    }) as Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  }

  #submitNormalizedWithAutoTarget(
    source: NormalizedSource,
    options: ConvertDocumentsOptions,
    requestOptions: SubmitCallOptions
  ): Promise<DoclingJob<AutoSubmitResult<TDocument>>> {
    return this.#submitNormalizedForTarget(
      source,
      options,
      { kind: 'presigned_url' },
      requestOptions
    ).catch(error => {
      if (!shouldFallbackFromPresigned(error)) {
        throw error;
      }
      return this.#submitNormalizedForTarget(
        source,
        withJsonOutput(options),
        { kind: 'inbody' },
        requestOptions
      );
    }) as Promise<DoclingJob<AutoSubmitResult<TDocument>>>;
  }

  async #submitRequestForTarget<TTarget extends SubmitTarget>(
    request: ConvertSourcesRequest<TTarget> & { target: TTarget },
    options: SubmitCallOptions
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>> {
    validateConversionSource(request.sources[0]);
    validateSubmitTarget(request.target);
    validateCallbacks(request.callbacks);
    const descriptor = (await normalizeSourceInput(request.sources[0], options.signal))
      .descriptor;
    const payload = {
      options: request.options ?? {},
      sources: structuredClone(request.sources),
      target: structuredClone(request.target),
      callbacks: structuredClone(request.callbacks ?? []),
    };
    throwIfAborted(options.signal);
    const status = parseTaskStatus(
      await this.#request<unknown>('POST', '/v1/convert/source/async', {
        body: payload,
        headers: options.headers,
        signal: options.signal,
      })
    );
    return new DoclingJob(
      this,
      status,
      this.#resultLoaderForTarget(request.target, descriptor)
    );
  }

  async #submitNormalizedForTarget<TTarget extends SubmitTarget>(
    source: NormalizedSource,
    options: ConvertDocumentsOptions,
    target: TTarget,
    requestOptions: SubmitCallOptions & { callbacks?: CallbackSpec[] }
  ): Promise<DoclingJob<SubmitResultForTarget<TTarget, TDocument>>> {
    const callbacks = requestOptions.callbacks ?? [];
    if (source.kind === 'json') {
      return this.#submitRequestForTarget(
        {
          options,
          sources: [source.source],
          target,
          callbacks,
        },
        requestOptions
      );
    }
    if (!['inbody', 'zip', 'presigned_url'].includes(target.kind)) {
      const fileSource = await fileSourceFromBlob(source, requestOptions.signal);
      return this.#submitRequestForTarget(
        {
          options,
          sources: [fileSource],
          target,
          callbacks,
        },
        requestOptions
      );
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined && value !== null) {
        appendFormValue(form, key, value);
      }
    }
    validateCallbacks(callbacks);
    for (const callback of callbacks) {
      form.append('callbacks', JSON.stringify(callback));
    }
    form.append('target_type', target.kind);
    form.append('files', source.blob, source.descriptor.filename);
    const status = parseTaskStatus(
      await this.#request<unknown>('POST', '/v1/convert/file/async', {
        body: form,
        bodyType: 'form',
        headers: requestOptions.headers,
        signal: requestOptions.signal,
      })
    );
    return new DoclingJob(
      this,
      status,
      this.#resultLoaderForTarget(target, source.descriptor)
    );
  }

  #resultLoaderForTarget<TTarget extends SubmitTarget>(
    target: TTarget,
    descriptor: ConversionInput
  ): ResultLoader<SubmitResultForTarget<TTarget, TDocument>> {
    if (target.kind === 'zip') {
      return ((taskId, lastStatus, signal) =>
        this.#fetchBinaryResult(taskId, lastStatus, signal)) as ResultLoader<
        SubmitResultForTarget<TTarget, TDocument>
      >;
    }
    if (target.kind === 'presigned_url') {
      return ((taskId, lastStatus, signal) =>
        this.#fetchPresignedResult(taskId, lastStatus, signal)) as ResultLoader<
        SubmitResultForTarget<TTarget, TDocument>
      >;
    }
    if (target.kind !== 'inbody') {
      return ((taskId, lastStatus, signal) =>
        this.#fetchCountsResult(taskId, lastStatus, signal)) as ResultLoader<
        SubmitResultForTarget<TTarget, TDocument>
      >;
    }
    return (async (taskId, lastStatus, signal) =>
      conversionFromResponse(
        await this.#fetchConvertResult(taskId, lastStatus, signal),
        descriptor
      )) as ResultLoader<SubmitResultForTarget<TTarget, TDocument>>;
  }

  async #fetchJsonResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<unknown> {
    requireTaskId(taskId);
    try {
      const result = await this.#request<unknown>(
        'GET',
        `/v1/result/${encodeURIComponent(taskId)}`,
        { signal }
      );
      if (isTaskFailureResult(result)) {
        throw new DoclingTaskError({
          task_id: taskId,
          task_type: lastStatus?.task_type ?? 'convert',
          task_status: 'failure',
          failure: result.failure,
        });
      }
      return result;
    } catch (error) {
      if (error instanceof DoclingHttpError && error.status === 404) {
        throw mapResultNotFound(taskId, error, lastStatus);
      }
      if (error instanceof DoclingProtocolError) {
        throw new DoclingResponseSchemaMismatchError(
          'Docling result response is not valid JSON',
          { status: 200, cause: error }
        );
      }
      throw error;
    }
  }

  async #fetchConvertResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<ConvertDocumentResponse<TDocument>> {
    const result = await this.#fetchJsonResult(taskId, lastStatus, signal);
    return parseConvertDocumentResponse<TDocument>(result);
  }

  async #fetchChunkResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<ChunkDocumentResponse<TDocument>> {
    const result = await this.#fetchJsonResult(taskId, lastStatus, signal);
    return parseChunkDocumentResponse<TDocument>(result);
  }

  async #fetchInBodyResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<InBodyConversionResponse<TDocument>> {
    const result = await this.#fetchJsonResult(taskId, lastStatus, signal);
    if (
      isConvertDocumentResponse<TDocument>(result) ||
      isChunkDocumentResponse<TDocument>(result)
    ) {
      return isConvertDocumentResponse<TDocument>(result)
        ? parseConvertDocumentResponse<TDocument>(result)
        : parseChunkDocumentResponse<TDocument>(result);
    }
    throw new DoclingResponseSchemaMismatchError(
      'Docling returned an unknown in-body result response',
      { status: 200 }
    );
  }

  async #fetchPresignedResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<PresignedUrlConvertResponse> {
    const result = await this.#fetchJsonResult(taskId, lastStatus, signal);
    return parsePresignedResponse(result);
  }

  async #fetchCountsResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<PresignedUrlConvertDocumentResponse> {
    const result = await this.#fetchJsonResult(taskId, lastStatus, signal);
    return parseCountsResponse(result);
  }

  async #fetchBinaryResult(
    taskId: string,
    lastStatus?: TaskStatusResponse,
    signal?: AbortSignal
  ): Promise<RawServiceResult> {
    requireTaskId(taskId);
    try {
      const response = await this.#request<DoclingBinaryResponse>(
        'GET',
        `/v1/result/${encodeURIComponent(taskId)}`,
        { responseType: 'bytes', signal }
      );
      if (response.contentType.toLowerCase().includes('json')) {
        let json: unknown | undefined;
        try {
          json = JSON.parse(new TextDecoder().decode(response.content)) as unknown;
        } catch {
          // Match the Python client's failure-envelope sniff: malformed
          // JSON-labeled content remains available as a lossless raw result.
        }
        if (json !== undefined && isTaskFailureResult(json)) {
          throw new DoclingTaskError({
            task_id: taskId,
            task_type: lastStatus?.task_type ?? 'convert',
            task_status: 'failure',
            failure: json.failure,
          });
        }
      }
      return {
        content: response.content,
        content_type: response.contentType || 'application/octet-stream',
        filename: filenameFromContentDisposition(
          response.headers['content-disposition']
        ),
      };
    } catch (error) {
      if (error instanceof DoclingHttpError && error.status === 404) {
        throw mapResultNotFound(taskId, error, lastStatus);
      }
      throw error;
    }
  }

  #request<T>(
    method: DoclingTransportRequest['method'],
    path: string,
    options: {
      body?: unknown;
      bodyType?: DoclingRequestBodyType;
      responseType?: DoclingResponseType;
      headers?: Record<string, string>;
      retries?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<T> {
    if (this.#closed) {
      throw new DoclingProtocolError('Docling client is closed');
    }
    const headers = {
      ...this.#headers,
      ...(options.bodyType === 'form' ? {} : { 'content-type': 'application/json' }),
      ...normalizeHeaders(options.headers),
    };
    if (options.bodyType === 'form') {
      delete headers['content-type'];
    }
    return this.#transport.request<T>({
      method,
      url: `${this.#baseUrl}${path}`,
      headers,
      ...(options.body === undefined ? {} : { body: options.body }),
      ...(options.bodyType === undefined ? {} : { bodyType: options.bodyType }),
      ...(options.responseType === undefined
        ? {}
        : { responseType: options.responseType }),
      ...(options.retries === undefined ? {} : { retries: options.retries }),
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  }
}

type ResultLoader<TResult> = (
  taskId: string,
  lastStatus?: TaskStatusResponse,
  signal?: AbortSignal
) => Promise<TResult>;

export class DoclingJob<TResult> {
  readonly #client: DoclingClient<unknown>;
  readonly #submittedAt: Date;
  readonly #loadResult: ResultLoader<TResult>;
  #status: TaskStatusResponse;

  constructor(
    client: DoclingClient<unknown>,
    status: TaskStatusResponse,
    loadResult: ResultLoader<TResult>
  ) {
    this.#client = client;
    this.#status = status;
    this.#loadResult = loadResult;
    this.#submittedAt = new Date();
  }

  get taskId(): string {
    return this.#status.task_id;
  }

  get status(): TaskStatusResponse {
    return this.#status;
  }

  get submittedAt(): Date {
    return new Date(this.#submittedAt);
  }

  get queuePosition(): number | null {
    return this.#status.task_position ?? null;
  }

  get done(): boolean {
    return ['success', 'failure'].includes(this.#status.task_status);
  }

  async poll(
    options: { waitSeconds?: number; signal?: AbortSignal } = {}
  ): Promise<TaskStatusResponse> {
    this.#status = await this.#client.poll(this.taskId, options);
    return this.#status;
  }

  async *watch(options: WaitForTaskOptions = {}): AsyncGenerator<TaskStatusResponse> {
    for await (const status of this.#client.watch(this.taskId, options)) {
      this.#status = status;
      yield status;
    }
  }

  async wait(options: WaitForTaskOptions = {}): Promise<TaskStatusResponse> {
    if (!this.done) {
      this.#status = await this.#client.waitForCompletion(this.taskId, options);
    }
    return this.#status;
  }

  getResult(options: { signal?: AbortSignal } = {}): Promise<TResult> {
    return this.#loadResult(this.taskId, this.#status, options.signal);
  }

  async result(options: WaitForTaskOptions = {}): Promise<TResult> {
    if (!this.done) {
      await this.wait(options);
    }
    return this.getResult({ signal: options.signal });
  }
}

function parseTaskStatus(value: unknown): TaskStatusResponse {
  if (!isRecord(value)) {
    throw schemaMismatch('Docling returned a non-object task status');
  }
  if (typeof value.task_id !== 'string' || value.task_id === '') {
    throw schemaMismatch('Docling task status is missing task_id');
  }
  if (!['convert', 'chunk'].includes(String(value.task_type))) {
    throw schemaMismatch('Docling task status is missing task_type');
  }
  if (
    ![
      'pending',
      'started',
      'success',
      'failure',
      'partial_success',
      'skipped',
    ].includes(String(value.task_status))
  ) {
    throw schemaMismatch(
      `Docling returned unknown task_status: ${String(value.task_status)}`
    );
  }
  validateOptionalNullableInteger(value.task_position, 'task_position');
  validateOptionalNullableString(value.error_message, 'error_message');
  let taskMeta: TaskStatusResponse['task_meta'] = value.task_meta as
    | TaskStatusResponse['task_meta']
    | undefined;
  if (value.task_meta !== undefined && value.task_meta !== null) {
    if (!isRecord(value.task_meta)) {
      throw schemaMismatch('Docling task_meta must be an object or null');
    }
    requireInteger(value.task_meta.num_docs, 'task_meta.num_docs');
    for (const field of [
      'num_processed',
      'num_succeeded',
      'num_partially_succeeded',
      'num_failed',
    ]) {
      if (value.task_meta[field] !== undefined) {
        requireInteger(value.task_meta[field], `task_meta.${field}`);
      }
    }
    taskMeta = {
      num_docs: value.task_meta.num_docs as number,
      num_processed: (value.task_meta.num_processed as number | undefined) ?? 0,
      num_succeeded: (value.task_meta.num_succeeded as number | undefined) ?? 0,
      num_partially_succeeded:
        (value.task_meta.num_partially_succeeded as number | undefined) ?? 0,
      num_failed: (value.task_meta.num_failed as number | undefined) ?? 0,
    };
  }
  let failure: TaskStatusResponse['failure'] = value.failure as
    | TaskStatusResponse['failure']
    | undefined;
  if (value.failure !== undefined && value.failure !== null) {
    failure = parseFailureInfo(value.failure);
  }
  return {
    ...(value as unknown as TaskStatusResponse),
    ...(value.task_meta === undefined ? {} : { task_meta: taskMeta }),
    ...(value.failure === undefined ? {} : { failure }),
  };
}

function isConvertDocumentResponse<TDocument>(
  value: unknown
): value is ConvertDocumentResponse<TDocument> {
  if (!isRecord(value) || !('document' in value)) {
    return false;
  }
  try {
    parseConvertDocumentResponse<TDocument>(value);
    return true;
  } catch {
    return false;
  }
}

function isChunkDocumentResponse<TDocument>(
  value: unknown
): value is ChunkDocumentResponse<TDocument> {
  if (!isRecord(value) || !('chunks' in value)) {
    return false;
  }
  try {
    parseChunkDocumentResponse<TDocument>(value);
    return true;
  } catch {
    return false;
  }
}

function isCountsResponse(
  value: unknown
): value is PresignedUrlConvertDocumentResponse {
  if (!isRecord(value)) {
    return false;
  }
  try {
    parseCountsResponse(value);
    return true;
  } catch {
    return false;
  }
}

function isPresignedResponse(value: unknown): value is PresignedUrlConvertResponse {
  return isCountsResponse(value) && isRecord(value) && Array.isArray(value.documents);
}

function isTaskFailureResult(value: unknown): value is TaskFailureResult {
  if (!isRecord(value) || value.kind !== 'TaskFailureResult') {
    return false;
  }
  try {
    parseFailureInfo(value.failure);
    return true;
  } catch {
    return false;
  }
}

function isConversionStatus(value: unknown): boolean {
  return [
    'pending',
    'started',
    'success',
    'partial_success',
    'skipped',
    'failure',
  ].includes(String(value));
}

function parseConvertDocumentResponse<TDocument>(
  value: unknown
): ConvertDocumentResponse<TDocument> {
  if (!isRecord(value) || !isRecord(value.document)) {
    throw schemaMismatch('Docling conversion response is missing its document object');
  }
  const document = value.document;
  if (typeof document.filename !== 'string') {
    throw schemaMismatch('Docling conversion document filename must be a string');
  }
  for (const field of [
    'md_content',
    'html_content',
    'text_content',
    'doctags_content',
    'doclang_content',
  ]) {
    validateOptionalNullableString(document[field], `document.${field}`);
  }
  if (
    document.json_content !== undefined &&
    document.json_content !== null &&
    !isDoclingDocument(document.json_content)
  ) {
    throw schemaMismatch('document.json_content is not a DoclingDocument');
  }
  requireConversionStatus(value.status, 'status');
  requireFiniteNumber(value.processing_time, 'processing_time');
  const errors = parseErrors(value.errors);
  const timings = parseTimings(value.timings);
  const confidence = parseConfidence(value.confidence, 'confidence');
  return {
    document: document as unknown as ConvertDocumentResponse<TDocument>['document'],
    status: value.status as ConvertDocumentResponse<TDocument>['status'],
    errors,
    processing_time: value.processing_time,
    timings,
    ...(value.confidence === undefined ? {} : { confidence }),
  };
}

function parseChunkDocumentResponse<TDocument>(
  value: unknown
): ChunkDocumentResponse<TDocument> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.chunks) ||
    !Array.isArray(value.documents)
  ) {
    throw schemaMismatch('Docling chunk response must contain arrays');
  }
  requireFiniteNumber(value.processing_time, 'processing_time');
  const chunks = value.chunks.map((chunk, index) => {
    if (!isRecord(chunk)) {
      throw schemaMismatch(`chunks[${index}] must be an object`);
    }
    requireString(chunk.filename, `chunks[${index}].filename`);
    requireInteger(chunk.chunk_index, `chunks[${index}].chunk_index`);
    requireString(chunk.text, `chunks[${index}].text`);
    if (
      !Array.isArray(chunk.doc_items) ||
      chunk.doc_items.some(item => typeof item !== 'string')
    ) {
      throw schemaMismatch(`chunks[${index}].doc_items must be strings`);
    }
    validateOptionalNullableString(chunk.raw_text, `chunks[${index}].raw_text`);
    validateOptionalNullableInteger(chunk.num_tokens, `chunks[${index}].num_tokens`);
    validateOptionalNullableStringArray(chunk.headings, `chunks[${index}].headings`);
    validateOptionalNullableStringArray(chunk.captions, `chunks[${index}].captions`);
    if (
      chunk.page_numbers !== undefined &&
      chunk.page_numbers !== null &&
      (!Array.isArray(chunk.page_numbers) ||
        chunk.page_numbers.some(page => !Number.isSafeInteger(page)))
    ) {
      throw schemaMismatch(`chunks[${index}].page_numbers must be integers`);
    }
    validateOptionalRecordOrNull(chunk.metadata, `chunks[${index}].metadata`);
    return chunk as unknown as ChunkDocumentResponse<TDocument>['chunks'][number];
  });
  const documents = value.documents.map((document, index) =>
    parseExportResult<TDocument>(document, `documents[${index}]`)
  );
  return {
    chunks,
    documents,
    processing_time: value.processing_time,
  };
}

function parseExportResult<TDocument>(
  value: unknown,
  path: string
): ChunkDocumentResponse<TDocument>['documents'][number] {
  if (!isRecord(value)) {
    throw schemaMismatch(`${path} must be an object`);
  }
  if (value.kind !== undefined && value.kind !== 'ExportResult') {
    throw schemaMismatch(`${path}.kind must be ExportResult`);
  }
  const document = value.content ?? value.document;
  const parsed = parseConvertDocumentResponse<TDocument>({
    document,
    status: value.status,
    errors: value.errors,
    timings: value.timings,
    confidence: value.confidence,
    processing_time: 0,
  });
  return {
    kind: 'ExportResult',
    content: parsed.document,
    status: parsed.status,
    errors: parsed.errors,
    timings: parsed.timings,
    ...(parsed.confidence === undefined ? {} : { confidence: parsed.confidence }),
  };
}

function parseCountsResponse(value: unknown): PresignedUrlConvertDocumentResponse {
  if (!isRecord(value)) {
    throw schemaMismatch('Docling remote-target result must be an object');
  }
  for (const field of ['num_converted', 'num_succeeded', 'num_failed']) {
    requireInteger(value[field], field);
  }
  if (value.num_partially_succeeded !== undefined) {
    requireInteger(value.num_partially_succeeded, 'num_partially_succeeded');
  }
  requireFiniteNumber(value.processing_time, 'processing_time');
  return {
    num_converted: value.num_converted as number,
    num_succeeded: value.num_succeeded as number,
    num_partially_succeeded: (value.num_partially_succeeded as number | undefined) ?? 0,
    num_failed: value.num_failed as number,
    processing_time: value.processing_time,
  };
}

function parsePresignedResponse(value: unknown): PresignedUrlConvertResponse {
  const counts = parseCountsResponse(value);
  if (!isRecord(value) || !Array.isArray(value.documents)) {
    throw schemaMismatch('Docling presigned result must contain documents');
  }
  const documents = value.documents.map((item, index) => {
    const path = `documents[${index}]`;
    if (!isRecord(item)) {
      throw schemaMismatch(`${path} must be an object`);
    }
    requireInteger(item.source_index, `${path}.source_index`);
    requireString(item.source_uri, `${path}.source_uri`);
    requireString(item.filename, `${path}.filename`);
    requireConversionStatus(item.status, `${path}.status`);
    const errors = parseErrors(item.errors);
    const timings = parseTimings(item.timings);
    const confidence = parseConfidence(item.confidence, `${path}.confidence`);
    const artifactsValue = item.artifacts ?? [];
    if (!Array.isArray(artifactsValue)) {
      throw schemaMismatch(`${path}.artifacts must be an array`);
    }
    const artifacts = artifactsValue.map((artifact, artifactIndex) => {
      const artifactPath = `${path}.artifacts[${artifactIndex}]`;
      if (!isRecord(artifact)) {
        throw schemaMismatch(`${artifactPath} must be an object`);
      }
      if (
        ![
          'json',
          'html',
          'markdown',
          'text',
          'doctags',
          'doclang',
          'resource_bundle',
        ].includes(String(artifact.artifact_type))
      ) {
        throw schemaMismatch(`${artifactPath}.artifact_type is unsupported`);
      }
      requireString(artifact.mime_type, `${artifactPath}.mime_type`);
      requireString(artifact.uri, `${artifactPath}.uri`);
      parseAbsoluteUrl(artifact.uri, `${artifactPath}.uri`);
      validateOptionalNullableString(
        artifact.url_expires_at,
        `${artifactPath}.url_expires_at`
      );
      if (
        typeof artifact.url_expires_at === 'string' &&
        Number.isNaN(Date.parse(artifact.url_expires_at))
      ) {
        throw schemaMismatch(`${artifactPath}.url_expires_at must be a datetime`);
      }
      return artifact as unknown as PresignedUrlConvertResponse['documents'][number]['artifacts'][number];
    });
    return {
      source_index: item.source_index as number,
      source_uri: item.source_uri as string,
      filename: item.filename as string,
      status: item.status as PresignedUrlConvertResponse['documents'][number]['status'],
      errors,
      timings,
      artifacts,
      ...(item.confidence === undefined ? {} : { confidence }),
    };
  });
  return { ...counts, documents };
}

function parseErrors(value: unknown): ErrorItem[] {
  const errors = value ?? [];
  if (!Array.isArray(errors)) {
    throw schemaMismatch('errors must be an array');
  }
  return errors.map((error, index) => {
    if (!isRecord(error)) {
      throw schemaMismatch(`errors[${index}] must be an object`);
    }
    if (
      ![
        'document_backend',
        'model',
        'doc_assembler',
        'user_input',
        'pipeline',
      ].includes(String(error.component_type))
    ) {
      throw schemaMismatch(`errors[${index}].component_type is unsupported`);
    }
    requireString(error.module_name, `errors[${index}].module_name`);
    requireString(error.error_message, `errors[${index}].error_message`);
    if (
      error.category !== undefined &&
      !FAILURE_CATEGORIES.has(String(error.category))
    ) {
      throw schemaMismatch(`errors[${index}].category is unsupported`);
    }
    validateOptionalNullableInteger(error.page_no, `errors[${index}].page_no`);
    return {
      component_type: error.component_type as ErrorItem['component_type'],
      module_name: error.module_name,
      error_message: error.error_message,
      category: (error.category as FailureCategory | undefined) ?? 'unknown',
      page_no: (error.page_no as number | null | undefined) ?? null,
    };
  });
}

function parseTimings(value: unknown): Record<string, ProfilingItem> {
  const timings = value ?? {};
  if (!isRecord(timings)) {
    throw schemaMismatch('timings must be an object');
  }
  const parsed: Record<string, ProfilingItem> = {};
  for (const [name, timing] of Object.entries(timings)) {
    if (!isRecord(timing) || !['page', 'document'].includes(String(timing.scope))) {
      throw schemaMismatch(`timings.${name}.scope is unsupported`);
    }
    if (timing.count !== undefined) {
      requireInteger(timing.count, `timings.${name}.count`);
    }
    const times = timing.times ?? [];
    if (
      !Array.isArray(times) ||
      times.some(time => typeof time !== 'number' || !Number.isFinite(time))
    ) {
      throw schemaMismatch(`timings.${name}.times must contain numbers`);
    }
    const timestamps = timing.start_timestamps ?? [];
    if (
      !Array.isArray(timestamps) ||
      timestamps.some(timestamp => typeof timestamp !== 'string')
    ) {
      throw schemaMismatch(`timings.${name}.start_timestamps must contain strings`);
    }
    if (timestamps.some(timestamp => Number.isNaN(Date.parse(timestamp as string)))) {
      throw schemaMismatch(`timings.${name}.start_timestamps must contain datetimes`);
    }
    parsed[name] = {
      scope: timing.scope as ProfilingItem['scope'],
      count: (timing.count as number | undefined) ?? 0,
      times,
      start_timestamps: timestamps,
    };
  }
  return parsed;
}

function parseFailureInfo(value: unknown): PublicFailureInfo {
  if (!isRecord(value)) {
    throw schemaMismatch('failure must be an object');
  }
  if (!FAILURE_CATEGORIES.has(String(value.category))) {
    throw schemaMismatch('failure.category is unsupported');
  }
  requireString(value.message, 'failure.message');
  if (typeof value.retryable !== 'boolean') {
    throw schemaMismatch('failure.retryable must be a boolean');
  }
  if (
    !['admission', 'source_enumeration', 'execution', 'orchestration'].includes(
      String(value.phase)
    )
  ) {
    throw schemaMismatch('failure.phase is unsupported');
  }
  const details = value.details ?? {};
  if (
    !isRecord(details) ||
    Object.values(details).some(detail => typeof detail !== 'string')
  ) {
    throw schemaMismatch('failure.details must contain string values');
  }
  return {
    category: value.category as FailureCategory,
    message: value.message,
    retryable: value.retryable,
    phase: value.phase as PublicFailureInfo['phase'],
    details: details as Record<string, string>,
  };
}

const FAILURE_CATEGORIES = new Set([
  'policy',
  'capacity',
  'source_unavailable',
  'target_unavailable',
  'timeout',
  'internal',
  'backend_failure',
  'inference_failure',
  'unknown',
]);

function isDoclingDocument(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.schema_name === 'DoclingDocument' &&
    typeof value.name === 'string'
  );
}

function requireConversionStatus(value: unknown, path: string): void {
  if (!isConversionStatus(value)) {
    throw schemaMismatch(`${path} is not a conversion status`);
  }
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') {
    throw schemaMismatch(`${path} must be a string`);
  }
}

function requireInteger(value: unknown, path: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw schemaMismatch(`${path} must be an integer`);
  }
}

function requireFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw schemaMismatch(`${path} must be a finite number`);
  }
}

function validateOptionalNullableString(value: unknown, path: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw schemaMismatch(`${path} must be a string or null`);
  }
}

function validateOptionalNullableInteger(value: unknown, path: string): void {
  if (value !== undefined && value !== null && !Number.isSafeInteger(value)) {
    throw schemaMismatch(`${path} must be an integer or null`);
  }
}

function validateOptionalNullableStringArray(value: unknown, path: string): void {
  if (
    value !== undefined &&
    value !== null &&
    (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
  ) {
    throw schemaMismatch(`${path} must contain strings or be null`);
  }
}

function validateOptionalRecordOrNull(value: unknown, path: string): void {
  if (value !== undefined && value !== null && !isRecord(value)) {
    throw schemaMismatch(`${path} must be an object or null`);
  }
}

function parseConfidence(
  value: unknown,
  path: string
): ConfidenceScores | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (!isRecord(value)) {
    throw schemaMismatch(`${path} must be an object or null`);
  }
  for (const field of [
    'parse_score',
    'layout_score',
    'table_score',
    'ocr_score',
    'mean_score',
    'low_score',
  ]) {
    const score = value[field];
    if (
      score !== undefined &&
      score !== null &&
      (typeof score !== 'number' || !Number.isFinite(score))
    ) {
      throw schemaMismatch(`${path}.${field} must be a number or null`);
    }
  }
  for (const field of ['mean_grade', 'low_grade']) {
    const grade = value[field];
    if (
      grade !== undefined &&
      !['poor', 'fair', 'good', 'excellent', 'unspecified'].includes(String(grade))
    ) {
      throw schemaMismatch(`${path}.${field} is unsupported`);
    }
  }
  return value as ConfidenceScores;
}

function schemaMismatch(message: string): DoclingResponseSchemaMismatchError {
  return new DoclingResponseSchemaMismatchError(message, { status: 200 });
}

function conversionFromResponse<TDocument>(
  response: ConvertDocumentResponse<TDocument>,
  input: ConversionInput
): ConversionResult<TDocument> {
  return {
    input: {
      ...input,
      filename: response.document.filename || input.filename,
    },
    document:
      response.document.json_content ??
      emptyDocument<TDocument>(response.document.filename || input.filename),
    status: response.status,
    errors: response.errors,
    processing_time: response.processing_time,
    timings: response.timings,
    ...(response.confidence === undefined ? {} : { confidence: response.confidence }),
  };
}

function syntheticConversion<TDocument>(
  input: ConversionInput,
  status: 'failure' | 'skipped',
  message: string,
  category: FailureCategory = 'unknown'
): ConversionResult<TDocument> {
  const error: ErrorItem = {
    component_type: 'user_input',
    module_name: '@docling/docling-client',
    error_message: message,
    category,
  };
  return {
    input,
    document: emptyDocument<TDocument>(input.filename),
    status,
    errors: [error],
    processing_time: 0,
    timings: {},
  };
}

function emptyDocument<TDocument>(filename: string): TDocument {
  const leaf = filename.replaceAll('\\', '/').split('/').at(-1) ?? filename;
  const extension = leaf.lastIndexOf('.');
  const name = extension > 0 ? leaf.slice(0, extension) : leaf;
  return {
    schema_name: 'DoclingDocument',
    name: name || 'document',
  } as TDocument;
}

function conversionFailureMessage<TDocument>(
  result: ConversionResult<TDocument>
): string {
  const errors = result.errors.map(error => error.error_message).join('; ');
  return `Conversion failed for ${result.input.filename} with status ${result.status}${
    errors === '' ? '' : `. Errors: ${errors}`
  }`;
}

function mapResultNotFound(
  taskId: string,
  error: DoclingHttpError,
  lastStatus?: TaskStatusResponse
): Error {
  const detail = httpDetail(error.body);
  if (detail === 'Task not found.') {
    return new DoclingTaskNotFoundError(taskId);
  }
  if (detail?.startsWith('Task result not found') === true) {
    if (lastStatus?.task_status === 'failure') {
      return new DoclingTaskError(lastStatus);
    }
    if (lastStatus?.task_status === 'success') {
      return new DoclingResultExpiredError(taskId);
    }
    return new DoclingResultNotReadyError(taskId);
  }
  return new DoclingServiceError('Unexpected result lookup error', {
    status: 404,
    detail,
    cause: error,
  });
}

function shouldFallbackFromPresigned(error: unknown): boolean {
  if (!(error instanceof DoclingHttpError) || ![400, 422].includes(error.status)) {
    return false;
  }
  const detail = httpDetail(error.body)?.toLowerCase();
  if (detail === undefined) {
    return false;
  }
  if (detail.includes('artifact storage to be configured')) {
    return true;
  }
  if (!detail.includes('presigned_url') && !detail.includes('presigned url')) {
    return false;
  }
  return [
    'input should be',
    'unexpected value',
    'validation error',
    'literal_error',
    'enum',
  ].some(phrase => detail.includes(phrase));
}

function targetNeedsJson(target: SubmitTarget): target is InBodyTarget {
  return target.kind === 'inbody';
}

function isPresignedTarget(target: BatchTarget): target is PresignedUrlTarget {
  return target.kind === 'presigned_url';
}

function validateBatchRequest(request: BatchConvertSourcesRequest): void {
  if (!Array.isArray(request.sources) || request.sources.length === 0) {
    throw new DoclingProtocolError('Batch conversion requires at least one source');
  }
  for (const source of request.sources) {
    if (source.kind === 'file') {
      throw new DoclingProtocolError('Batch conversion does not accept file sources');
    }
    if (typeof source.kind !== 'string' || source.kind === '') {
      throw new DoclingProtocolError('Batch source kind must not be empty');
    }
    validateKnownConnector(source, 'source');
  }
  if (
    !isRecord(request.target) ||
    typeof request.target.kind !== 'string' ||
    request.target.kind === ''
  ) {
    throw new DoclingProtocolError('Batch target kind must not be empty');
  }
  if (['inbody', 'zip', 'put'].includes(request.target.kind)) {
    throw new DoclingProtocolError(
      `Batch conversion does not accept ${request.target.kind} targets`
    );
  }
  validateKnownConnector(request.target, 'target');
  validateCallbacks(request.callbacks);
}

function validateChunkRequestOptions(
  request: ChunkSourcesRequest | ChunkSourceOptions
): void {
  if (
    request.include_converted_doc !== undefined &&
    typeof request.include_converted_doc !== 'boolean'
  ) {
    throw new DoclingProtocolError('include_converted_doc must be a boolean');
  }
  if (
    request.target !== undefined &&
    (!isRecord(request.target) || request.target.kind !== 'inbody')
  ) {
    throw new DoclingProtocolError('Chunk conversion only supports inbody targets');
  }
  const options = request.chunking_options;
  if (options === undefined) {
    return;
  }
  if (!isRecord(options)) {
    throw new DoclingProtocolError('chunking_options must be an object');
  }
  for (const key of [
    'use_markdown_tables',
    'use_markdown_images',
    'include_raw_text',
    'merge_peers',
  ]) {
    const value = options[key];
    if (value !== undefined && typeof value !== 'boolean') {
      throw new DoclingProtocolError(`chunking_options.${key} must be a boolean`);
    }
  }
  if (
    options.image_placeholder !== undefined &&
    typeof options.image_placeholder !== 'string'
  ) {
    throw new DoclingProtocolError(
      'chunking_options.image_placeholder must be a string'
    );
  }
  if (
    options.max_tokens !== undefined &&
    options.max_tokens !== null &&
    !Number.isInteger(options.max_tokens)
  ) {
    throw new DoclingProtocolError(
      'chunking_options.max_tokens must be an integer or null'
    );
  }
  if (options.tokenizer !== undefined && typeof options.tokenizer !== 'string') {
    throw new DoclingProtocolError('chunking_options.tokenizer must be a string');
  }
}

function validateConversionSource(
  source: ConversionSource | undefined
): asserts source is ConversionSource {
  if (source === undefined) {
    throw new DoclingProtocolError('A conversion source is required');
  }
  if (source.kind === 'http') {
    if (typeof source.url !== 'string' || source.url === '') {
      throw new DoclingProtocolError('HTTP source url is required');
    }
    const url = parseHttpUrl(source.url, 'HTTP source');
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new DoclingProtocolError('HTTP source must use HTTP or HTTPS');
    }
    if (url.pathname.toLowerCase().endsWith('.zip')) {
      throw new DoclingProtocolError(
        'ZIP URLs are not accepted on the Docling convert endpoint'
      );
    }
    if (source.headers !== undefined && !isRecord(source.headers)) {
      throw new DoclingProtocolError('HTTP source headers must be an object');
    }
    return;
  }
  if (
    typeof source.filename !== 'string' ||
    source.filename === '' ||
    typeof source.base64_string !== 'string' ||
    source.base64_string === ''
  ) {
    throw new DoclingProtocolError(
      'File source filename and base64_string are required'
    );
  }
}

function validateSubmitTarget(target: SubmitTarget): void {
  if (target.kind === 'put') {
    parseHttpUrl(target.url, 'Put target');
    return;
  }
  if (
    ![
      'inbody',
      'zip',
      'presigned_url',
      's3',
      'azure_blob',
      'google_cloud_storage',
      'google_drive',
    ].includes(target.kind)
  ) {
    throw new DoclingProtocolError(
      `Unsupported Docling conversion target: ${String(target.kind)}`
    );
  }
  validateKnownConnector(target, 'target');
}

function validateKnownConnector(
  value: { kind: string },
  role: 'source' | 'target'
): void {
  const fields = value as unknown as Record<string, unknown>;
  if (value.kind === 'http') {
    requireStringFields(fields, ['url'], role, false);
    parseHttpUrl(fields.url as string, `HTTP ${role}`);
    return;
  }
  if (value.kind === 's3') {
    requireStringFields(
      fields,
      ['endpoint', 'access_key', 'secret_key', 'bucket', 'key_prefix'],
      role,
      true
    );
    validateOptionalBoolean(fields.verify_ssl, `${role} verify_ssl`);
    validatePositiveMaxElements(fields.max_num_elements, role);
    return;
  }
  if (value.kind === 'azure_blob') {
    requireStringFields(
      fields,
      ['account_name', 'container', 'connection_string', 'blob_prefix'],
      role,
      true
    );
    validateOptionalInteger(fields.max_num_elements, `${role} max_num_elements`);
    return;
  }
  if (value.kind === 'google_cloud_storage') {
    requireStringFields(fields, ['bucket', 'key_prefix'], role, true);
    validatePositiveMaxElements(fields.max_num_elements, role);
    validateOptionalString(fields.project, `${role} project`);
    if (
      fields.service_account_key !== undefined &&
      fields.service_account_key !== null
    ) {
      if (!isRecord(fields.service_account_key)) {
        throw new DoclingProtocolError(
          `Google Cloud Storage ${role} service_account_key must be an object`
        );
      }
      requireStringFields(
        fields.service_account_key,
        [
          'project_id',
          'private_key_id',
          'private_key',
          'client_email',
          'client_id',
          'auth_uri',
          'token_uri',
          'auth_provider_x509_cert_url',
          'client_x509_cert_url',
          'universe_domain',
        ],
        `${role} service_account_key`,
        true
      );
    }
    return;
  }
  if (value.kind === 'google_drive') {
    requireStringFields(fields, ['path_id'], role);
    if (
      !hasNonEmptyString(fields.token_path) &&
      !hasNonEmptyString(fields.refresh_token)
    ) {
      throw new DoclingProtocolError(
        `Google Drive ${role} requires token_path or refresh_token`
      );
    }
    if (!hasNonEmptyString(fields.credentials_path) && !isRecord(fields.credentials)) {
      throw new DoclingProtocolError(
        `Google Drive ${role} requires credentials_path or credentials`
      );
    }
    validateOptionalString(fields.token_path, `${role} token_path`);
    validateOptionalString(fields.refresh_token, `${role} refresh_token`);
    validateOptionalString(fields.credentials_path, `${role} credentials_path`);
    if (isRecord(fields.credentials)) {
      requireStringFields(
        fields.credentials,
        [
          'client_id',
          'project_id',
          'auth_uri',
          'token_uri',
          'auth_provider_x509_cert_url',
          'client_secret',
        ],
        `${role} credentials`,
        true
      );
      for (const key of ['auth_uri', 'token_uri', 'auth_provider_x509_cert_url']) {
        parseHttpUrl(
          fields.credentials[key] as string,
          `Google Drive ${role} credentials.${key}`
        );
      }
      const redirectUris = fields.credentials.redirect_uris;
      if (
        !Array.isArray(redirectUris) ||
        redirectUris.some(uri => typeof uri !== 'string')
      ) {
        throw new DoclingProtocolError(
          `Google Drive ${role} credentials redirect_uris must be an array of URLs`
        );
      }
      for (const uri of redirectUris) {
        parseHttpUrl(uri as string, `Google Drive ${role} redirect URI`);
      }
    }
  }
}

function requireStringFields(
  value: Record<string, unknown>,
  fields: string[],
  role: string,
  allowMissingDefault = false
): void {
  for (const field of fields) {
    if (
      allowMissingDefault &&
      ['key_prefix', 'blob_prefix'].includes(field) &&
      value[field] === undefined
    ) {
      continue;
    }
    if (typeof value[field] !== 'string') {
      throw new DoclingProtocolError(
        `${value.kind as string} ${role} requires ${field}`
      );
    }
  }
}

function validatePositiveMaxElements(value: unknown, role: string): void {
  if (
    value !== undefined &&
    value !== null &&
    (!Number.isSafeInteger(value) || (value as number) < 1)
  ) {
    throw new DoclingProtocolError(
      `${role} max_num_elements must be a positive integer`
    );
  }
}

function validateOptionalInteger(value: unknown, name: string): void {
  if (value !== undefined && value !== null && !Number.isSafeInteger(value)) {
    throw new DoclingProtocolError(`${name} must be an integer or null`);
  }
}

function validateOptionalBoolean(value: unknown, name: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new DoclingProtocolError(`${name} must be a boolean`);
  }
}

function validateOptionalString(value: unknown, name: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new DoclingProtocolError(`${name} must be a string or null`);
  }
}

function validateCallbacks(callbacks: CallbackSpec[] | undefined): void {
  if (callbacks !== undefined && !Array.isArray(callbacks)) {
    throw new DoclingProtocolError('callbacks must be an array');
  }
  for (const callback of callbacks ?? []) {
    if (!isRecord(callback) || typeof callback.url !== 'string') {
      throw new DoclingProtocolError('Callback url is required');
    }
    parseAbsoluteUrl(callback.url, 'Callback url');
    if (
      callback.headers !== undefined &&
      (!isRecord(callback.headers) ||
        Object.values(callback.headers).some(value => typeof value !== 'string'))
    ) {
      throw new DoclingProtocolError('Callback headers must contain string values');
    }
    if (callback.ca_cert !== undefined && typeof callback.ca_cert !== 'string') {
      throw new DoclingProtocolError('Callback ca_cert must be a string');
    }
  }
}

function parseHttpUrl(value: unknown, name: string): URL {
  const url = parseAbsoluteUrl(value, name);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new DoclingProtocolError(`${name} must use HTTP or HTTPS`);
  }
  return url;
}

function parseAbsoluteUrl(value: unknown, name: string): URL {
  if (typeof value !== 'string' || value === '') {
    throw new DoclingProtocolError(`${name} must be a URL`);
  }
  try {
    return new URL(value);
  } catch (error) {
    throw new DoclingProtocolError(`${name} must be a valid URL`, {
      cause: error,
    });
  }
}

async function fileSourceFromBlob(
  source: Extract<NormalizedSource, { kind: 'multipart' }>,
  signal?: AbortSignal
): Promise<FileSource> {
  throwIfAborted(signal);
  const bytes = new Uint8Array(await source.blob.arrayBuffer());
  throwIfAborted(signal);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const base64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return {
    kind: 'file',
    filename: source.descriptor.filename,
    base64_string: base64,
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('The operation was aborted', 'AbortError');
  }
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function filenameFromContentDisposition(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (encoded !== undefined) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ''));
    } catch {
      return encoded;
    }
  }
  return /filename="?([^";]+)"?/i.exec(value)?.[1] ?? null;
}

function httpDetail(value: unknown): string | undefined {
  return isRecord(value) && typeof value.detail === 'string' ? value.detail : undefined;
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  if (normalized === '') {
    throw new DoclingProtocolError('Docling baseUrl must not be empty');
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch (error) {
    throw new DoclingProtocolError('Docling baseUrl must be a valid URL', {
      cause: error,
    });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new DoclingProtocolError('Docling baseUrl must use HTTP or HTTPS');
  }
  if (url.search !== '' || url.hash !== '') {
    throw new DoclingProtocolError(
      'Docling baseUrl must not include query or fragment components'
    );
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/v1')) {
    throw new DoclingProtocolError(
      'Docling baseUrl must be the service base URL and not include /v1'
    );
  }
  url.pathname = path;
  return url.toString().replace(/\/+$/, '');
}

function normalizeHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])
  );
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DoclingProtocolError(`${name} must be a positive number`);
  }
  return value;
}

function nonNegativeNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DoclingProtocolError(`${name} must be non-negative`);
  }
  return value;
}

function requireTaskId(taskId: string): void {
  if (taskId === '') {
    throw new DoclingProtocolError('taskId must not be empty');
  }
}

function isChunkSourcesRequest(value: unknown): value is ChunkSourcesRequest {
  return (
    isRecord(value) &&
    Array.isArray(value.sources) &&
    ['hybrid', 'hierarchical'].includes(String(value.chunker))
  );
}

function fallbackInput(source: ConversionSourceInput): ConversionInput {
  if (typeof source === 'string') {
    return {
      filename: source.replaceAll('\\', '/').split('/').at(-1) || 'document',
      source,
    };
  }
  if (source instanceof URL) {
    return {
      filename: source.pathname.split('/').filter(Boolean).at(-1) ?? 'document',
      source: source.toString(),
    };
  }
  if (isRecord(source)) {
    let urlFilename: string | undefined;
    if (typeof source.url === 'string') {
      try {
        urlFilename =
          new URL(source.url).pathname.split('/').filter(Boolean).at(-1) ?? 'document';
      } catch {
        urlFilename = source.url.replaceAll('\\', '/').split('/').at(-1);
      }
    }
    const filename =
      typeof source.filename === 'string'
        ? source.filename
        : typeof source.url === 'string'
          ? urlFilename || 'document'
          : 'document';
    return { filename, source: filename };
  }
  return { filename: 'document', source: 'document' };
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}

async function* mapSourcesToItems(
  sources: Iterable<ConversionSourceInput> | AsyncIterable<ConversionSourceInput>,
  options?: ConvertDocumentsOptions,
  headers?: Record<string, string>
): AsyncGenerator<ConversionItem> {
  if (Symbol.asyncIterator in Object(sources)) {
    for await (const source of sources as AsyncIterable<ConversionSourceInput>) {
      yield { source, options, headers };
    }
    return;
  }
  for (const source of sources as Iterable<ConversionSourceInput>) {
    yield { source, options, headers };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
