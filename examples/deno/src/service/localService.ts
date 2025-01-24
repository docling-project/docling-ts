import { exists } from "fs";
import { DocumentService } from "./service.d.ts";

export function localDocumentService(directory: string): DocumentService {
  return {
    async convert(file: File) {
      // Store document for Docling.
      await Deno.writeFile(docPath(file.name), file.stream());

      // If not cached => Run conversion with Docling.
      if (!(await exists(jsonPath(file.name)))) {
        const command = new Deno.Command("docling", {
          args: ["--to", "json", "--output", "conversions", docPath(file.name)],
        });
        const { code } = await command.output();

        if (code > 0) {
          return {
            success: false,
            error: { message: `Failed to convert document.` },
          };
        }
      }

      return { success: true, result: { id: file.name } };
    },

    async fetch(id: string) {
      try {
        return {
          success: true,
          result: JSON.parse(await Deno.readTextFile(jsonPath(id))),
        };
      } catch (ex: any) {
        console.error(ex);
        return {
          success: false,
          error: ex.toString(),
        };
      }
    },
  };

  function docPath(fileName: string) {
    return `${directory}/${fileName}.src`;
  }

  function jsonPath(fileName: string) {
    const outputPathParts = docPath(fileName).split(".");
    return outputPathParts
      .map((p, i) => (i === outputPathParts.length - 1 ? "json" : p))
      .join(".");
  }
}
