import * as dl from "docling";
import { JSX } from "hono/jsx/jsx-runtime";
import TableItem from "./TableItem.tsx";

export function FallbackComponent({}: { item: dl.DocItem }) {
  return <div></div>;
}

function ListItem({ item }: { item: dl.ListItem }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <span>{item.text}</span>
    </div>
  );
}

function SectionHeaderItem({ item }: { item: dl.SectionHeaderItem }) {
  return <h2>{item.text}</h2>;
}

function TextItem({ item }: { item: dl.TextItem }) {
  return <p>{item.text}</p>;
}

export type ItemType = keyof typeof dl.isDoclingDocItem;

export const components: Record<
  ItemType,
  (props: { item: any }) => JSX.Element
> = {
  ListItem,
  PictureItem: FallbackComponent,
  SectionHeaderItem,
  TableItem,
  TextItem,
};
