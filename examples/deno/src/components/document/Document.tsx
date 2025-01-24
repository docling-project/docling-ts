import type { DocItem, DoclingDocument, PageItem } from "docling";
import { isDoclingDocItem, iterateItems } from "docling";
import { sortBy } from "lodash";
import { components, FallbackComponent, ItemType } from "./DocItem.tsx";

export interface DocumentAppearance {
  mode: "full" | "linear";
  scale: number;
}

export const defaultDocumentAppearance: DocumentAppearance = {
  mode: "full",
  scale: 2,
};

export default function Document({
  document,
  appearance = {},
}: {
  document: DoclingDocument;
  appearance?: Partial<DocumentAppearance>;
}) {
  const pages: PageItem[] = sortBy<PageItem>(
    Object.values(document.pages ?? {}),
    (p: PageItem) => p.page_no
  );

  const items = Array.from(iterateItems(document)) as [DocItem, number][];

  const pageToItems: Record<number, DocItem[]> = {};
  for (const p of pages) {
    pageToItems[p.page_no] = [];
  }
  for (const [item, _] of items) {
    for (const p of item.prov ?? []) {
      pageToItems[p.page_no].push(item);
    }
  }

  // Layout depends on display mode.
  const PageComponent = appearance.mode === "linear" ? LinearPage : Page;

  return (
    <div class="brd-pages">
      {pages.map((p) => (
        <PageComponent
          page={p}
          children={pageToItems[p.page_no]}
          appearance={{ ...defaultDocumentAppearance, ...appearance }}
        />
      ))}
    </div>
  );
}

export function Page({
  page,
  children,
  appearance,
}: {
  page: PageItem;
  children: DocItem[];
  appearance: DocumentAppearance;
}) {
  const { page_no, size } = page;
  const { width = 1 } = size;
  const { scale } = appearance;
  const id = `pages/${page_no}`;

  return (
    <div id={id} class="brd-page">
      <header class="brd-page-header">Page {page.page_no}</header>

      <div class="brd-page-content">
        <a href={`#${id}`}>
          <img
            style={{
              viewTransitionName: `page-${page_no}`,
              width: `${scale * width}px`,
              maxWidth: "100%",
            }}
            src={page?.image?.uri}
          />
        </a>

        {children.map((item) => (
          <Item pageItem={page} item={item} />
        ))}
      </div>
    </div>
  );
}

export function Item({
  pageItem,
  item,
}: {
  pageItem: PageItem;
  item: DocItem;
}) {
  const prov = item.prov?.find((p) => p.page_no === pageItem.page_no)!;
  const id = item.self_ref.slice(1);
  const { l, r, t, b } = prov.bbox;
  const { width = 1, height = 1 } = pageItem.size;

  return (
    <a
      id={id}
      class="brd-page-item"
      style={{
        viewTransitionName: `item-${item.self_ref}`.replaceAll(/\#|\//g, "-"),
        left: `${(100 * l) / width}%`,
        top: `${(100 * (height - t)) / height}%`,
        width: `${(100 * (r - l)) / width}%`,
        height: `${(100 * (t - b)) / height}%`,
      }}
      href={item.self_ref}
    />
  );
}

export function LinearPage({
  page,
  children,
  appearance,
}: {
  page: PageItem;
  children: DocItem[];
  appearance: DocumentAppearance;
}) {
  return (
    <div
      class="brd-page"
      style={{ viewTransitionName: `page-${page.page_no}` }}
    >
      <header class="brd-page-header">Page {page.page_no}</header>

      {children.map((item) => (
        <LinearItem pageItem={page} item={item} appearance={appearance} />
      ))}
    </div>
  );
}

export function LinearItem({
  pageItem,
  item,
  appearance,
}: {
  pageItem: PageItem;
  item: DocItem;
  appearance: DocumentAppearance;
}) {
  const prov = item.prov?.find((p) => p.page_no === pageItem.page_no)!;
  const id = item.self_ref.slice(1);
  const { l, r, t, b } = prov.bbox;
  const { width = 1, height = 1 } = pageItem.size;
  const { scale } = appearance;

  return (
    <a id={id} class="brd-page-slice" href={item.self_ref}>
      <div
        class="brd-document-item"
        style={{
          maxWidth: `${scale * (r - l)}px`,
        }}
      >
        <DocumentItem item={item} />
      </div>

      <div
        style={{
          maxWidth: `${scale * (r - l)}px`,
        }}
      >
        {/* To crop the image. TODO: Isolate as component. */}
        <div
          class="brd-page-slice-image"
          style={{
            ...{
              viewTransitionName: `item-${item.self_ref}`.replaceAll(
                /\#|\//g,
                "-"
              ),
              width: `${scale * (r - l)}px`,
              height: `${scale * (t - b)}px`,
            },
          }}
          href={item.self_ref}
          title={JSON.stringify(item, null, 2)}
        >
          <img
            style={{
              width: `${scale * width}px`,
              height: `${scale * height}px`,
              transform: `translate(${-scale * l}px, ${
                -scale * (height - t)
              }px)`,
            }}
            src={pageItem.image?.uri}
          />
        </div>
      </div>
    </a>
  );
}

function DocumentItem({ item }: { item: DocItem }) {
  const itemTypeName = (Object.keys(components) as ItemType[]).find((name) =>
    isDoclingDocItem[name]?.(item)
  );
  const Component = itemTypeName ? components[itemTypeName] : FallbackComponent;

  return <Component item={item} />;
}
