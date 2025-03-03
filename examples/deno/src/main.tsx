import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { logger } from "hono/logger";
import { localDocumentService } from "./service/localService.ts";
import type { DocumentQuery } from "./service/service.d.ts";
import { isEmptyQuery, parseQuery, queryAsExpression } from "./service/util.ts";
import ErrorReport from "./pages/ErrorReport.tsx";
import Home from "./pages/Home.tsx";
import Search from "./pages/Search.tsx";
import Documents from "./components/Documents.tsx";

const paths = {
  upload: "documents/uploads",
  convert: "documents/conversions",
};
const documentService = localDocumentService(paths);

const app = new Hono();

app.use("*", logger());

// Serve files.
app.get("/static/*", serveStatic({ root: "." }));
app.get("/node_modules/*", serveStatic({ root: "." }));
app.get(`/${paths.convert}/*`, serveStatic({ root: "." }));

// Serve pages.

app.get("/", async (c) => {
  // TODO: Zod validation.
  const query = c.req.query() as DocumentQuery;
  const normalizedQuery = parseQuery(queryAsExpression(query));

  if (isEmptyQuery(query)) {
    return c.html(<Home />);
  } else {
    const response = await documentService.search(normalizedQuery);

    return c.html(
      response.success ? (
        <Search query={normalizedQuery} documents={response} />
      ) : (
        <ErrorReport error={response.error} />
      )
    );
  }
});

app.get("/documents", async (c) => {
  const query = c.req.queries() as DocumentQuery;
  const documents = await documentService.search(query);

  return c.html(<Documents query={query} documents={documents} />)
});

app.post("/", async (c) => {
  const filesRaw = (await c.req.parseBody({ all: true }))["files"];
  const files = (Array.isArray(filesRaw) ? filesRaw : [filesRaw]).filter(
    (f) => f instanceof File
  );
  const response = await documentService.convert(files);

  return response.success
    ? c.redirect(`?batch=${response.result.batch}`)
    : c.html(<ErrorReport error={response.error} />);
});

Deno.serve(app.fetch);
