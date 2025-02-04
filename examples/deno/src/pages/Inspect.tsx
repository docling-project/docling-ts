import { DoclingDocument } from "docling";
import Frame from "../components/Frame.tsx";

export type DocumentAppearance = "full" | "linear";

export default function ({
  src,
  document,
  appearance = "full",
  items,
}: {
  src: string;
  document: DoclingDocument;
  appearance?: DocumentAppearance;
  items?: string;
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

        {appearance.mode === "linear" ? (
          <docling-list src={src} items={items} />
        ) : (
          <docling-img src={src} items={items} backdrop trim="pages" />
        )}
      </main>
    </Frame>
  );
}
