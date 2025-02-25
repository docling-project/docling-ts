import { exists } from "fs";
import { DocumentService, error, success } from "./service.ts";
import { DoclingDocument } from "docling";

export function localDocumentService(directory: string): DocumentService {
  return {
    async createCollection(name: string) {
      try {
        await Deno.mkdir(`${directory}/${name}`);

        return success(undefined);
      } catch (ex) {
        return error(ex);
      }
    },

    readCollections() {
      try {
        return success(
          Array.from(Deno.readDirSync(directory))
            .filter((e) => e.isDirectory)
            .map((e) => e.name)
        );
      } catch (ex) {
        return error(ex);
      }
    },

    deleteCollection(collectionId: string) {
      try {
        Deno.remove(`${directory}/${collectionId}`);
        return success(undefined);
      } catch (ex) {
        return error(ex);
      }
    },

    async convertDocument(collectionId: string, file: File) {
      // If not cached => Run conversion with Docling.
      if (!(await exists(jsonPath(collectionId, file.name)))) {
        const command = new Deno.Command("poetry", {
          args: [
            "run",
            "-C",
            "localconvert",
            "python",
            "localconvert/localconvert/convert.py",
            file.name,
          ],
          stdin: "piped",
          stdout: "piped",
          stderr: "piped",
        });
        const child = await command.spawn();

        // Pipe process output to file.
        child.stdout.pipeTo(
          Deno.openSync(jsonPath(collectionId, file.name), {
            write: true,
            create: true,
          }).writable
        );

        // Pass PDF contents to process.
        const writer = child.stdin.getWriter();
        await writer.write(await file.bytes());
        writer.releaseLock();
        await child.stdin.close();

        const status = await child.status;

        if (!status.success) {
          const message = new TextDecoder().decode(child.stderr as any);

          return error({ message: `Failed to convert document: ${message}` });
        }
      }

      return success({ documentId: file.name });
    },

    readDocuments(collectionId: string) {
      try {
        return success(
          Array.from(Deno.readDirSync(`${directory}/${collectionId}`))
            .filter((e) => e.isDirectory)
            .map((e) => e.name)
        );
      } catch (ex) {
        return error(ex);
      }
    },

    async readDocument(collectionId: string, documentId: string) {
      try {
        return success(
          JSON.parse(
            await Deno.readTextFile(jsonPath(collectionId, documentId))
          ) as DoclingDocument
        );
      } catch (ex) {
        return error(ex);
      }
    },

    deleteDocument(collectionId: string, documentId: string) {
      try {
        Deno.remove(jsonPath(collectionId, documentId));
        return success(undefined);
      } catch (ex) {
        return error(ex);
      }
    },
  };

  function jsonPath(collectionId: string, documentId: string) {
    return `${directory}/${collectionId}/${documentId}.json`;
  }
}
