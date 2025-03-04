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
        data-theme="light"
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
  const isConverted = document.origin?.uri;

  return (
    <div class="document">
      <div class={"header " + (isConverted ? "" : "processing")}>
        <span aria-busy={!isConverted}>
          <b>{document.name}</b>
        </span>
      </div>

      {isConverted && (
        <docling-img src={document.origin!.uri} backdrop />
      )}
    </div>
  );
}
