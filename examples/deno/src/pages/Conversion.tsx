import { DoclingDocument } from "docling";
import Document, {
  DocumentAppearance,
} from "../components/document/Document.tsx";
import Frame from "../components/Frame.tsx";

export default function ({
  document,
  appearance = {},
}: {
  document: DoclingDocument;
  appearance?: Partial<DocumentAppearance>;
}) {
  const { mode } = appearance;
  const altMode = mode === "linear" ? "full" : "linear";

  return (
    <Frame>
      <main class="brd-main">
        <header class="brd-main-header" />

        <header class="brd-doc-header">
          <a href="/" title="Go back">
            <img src={`/static/image/chevron.svg`} />
          </a>

          <div class="brd-doc-name">
            <b>{document.name}</b>
          </div>

          <a href={`?mode=${altMode}`} title={`Show ${altMode} layout`}>
            <img src={`/static/image/${altMode}.svg`} />
          </a>
        </header>

        <Document document={document} appearance={appearance} />
      </main>
    </Frame>
  );
}
