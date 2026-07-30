import type { PublicFailureInfo, TaskStatusResponse } from './types';

export class DoclingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class DoclingServiceError extends DoclingError {
  readonly status: number | null;
  readonly detail: string | null;

  constructor(
    message: string,
    options: { status?: number; detail?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.status = options.status ?? null;
    this.detail = options.detail ?? null;
  }
}

export class DoclingHttpError extends DoclingServiceError {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;

  constructor(options: {
    method: string;
    url: string;
    status: number;
    body: unknown;
    headers?: Readonly<Record<string, string>>;
    detail?: string;
  }) {
    const serialized =
      typeof options.body === 'string' ? options.body : safeSerialize(options.body);
    super(
      `Docling request ${options.method} ${options.url} returned HTTP ${options.status}${
        serialized === '' ? '' : `: ${serialized.slice(0, 500)}`
      }`,
      { status: options.status, detail: options.detail }
    );
    this.method = options.method;
    this.url = options.url;
    this.status = options.status;
    this.body = options.body;
    this.headers = options.headers ?? {};
  }
}

function safeSerialize(value: unknown): string {
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

export class DoclingProtocolError extends DoclingError {}

export class DoclingResponseSchemaMismatchError extends DoclingServiceError {}

export class DoclingServiceUnavailableError extends DoclingServiceError {}

export class DoclingUsageLimitExceededError extends DoclingHttpError {
  readonly currentUsage: number | null;
  readonly limit: number | null;

  constructor(options: {
    method: string;
    url: string;
    status: number;
    body: unknown;
    headers?: Readonly<Record<string, string>>;
    currentUsage?: number;
    limit?: number;
    detail?: string;
  }) {
    super(options);
    this.currentUsage = options.currentUsage ?? null;
    this.limit = options.limit ?? null;
  }
}

export class DoclingTaskError extends DoclingError {
  readonly task: TaskStatusResponse;
  readonly failure?: PublicFailureInfo;

  constructor(task: TaskStatusResponse) {
    super(
      task.failure?.message ??
        task.error_message ??
        `Docling task ${task.task_id} failed`
    );
    this.task = task;
    if (task.failure !== undefined && task.failure !== null) {
      this.failure = task.failure;
    }
  }
}

export class DoclingTimeoutError extends DoclingError {
  readonly taskId: string;
  readonly timeoutMs: number;

  constructor(taskId: string, timeoutMs: number) {
    super(`Docling task ${taskId} did not finish within ${timeoutMs} ms`);
    this.taskId = taskId;
    this.timeoutMs = timeoutMs;
  }
}

export class DoclingTaskNotFoundError extends DoclingError {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Docling task ${taskId} was not found`);
    this.taskId = taskId;
  }
}

export class DoclingResultNotReadyError extends DoclingError {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Result for Docling task ${taskId} is not ready`);
    this.taskId = taskId;
  }
}

export class DoclingResultExpiredError extends DoclingError {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Result for Docling task ${taskId} has expired`);
    this.taskId = taskId;
  }
}

export class DoclingArtifactDownloadError extends DoclingError {}

export class DoclingConversionError extends DoclingError {}

export class DoclingBatchConversionError extends DoclingError {
  readonly failures: Error[];

  constructor(message: string, failures: Error[]) {
    super(`${message} (${failures.length} failure(s))`);
    this.failures = failures;
  }
}
