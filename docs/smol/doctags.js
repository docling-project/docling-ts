import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.mjs";
const { loadPackage, pyimport, FS } = await loadPyodide();

// Load docling dependencies.
// Pin pillow first to ensure that Pyodide uses its own, prepackaged version.
await loadPackage("micropip");
await pyimport("micropip").install(["pillow==10.2.0", "docling-core==2.24"]);

const { DoclingDocument } = await pyimport("docling_core.types");
const { Image } = await pyimport("PIL");

export async function fromTags(
  tokens,
  imageFile,
  doc = DoclingDocument.callKwargs({ name: "DocTag conversion" })
) {
  let image;
  if (imageFile) {
    FS.writeFile("tmp_img", new Uint8Array(await imageFile.arrayBuffer()), {
      encoding: "binary",
    });
    image = Image.open("tmp_img");
  }

  const pages = [{ tokens, image }];
  doc.load_from_doctags({ pages });

  return doc;
}

export function toHtml(doc) {
  return doc.export_to_html.callKwargs({ image_mode: "embedded" });
}

export function toMarkdown(doc) {
  return doc.export_to_markdown.callKwargs({ image_mode: "embedded" });
}

export function toJson(doc) {
  return doc.export_to_dict().toJs({ dict_converter: Object.fromEntries });
}
