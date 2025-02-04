import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/deno";
import Home from "./pages/Home.tsx";
import Inspect, { DocumentAppearance } from "./pages/Inspect.tsx";
import { localDocumentService } from "./service/localService.ts";
import ErrorReport from "./pages/ErrorReport.tsx";

const documentService = localDocumentService("conversions");

const app = new Hono();

app.use("*", logger());

// Serve files.
app.get("/static/*", serveStatic({ root: "." }));
app.get("/node_modules/*", serveStatic({ root: "." }));
app.get("/conversions/:name", serveStatic({ root: "." }));

// Serve pages.
app.get("/", (c) => c.html(<Home />));

app.post("/upload", async (c) => {
  const file = (await c.req.parseBody())["file"];

  if (file instanceof File) {
    const response = await documentService.convert(file);

    return response.success
      ? c.redirect(`/inspect/${response.result.id}`)
      : c.html(<ErrorReport error={response.error} />);
  } else {
    return c.html(
      <ErrorReport error={{ message: "Your file could not be uploaded." }} />
    );
  }
});

app.get("/inspect/:id", async (c) => {
  const id = c.req.param("id");
  const mode = c.req.query("mode") as DocumentAppearance;
  const items = c.req.query("items");
  const response = await documentService.fetch(id);

  return c.html(
    response.success ? (
      <Inspect
        src={`/conversions/${id}.json`}
        document={response.result}
        appearance={{ mode }}
        items={items
          ?.split(",")
          ?.map((r) => `#/${r}`)
          .join(",")}
      />
    ) : (
      <ErrorReport error={response.error} />
    )
  );
});

Deno.serve(app.fetch);
