import { DocumentQuery, DocumentSearchEntry } from "../service/service.d.ts";
import Frame from "../components/Frame.tsx";
import SearchBar from "../components/SearchBar.tsx";

export default function ({
  query,
  documents,
}: {
  query: DocumentQuery;
  documents: DocumentSearchEntry[];
}) {
  return (
    <Frame>
      <header class="search">
        <a href="/">
          <img
            id="icon"
            src="https://ds4sd.github.io/docling/assets/logo.png"
          />
        </a>

        <SearchBar query={query} />
      </header>

      <main class="search">
        {documents.map(({ id, url }) => (
          <docling-img src={url} backdrop />
        ))}
      </main>
    </Frame>
  );
}
