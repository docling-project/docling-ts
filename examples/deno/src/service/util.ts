import type { DocumentQuery, Payload } from "./service.d.ts";
import { groupBy, mapValues } from "lodash";

export function isEmptyQuery(query: DocumentQuery): boolean {
  return Object.values(query).every((v) => v.toString().trim().length === 0);
}

export function queryAsExpression(query: DocumentQuery): string {
  const { q, ...keyeds } = query;

  const parts = Object.entries(keyeds).flatMap(([k, v]) =>
    (Array.isArray(v) ? v : [v]).map((mv) => `${k}:${mv}`)
  );

  if (q) {
    parts.push(q);
  }

  return parts.join(" ");
}

export function queryAsSearchParams(query: DocumentQuery): string {
  return Object.entries(query)
    .flatMap(([k, vs]) =>
      (Array.isArray(vs) ? vs : [vs]).map((v) => `${k}=${v}`)
    )
    .join("&");
}

export function parseQuery(query: string): DocumentQuery {
  const parts = query.split(/\s+/g);
  const pairs = parts
    .map((p) => p.trim().split(":"))
    .map(([k, ...r]) => [k, (r ?? []).join(":")]);
  const newQuery: DocumentQuery = mapValues(
    groupBy(
      pairs.filter((p) => p.length > 1),
      (p: string) => p[0]
    ),
    (v: string[][]) => v.map((vs) => vs[1])
  );

  const qs = pairs.filter((p) => p.length === 1);
  if (qs.length > 0) {
    newQuery.q = qs.map((p) => p[0]).join(" ");
  }

  return newQuery;
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
