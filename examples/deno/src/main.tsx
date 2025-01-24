import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/deno";
import Home from "./pages/Home.tsx";
import Conversion from "./pages/Conversion.tsx";
import { DocumentAppearance } from "./components/document/Document.tsx";
import { localDocumentService } from "./service/localService.ts";
import ErrorReport from "./pages/ErrorReport.tsx";

const documentService = localDocumentService("conversions");

const app = new Hono();

app.use("*", logger());

app.get("/static/*", serveStatic({ root: "." }));

app.get("/", (c) => c.html(<Home />));

app.post("/upload", async (c) => {
  const file = (await c.req.parseBody())["file"];

  if (file instanceof File) {
    const response = await documentService.convert(file);

    return response.success
      ? c.redirect(`/conversions/${response.result.id}`)
      : c.html(<ErrorReport error={response.error} />);
  } else {
    return c.html(
      <ErrorReport error={{ message: "Your file could not be uploaded." }} />
    );
  }
});

app.get("/conversions/:id", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode") as DocumentAppearance["mode"];
  const response = await documentService.fetch(id);

  return c.html(
    response.success ? (
      <Conversion document={response.result} appearance={{ mode }} />
    ) : (
      <ErrorReport error={response.error} />
    )
  );
});

Deno.serve(app.fetch);
