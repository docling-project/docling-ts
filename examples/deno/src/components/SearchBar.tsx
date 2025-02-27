import { DocumentQuery } from "../service/service.d.ts";

export default function ({ query = {} }: { query?: DocumentQuery }) {
  return (
    <form>
      <input
        type="search"
        id="search"
        name="search"
        placeholder="Search for documents"
        autofocus
      />
    </form>
  );
}
