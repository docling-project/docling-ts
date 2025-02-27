import { DocumentQuery, Payload } from "./service.d.ts";

export function isEmptyQuery(query: DocumentQuery) {
  return Object.values(query).every((v) => v.toString().trim().length === 0);
}

export function success<R>(result: R): Payload<R> {
  return { success: true, result };
}

export function error<R>(exception: any): Payload<R> {
  console.error(exception);

  return {
    success: false,
    error: exception.toString(),
  };
}
