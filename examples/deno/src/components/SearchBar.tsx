import type { DocumentQuery } from "../service/service.d.ts";
import { queryAsExpression } from "../service/util.ts";

export default function ({ query = {} }: { query?: DocumentQuery }) {
  return (
    <form id="searchbar">
      <input
        type="search"
        id="search"
        name="q"
        placeholder="Search for documents"
        autofocus
      >
        {queryAsExpression(query)}
      </input>
    </form>
  );
}
