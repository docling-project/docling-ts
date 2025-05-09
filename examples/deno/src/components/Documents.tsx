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
        hx-get={
          hasProcessing ? `/documents?${queryAsSearchParams(query)}` : undefined
        }
        hx-trigger={hasProcessing ? "every 5s" : undefined}
        hx-swap="outerHTML"
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
        <docling-img src={document.origin!.uri} backdrop pagenumbers>
          {/* <docling-overlay></docling-overlay> */}

          <docling-tooltip>
            {/* <docling-template><p>{"${item.self_ref}"}</p></docling-template> */}
          </docling-tooltip>

          {/* <docling-trace>
          </docling-trace> */}
        </docling-img>
      )}
    </div>
  );
}
