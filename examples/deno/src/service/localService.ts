import type {
  DocumentQuery,
  DocumentService,
  TaggedDocument,
} from "./service.d.ts";
import { error, success } from "./util.ts";
import namor from "namor";

export function localDocumentService(paths: {
  upload: string;
  convert: string;
}): DocumentService {
  return {
    async convert(files: File[], labels: string[] = []) {
      const batch = namor.generate();

      try {
        // Register pending conversions.
        for (const file of files) {
          await Deno.mkdir(path(paths.convert, batch, file.name), {
            recursive: true,
          });
          await Deno.writeTextFile(
            path(paths.convert, batch, file.name, `${file.name}.json`),
            JSON.stringify(pendingDocumentOf(file), null, 2),
            {}
          );

          await Deno.mkdir(path(paths.upload, batch), { recursive: true });
          await Deno.writeFile(
            path(paths.upload, batch, file.name),
            await file.bytes()
          );
        }

        return success({ batch });
      } catch (ex) {
        console.error(ex);
        throw "Upload failure.";
      }
    },

    async search(query: DocumentQuery, offset?: number, limit?: number) {
      const { batch = [], filename = [] } = query;

      try {
        const documents: TaggedDocument[] = [];

        if (batch.length > 0) {
          if (filename.length > 0) {
            const doc = JSON.parse(
              await Deno.readTextFile(
                path(paths.convert, batch[0], filename[0])
              )
            ) as TaggedDocument;

            documents.push(doc);
          } else {
            console.log("Read batch:", batch);

            for await (const entry of Deno.readDir(
              path(paths.convert, batch[0])
            )) {
              console.log("Entry: ", entry);

              if (entry.isDirectory) {
                const doc = JSON.parse(
                  await Deno.readTextFile(
                    path(
                      paths.convert,
                      batch[0],
                      entry.name,
                      `${entry.name}.json`
                    )
                  )
                ) as TaggedDocument;

                documents.push(doc);
              }
            }
          }
        } else {
          throw "Invalid search parameters.";
        }

        return success(documents);
      } catch (ex) {
        return error(ex);
      }
    },

    async delete(query: DocumentQuery) {
      try {
        // await Deno.remove(path(id));
        return success(undefined);
      } catch (ex) {
        return error(ex);
      }
    },
  };

  function path(...parts: string[]) {
    return parts.join("/");
  }

  function pendingDocumentOf(file: File) {
    return {
      schema_name: "DoclingDocument",
      name: file.name.split(".").slice(0, -1).join("."),
      origin: {
        mimetype: "application/pdf",
        binary_hash: 0,
        filename: file.name,
      },
      annotations: [
        {
          kind: "tag",
          tag: "pending",
        },
      ],
    };
  }
}
