import { DocumentQuery, DocumentService } from "./service.d.ts";
import { DoclingDocument } from "docling";
import { error, success } from "./util.ts";

export function localDocumentService(directory: string): DocumentService {
  return {
    async convert(file: File, labels: string[] = []) {
      const id = `${file.name}_${crypto.randomUUID()}`;

      // Wrap conversion in Python process.
      // If not cached => Run conversion with Docling.
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
        Deno.openSync(path(id), {
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

      return success({ id });
    },

    async search(query: DocumentQuery, offset?: number, limit?: number) {
      try {
        const id = (query.id ?? "").trim();

        if (id.length > 0) {
          const doc = await this.read(id);

          if (doc.success) {
            return success([{ id, url: path(id), document: doc.result }]);
          } else {
            return doc;
          }
        } else {
          throw "Missing search argument";
        }
      } catch (ex) {
        return error(ex);
      }
    },

    async read(id: string) {
      try {
        return success(
          JSON.parse(await Deno.readTextFile(path(id))) as DoclingDocument
        );
      } catch (ex) {
        return error(ex);
      }
    },

    async delete(id: string) {
      try {
        await Deno.remove(path(id));
        return success(undefined);
      } catch (ex) {
        return error(ex);
      }
    },
  };

  function path(id: string) {
    return `${directory}/${id}.json`;
  }
}
