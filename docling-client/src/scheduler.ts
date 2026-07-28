import { DoclingProtocolError } from './errors';

export interface BoundedMapOptions {
  maxInFlight: number;
  ordered: boolean;
  signal?: AbortSignal;
}

interface Completed<TItem, TResult> {
  index: number;
  item: TItem;
  outcome: TResult | Error;
}

export async function* boundedOutcomes<TItem, TResult>(
  items: Iterable<TItem> | AsyncIterable<TItem>,
  process: (item: TItem, index: number, signal: AbortSignal) => Promise<TResult>,
  options: BoundedMapOptions
): AsyncGenerator<Completed<TItem, TResult>> {
  validateConcurrency(options.maxInFlight);
  const iterator = toAsyncIterator(items);
  const controller = new AbortController();
  const signal = combineAbortSignals(options.signal, controller.signal);
  if (signal.aborted) {
    throw abortReason(signal);
  }
  const active = new Map<number, Promise<Completed<TItem, TResult>>>();
  const buffered = new Map<number, Completed<TItem, TResult>>();
  let nextInputIndex = 0;
  let nextOutputIndex = 0;
  let exhausted = false;

  const startNext = async (): Promise<void> => {
    if (exhausted || signal.aborted) {
      return;
    }
    const next = await iterator.next();
    if (next.done === true) {
      exhausted = true;
      return;
    }
    const index = nextInputIndex;
    nextInputIndex += 1;
    const item = next.value;
    const operation = process(item, index, signal)
      .then(outcome => ({ index, item, outcome }))
      .catch((error: unknown) => {
        if (signal.aborted) {
          throw abortReason(signal);
        }
        return {
          index,
          item,
          outcome: normalizeError(error),
        };
      });
    active.set(index, operation);
  };

  try {
    while (active.size < options.maxInFlight && !exhausted) {
      await startNext();
    }

    while (active.size > 0) {
      const completed = await Promise.race(active.values());
      active.delete(completed.index);
      await startNext();

      if (!options.ordered) {
        yield completed;
        continue;
      }
      buffered.set(completed.index, completed);
      while (buffered.has(nextOutputIndex)) {
        const ready = buffered.get(nextOutputIndex);
        buffered.delete(nextOutputIndex);
        nextOutputIndex += 1;
        if (ready !== undefined) {
          yield ready;
        }
      }
    }
  } finally {
    controller.abort(new Error('Docling bounded operation stopped'));
    await Promise.allSettled(active.values());
    await iterator.return?.();
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

export function validateConcurrency(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 512) {
    throw new DoclingProtocolError(
      'Concurrency must be a safe integer between 1 and 512'
    );
  }
  return value;
}

function toAsyncIterator<T>(items: Iterable<T> | AsyncIterable<T>): AsyncIterator<T> {
  if (Symbol.asyncIterator in Object(items)) {
    return (items as AsyncIterable<T>)[Symbol.asyncIterator]();
  }
  const iterator = (items as Iterable<T>)[Symbol.iterator]();
  return {
    next: async () => iterator.next(),
    return:
      iterator.return === undefined
        ? undefined
        : async () => {
            const returned = iterator.return?.();
            return returned ?? { done: true, value: undefined };
          },
  };
}

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  internalSignal: AbortSignal
): AbortSignal {
  if (callerSignal === undefined) {
    return internalSignal;
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([callerSignal, internalSignal]);
  }
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  if (callerSignal.aborted) {
    abort(callerSignal);
  } else {
    callerSignal.addEventListener('abort', () => abort(callerSignal), {
      once: true,
    });
  }
  internalSignal.addEventListener('abort', () => abort(internalSignal), {
    once: true,
  });
  return controller.signal;
}
