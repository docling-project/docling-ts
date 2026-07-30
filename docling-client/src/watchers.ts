import WebSocket from 'isomorphic-ws';

import {
  DoclingProtocolError,
  DoclingServiceUnavailableError,
  DoclingTaskNotFoundError,
  DoclingTimeoutError,
} from './errors';
import type { TaskStatusResponse, WaitForTaskOptions } from './types';

export type StatusWatcherKind = 'websocket' | 'polling';

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: {
      data?: unknown;
      error?: unknown;
      message?: string;
      code?: number;
      reason?: string;
      wasClean?: boolean;
    }) => void
  ): void;
}

export interface WebSocketFactoryOptions {
  headers: Readonly<Record<string, string>>;
}

export type WebSocketFactory = (
  url: string,
  options: WebSocketFactoryOptions
) => WebSocketLike;

export interface WatchTaskOptions extends WaitForTaskOptions {
  taskId: string;
  baseUrl: string;
  apiKey?: string;
  watcher: StatusWatcherKind;
  fallbackToPoll: boolean;
  connectTimeoutMs: number;
  webSocketFactory?: WebSocketFactory;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  poll: (
    taskId: string,
    options: { waitSeconds: number; signal?: AbortSignal }
  ) => Promise<TaskStatusResponse>;
  parseStatus: (value: unknown) => TaskStatusResponse;
}

interface WebSocketEnvelope {
  message: 'connection' | 'update' | 'error';
  task?: TaskStatusResponse;
  error?: string | null;
}

interface SocketEvent {
  kind: 'open' | 'message' | 'error' | 'close';
  data?: unknown;
  error?: unknown;
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

export async function* watchTask(
  options: WatchTaskOptions
): AsyncGenerator<TaskStatusResponse> {
  if (options.watcher === 'polling') {
    yield* pollUpdates(options);
    return;
  }
  try {
    yield* webSocketUpdates(options);
  } catch (error) {
    if (error instanceof DoclingServiceUnavailableError && options.fallbackToPoll) {
      yield* pollUpdates(options);
      return;
    }
    throw error;
  }
}

async function* pollUpdates(
  options: WatchTaskOptions
): AsyncGenerator<TaskStatusResponse> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const serverWaitSeconds = options.serverWaitSeconds ?? 5;
  const pollIntervalMs = options.pollIntervalMs ?? serverWaitSeconds * 1_000;
  validateWatchTimes(timeoutMs, serverWaitSeconds, pollIntervalMs);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new DoclingTimeoutError(options.taskId, timeoutMs);
    }
    const waitSeconds = Math.min(serverWaitSeconds, remaining / 1_000);
    const pollStarted = Date.now();
    const status = await options.poll(options.taskId, {
      waitSeconds,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    await options.onStatus?.(status);
    yield status;
    if (isTerminal(status)) {
      return;
    }
    const elapsed = Date.now() - pollStarted;
    const sleepMs = Math.max(
      0,
      Math.min(pollIntervalMs, deadline - Date.now()) - elapsed
    );
    await (options.sleep ?? abortableDelay)(sleepMs, options.signal);
  }
}

async function* webSocketUpdates(
  options: WatchTaskOptions
): AsyncGenerator<TaskStatusResponse> {
  const timeoutMs = options.timeoutMs ?? 300_000;
  const deadline = Date.now() + timeoutMs;
  const factory =
    options.webSocketFactory ??
    ((socketUrl: string, factoryOptions: WebSocketFactoryOptions) =>
      new WebSocket(socketUrl, [], {
        headers: factoryOptions.headers,
      }) as unknown as WebSocketLike);
  const url = webSocketUrl(options.baseUrl, options.taskId, options.apiKey);

  for (let attempt = 0; attempt <= 3; attempt += 1) {
    let socket: WebSocketLike | undefined;
    try {
      try {
        socket = factory(url, {
          headers:
            options.apiKey === undefined || options.apiKey === ''
              ? {}
              : { 'X-Api-Key': options.apiKey },
        });
      } catch (error) {
        throw new WebSocketConnectionError('WebSocket connection failed', {
          cause: error,
        });
      }
      const events = socketEvents(socket);
      await waitForOpen(events, options.connectTimeoutMs, options.signal);
      let awaitingNextUpdate = false;
      while (true) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new DoclingTimeoutError(options.taskId, timeoutMs);
        }
        const event = await withTimeout(
          events.next(),
          remaining,
          options.signal,
          () => new DoclingTimeoutError(options.taskId, timeoutMs)
        );
        if (event.done) {
          throw new WebSocketConnectionError(
            'WebSocket status stream ended unexpectedly'
          );
        }
        if (event.value.kind === 'error') {
          throw new WebSocketConnectionError(
            `WebSocket status stream failed: ${
              event.value.error instanceof Error
                ? event.value.error.message
                : String(event.value.error ?? 'unknown error')
            }`
          );
        }
        if (event.value.kind === 'close') {
          if (awaitingNextUpdate && isCleanWebSocketClose(event.value)) {
            return;
          }
          throw new WebSocketConnectionError(
            `WebSocket status stream closed before a terminal status: ${`${event.value.code ?? 0} ${event.value.reason ?? ''}`.trim()}`
          );
        }
        if (event.value.kind !== 'message') {
          continue;
        }

        awaitingNextUpdate = false;
        const envelope = parseEnvelope(event.value.data, options.parseStatus);
        if (envelope.error !== undefined && envelope.error !== null) {
          if (envelope.error === 'Task not found.') {
            throw new DoclingTaskNotFoundError(options.taskId);
          }
          throw new DoclingServiceUnavailableError('WebSocket status stream failed', {
            detail: envelope.error,
          });
        }
        if (envelope.task === undefined) {
          continue;
        }
        await options.onStatus?.(envelope.task);
        yield envelope.task;
        if (isTerminal(envelope.task)) {
          return;
        }
        if (envelope.message === 'update') {
          try {
            socket.send('next');
          } catch (error) {
            if (isCleanWebSocketClose(error)) {
              return;
            }
            throw new WebSocketConnectionError(
              'WebSocket status stream could not request the next update',
              { cause: error }
            );
          }
          awaitingNextUpdate = true;
        }
      }
    } catch (error) {
      if (
        error instanceof DoclingTimeoutError ||
        error instanceof DoclingTaskNotFoundError ||
        options.signal?.aborted === true
      ) {
        throw error;
      }
      if (!(error instanceof WebSocketConnectionError)) {
        throw error;
      }
      const remaining = deadline - Date.now();
      if (attempt >= 3 || remaining <= 0) {
        throw new DoclingServiceUnavailableError(
          'WebSocket status stream is unavailable',
          {
            detail: error instanceof Error ? error.message : String(error),
            cause: error,
          }
        );
      }
      await (options.sleep ?? abortableDelay)(
        Math.min(1_000 * 2 ** attempt, remaining),
        options.signal
      );
    } finally {
      try {
        socket?.close();
      } catch {
        // Best-effort cleanup; the originating watcher error remains authoritative.
      }
    }
  }
}

function webSocketUrl(baseUrl: string, taskId: string, apiKey?: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/status/ws/${encodeURIComponent(
    taskId
  )}`;
  if (apiKey !== undefined && apiKey !== '') {
    url.searchParams.set('api_key', apiKey);
  }
  return url.toString();
}

function socketEvents(socket: WebSocketLike): AsyncGenerator<SocketEvent> {
  const queue: SocketEvent[] = [];
  const waiters: Array<(event: SocketEvent) => void> = [];
  const push = (event: SocketEvent) => {
    const waiter = waiters.shift();
    if (waiter === undefined) {
      queue.push(event);
    } else {
      waiter(event);
    }
  };
  socket.addEventListener('open', () => push({ kind: 'open' }));
  socket.addEventListener('message', event =>
    push({ kind: 'message', data: event.data })
  );
  socket.addEventListener('error', event =>
    push({ kind: 'error', error: event.error ?? event.message })
  );
  socket.addEventListener('close', event =>
    push({
      kind: 'close',
      code: event.code ?? 0,
      reason: event.reason ?? '',
      wasClean: event.wasClean ?? false,
    })
  );

  return (async function* () {
    while (true) {
      if (queue.length > 0) {
        const event = queue.shift();
        if (event !== undefined) {
          yield event;
        }
        continue;
      }
      yield await new Promise<SocketEvent>(resolve => waiters.push(resolve));
    }
  })();
}

async function waitForOpen(
  events: AsyncGenerator<SocketEvent>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<void> {
  const event = await withTimeout(
    events.next(),
    timeoutMs,
    signal,
    () => new WebSocketConnectionError(`WebSocket connection exceeded ${timeoutMs} ms`)
  );
  if (event.done || event.value.kind !== 'open') {
    throw new WebSocketConnectionError('WebSocket connection failed before opening');
  }
}

class WebSocketConnectionError extends Error {}

function isCleanWebSocketClose(value: unknown): boolean {
  if (value instanceof Error && value.name === 'ConnectionClosedOK') {
    return true;
  }
  return (
    isRecord(value) &&
    (value.wasClean === true || value.code === 1000 || value.closeCode === 1000)
  );
}

function parseEnvelope(
  data: unknown,
  parseStatus: (value: unknown) => TaskStatusResponse
): WebSocketEnvelope {
  let value: unknown;
  try {
    const text =
      typeof data === 'string'
        ? data
        : data instanceof ArrayBuffer
          ? new TextDecoder().decode(data)
          : ArrayBuffer.isView(data)
            ? new TextDecoder().decode(data)
            : String(data);
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new DoclingServiceUnavailableError(
      'WebSocket returned an invalid JSON envelope',
      { cause: error }
    );
  }
  if (
    !isRecord(value) ||
    !['connection', 'update', 'error'].includes(String(value.message))
  ) {
    throw new DoclingServiceUnavailableError(
      'WebSocket returned an invalid status envelope'
    );
  }
  return {
    message: value.message as WebSocketEnvelope['message'],
    ...(value.task === undefined ? {} : { task: parseStatus(value.task) }),
    ...(typeof value.error === 'string' || value.error === null
      ? { error: value.error }
      : {}),
  };
}

function isTerminal(status: TaskStatusResponse): boolean {
  return ['success', 'failure'].includes(status.task_status);
}

function validateWatchTimes(
  timeoutMs: number,
  serverWaitSeconds: number,
  pollIntervalMs: number
): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new DoclingProtocolError('timeoutMs must be a positive number');
  }
  if (!Number.isFinite(serverWaitSeconds) || serverWaitSeconds < 0) {
    throw new DoclingProtocolError('serverWaitSeconds must be non-negative');
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new DoclingProtocolError('pollIntervalMs must be non-negative');
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  signal: AbortSignal | undefined,
  error: () => Error
): Promise<T> {
  if (signal?.aborted === true) {
    throw signal.reason;
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(error()), milliseconds);
    const abort = () => reject(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    promise.then(
      value => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        resolve(value);
      },
      reason => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        reject(reason);
      }
    );
  });
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }
  if (signal?.aborted === true) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
