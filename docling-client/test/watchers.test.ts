import { describe, expect, it, vi } from 'vitest';

import {
  DoclingTaskNotFoundError,
  watchTask,
  type TaskStatusResponse,
  type WebSocketLike,
} from '../src';

class FakeSocket implements WebSocketLike {
  readonly sent: string[] = [];
  readonly #listeners = new Map<
    string,
    Array<(event: Record<string, unknown>) => void>
  >();
  readyState = 0;
  closed = false;

  constructor(onOpen?: (socket: FakeSocket) => void) {
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open');
      onOpen?.(this);
    });
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: Record<string, unknown>) => void
  ): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  message(value: unknown): void {
    this.emit('message', { data: JSON.stringify(value) });
  }

  error(message: string): void {
    this.emit('error', { message });
  }

  disconnect(code = 1006): void {
    this.emit('close', { code, reason: 'disconnected', wasClean: false });
  }

  cleanDisconnect(): void {
    this.emit('close', { code: 1000, reason: 'OK', wasClean: true });
  }

  private emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class HangingSocket implements WebSocketLike {
  readonly readyState = 0;
  closed = false;

  send(data: string): void {
    void data;
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: Record<string, unknown>) => void
  ): void {
    void type;
    void listener;
  }
}

describe('Docling WebSocket watcher', () => {
  it('yields connection/update frames and sends next only after nonterminal updates', async () => {
    let socket: FakeSocket | undefined;
    let openedUrl = '';
    const statuses: string[] = [];
    const watcher = watchTask({
      taskId: 'task/with space',
      baseUrl: 'https://docling.example.test/prefix',
      apiKey: 'secret key',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 100,
      webSocketFactory: url => {
        openedUrl = url;
        socket = new FakeSocket(current => {
          current.message({
            message: 'connection',
            task: task('pending'),
          });
          current.message({
            message: 'update',
            task: task('started'),
          });
        });
        const originalSend = socket.send.bind(socket);
        socket.send = value => {
          originalSend(value);
          socket?.message({
            message: 'update',
            task: task('success'),
          });
        };
        return socket;
      },
      poll: async () => task('success'),
      parseStatus,
    });

    for await (const status of watcher) {
      statuses.push(status.task_status);
    }

    expect(openedUrl).toBe(
      'wss://docling.example.test/prefix/v1/status/ws/task%2Fwith%20space?api_key=secret+key'
    );
    expect(statuses).toEqual(['pending', 'started', 'success']);
    expect(socket?.sent).toEqual(['next']);
    expect(socket?.closed).toBe(true);
  });

  it('does not poll-fallback for task-not-found envelopes', async () => {
    const poll = vi.fn(async () => task('success'));
    const watcher = watchTask({
      taskId: 'missing',
      baseUrl: 'https://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: true,
      connectTimeoutMs: 100,
      webSocketFactory: () =>
        new FakeSocket(socket => {
          socket.message({
            message: 'error',
            error: 'Task not found.',
          });
        }),
      poll,
      parseStatus,
    });

    await expect(collect(watcher)).rejects.toBeInstanceOf(DoclingTaskNotFoundError);
    expect(poll).not.toHaveBeenCalled();
  });

  it('falls back to long polling after a service WebSocket error', async () => {
    const poll = vi.fn(async () => task('success'));
    const sockets: FakeSocket[] = [];
    const factory = vi.fn(() => {
      const socket = new FakeSocket(current => {
        current.message({
          message: 'error',
          error: 'Server is busy',
        });
      });
      sockets.push(socket);
      return socket;
    });
    const watcher = watchTask({
      taskId: 'fallback',
      baseUrl: 'http://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: true,
      connectTimeoutMs: 100,
      webSocketFactory: factory,
      poll,
      parseStatus,
      sleep: async () => undefined,
      pollIntervalMs: 0,
      serverWaitSeconds: 0,
    });

    await expect(collect(watcher)).resolves.toEqual(['success']);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sockets[0]?.closed).toBe(true);
  });

  it('reconnects after an abnormal close using exponential delays', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const watcher = watchTask({
      taskId: 'reconnect',
      baseUrl: 'https://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 100,
      webSocketFactory: () => {
        attempts += 1;
        return new FakeSocket(socket => {
          if (attempts === 1) {
            socket.disconnect();
          } else {
            socket.message({ message: 'connection', task: task('success') });
          }
        });
      },
      poll: async () => task('success'),
      parseStatus,
      sleep: async milliseconds => {
        delays.push(milliseconds);
      },
    });

    await expect(collect(watcher)).resolves.toEqual(['success']);
    expect(attempts).toBe(2);
    expect(delays).toEqual([1_000]);
  });

  it('retries connection timeouts before reporting the stream unavailable', async () => {
    const sockets: HangingSocket[] = [];
    const delays: number[] = [];
    const factory = vi.fn(() => {
      const socket = new HangingSocket();
      sockets.push(socket);
      return socket;
    });
    const watcher = watchTask({
      taskId: 'connect-timeout',
      baseUrl: 'https://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 1,
      webSocketFactory: factory,
      poll: async () => task('success'),
      parseStatus,
      sleep: async milliseconds => {
        delays.push(milliseconds);
      },
    });

    await expect(collect(watcher)).rejects.toMatchObject({
      name: 'DoclingServiceUnavailableError',
      detail: 'WebSocket connection exceeded 1 ms',
    });
    expect(factory).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([1_000, 2_000, 4_000]);
    expect(sockets.every(socket => socket.closed)).toBe(true);
  });

  it('treats a clean close while requesting the next update as end of stream', async () => {
    const factory = vi.fn(() => {
      const socket = new FakeSocket(current => {
        current.message({ message: 'update', task: task('pending') });
      });
      socket.send = () => {
        const error = new Error('received 1000 (OK)');
        error.name = 'ConnectionClosedOK';
        throw error;
      };
      return socket;
    });
    const watcher = watchTask({
      taskId: 'clean-send-close',
      baseUrl: 'https://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 100,
      webSocketFactory: factory,
      poll: async () => task('success'),
      parseStatus,
    });

    await expect(collect(watcher)).resolves.toEqual(['pending']);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('treats a clean close event after requesting the next update as end of stream', async () => {
    const factory = vi.fn(() => {
      const socket = new FakeSocket(current => {
        current.message({ message: 'update', task: task('pending') });
      });
      socket.send = value => {
        socket.sent.push(value);
        queueMicrotask(() => {
          socket.readyState = 3;
          socket.cleanDisconnect();
        });
      };
      return socket;
    });
    const watcher = watchTask({
      taskId: 'clean-event-close',
      baseUrl: 'https://docling.example.test',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 100,
      webSocketFactory: factory,
      poll: async () => task('success'),
      parseStatus,
      sleep: async () => undefined,
    });

    await expect(collect(watcher)).resolves.toEqual(['pending']);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('closes the socket when the consumer stops early and supplies auth headers', async () => {
    let socket: FakeSocket | undefined;
    let factoryOptions: { headers: Readonly<Record<string, string>> } | undefined;
    const watcher = watchTask({
      taskId: 'early',
      baseUrl: 'https://docling.example.test',
      apiKey: 'secret',
      watcher: 'websocket',
      fallbackToPoll: false,
      connectTimeoutMs: 100,
      webSocketFactory: (_url, options) => {
        factoryOptions = options;
        socket = new FakeSocket(current => {
          current.message({ message: 'connection', task: task('pending') });
        });
        return socket;
      },
      poll: async () => task('success'),
      parseStatus,
    });

    await watcher.next();
    await watcher.return(undefined);

    expect(factoryOptions?.headers).toEqual({ 'X-Api-Key': 'secret' });
    expect(socket?.closed).toBe(true);
  });

  it('does not reconnect malformed envelopes and closes on callback errors', async () => {
    const malformedFactory = vi.fn(
      () =>
        new FakeSocket(socket => {
          socket.message({ message: 'not-docling' });
        })
    );
    await expect(
      collect(
        watchTask({
          taskId: 'malformed',
          baseUrl: 'https://docling.example.test',
          watcher: 'websocket',
          fallbackToPoll: false,
          connectTimeoutMs: 100,
          webSocketFactory: malformedFactory,
          poll: async () => task('success'),
          parseStatus,
        })
      )
    ).rejects.toMatchObject({ name: 'DoclingServiceUnavailableError' });
    expect(malformedFactory).toHaveBeenCalledTimes(1);

    let callbackSocket: FakeSocket | undefined;
    const callbackError = new Error('callback failed');
    await expect(
      collect(
        watchTask({
          taskId: 'callback',
          baseUrl: 'https://docling.example.test',
          watcher: 'websocket',
          fallbackToPoll: true,
          connectTimeoutMs: 100,
          webSocketFactory: () => {
            callbackSocket = new FakeSocket(socket => {
              socket.message({ message: 'connection', task: task('pending') });
            });
            return callbackSocket;
          },
          poll: async () => task('success'),
          parseStatus,
          onStatus: () => {
            throw callbackError;
          },
        })
      )
    ).rejects.toBe(callbackError);
    expect(callbackSocket?.closed).toBe(true);
  });
});

function task(status: TaskStatusResponse['task_status']): TaskStatusResponse {
  return {
    task_id: 'task',
    task_type: 'convert',
    task_status: status,
  };
}

function parseStatus(value: unknown): TaskStatusResponse {
  return value as TaskStatusResponse;
}

async function collect(
  generator: AsyncGenerator<TaskStatusResponse>
): Promise<string[]> {
  const statuses: string[] = [];
  for await (const status of generator) {
    statuses.push(status.task_status);
  }
  return statuses;
}
