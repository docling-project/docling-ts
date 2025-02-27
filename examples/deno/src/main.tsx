import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/deno";
import { localDocumentService } from "./service/localService.ts";
import { DocumentQuery } from "./service/service.d.ts";
import ErrorReport from "./pages/ErrorReport.tsx";
import Home from "./pages/Home.tsx";
import Search from "./pages/Search.tsx";
import { isEmptyQuery } from "./service/util.ts";

const conversionPath = "conversions";
const pageLimit = 10;
const documentService = localDocumentService(conversionPath);

const app = new Hono();

app.use("*", logger());

// Serve files.
app.get("/static/*", serveStatic({ root: "." }));
app.get("/node_modules/*", serveStatic({ root: "." }));
app.get(`/${conversionPath}/*`, serveStatic({ root: "." }));

// Serve pages.

app.get("/", async (c) => {
  // TODO: Zod validation.
  const { page, ...query } = c.req.query() as unknown as DocumentQuery & {
    page: string;
  };

  if (isEmptyQuery(query)) {
    return c.html(<Home service={documentService} />);
  } else {
    const response = await documentService.search(
      query,
      Number(page) * pageLimit,
      pageLimit
    );

    return c.html(
      response.success ? (
        <Search query={query} documents={response.result} />
      ) : (
        <ErrorReport error={response.error} />
      )
    );
  }
});

app.post("/", async (c) => {
  const file = (await c.req.parseBody())["file"];

  if (file instanceof File) {
    const response = await documentService.convert(file);

    return response.success
      ? c.redirect(`?id=${response.result.id}`)
      : c.html(<ErrorReport error={response.error} />);
  } else {
    return c.html(
      <ErrorReport error={{ message: "Your file could not be uploaded." }} />
    );
  }
});

Deno.serve(app.fetch);
