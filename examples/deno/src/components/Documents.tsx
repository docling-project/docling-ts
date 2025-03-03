import type {
  DocumentQuery,
  Payload,
  TaggedDocument,
} from "../service/service.d.ts";
import { queryAsSearchParams } from "../service/util.ts";
import ErrorReport from "../pages/ErrorReport.tsx";

export default function ({
  query,
  documents,
}: {
  query: DocumentQuery;
  documents: Payload<TaggedDocument[]>;
}) {
  if (documents.success) {
    const hasProcessing = documents.result.some((d) => !d.pages);

    return (
      <main
        class="documents"
        hx-get={`/documents?${queryAsSearchParams(query)}`}
        hx-swap="outerHTML"
        hx-trigger={hasProcessing ? "every 5s" : undefined}
      >
        {documents.result.map((d) => (
          <Document document={d} />
        ))}
      </main>
    );
  } else {
    return <ErrorReport error={documents.error} />;
  }
}

function Document({ document }: { document: TaggedDocument }) {
  const isProcessing = !document.pages;

  return (
    <div class="document">
      <div class={"header " + isProcessing ? "processing" : ""}>
        <span aria-busy={isProcessing}>
          <b>{document.name}</b>
        </span>
      </div>

      {document.origin?.uri && (
        <docling-img src={document.origin.uri} backdrop />
      )}
    </div>
  );
}
