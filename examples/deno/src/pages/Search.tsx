import type {
  DocumentQuery,
  TaggedDocument,
  Payload,
} from "../service/service.d.ts";
import Frame from "../components/Frame.tsx";
import SearchBar from "../components/SearchBar.tsx";
import Documents from "../components/Documents.tsx";

export default function ({
  query,
  documents,
}: {
  query: DocumentQuery;
  documents: Payload<TaggedDocument[]>;
}) {
  return (
    <Frame>
      <header class="search">
        <a href="/">
          <img id="icon" src="/static/logo.png" />
        </a>

        <SearchBar query={query} />
      </header>

      <Documents query={query} documents={documents} />
    </Frame>
  );
}
