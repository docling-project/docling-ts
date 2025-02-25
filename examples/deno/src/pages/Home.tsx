import { DocumentService } from "../service/service.ts";
import Frame from "../components/Frame.tsx";

export default async function ({ service }: { service: DocumentService }) {
  const collections = await service.readCollections();

  if (collections.success) {
    return (
      <Frame>
        <main class="container">
          <img src="https://ds4sd.github.io/docling/assets/logo.png" />

          {collections.result.map((c) => (
            <a href={c}>{c}</a>
          ))}

          {collections.result.length === 0 ? (<span>Create a collection to get started:</span>) : <span>Or create a new collection:</span>}

          <form action="collection/create">
            <input name="collection-name" type="text" placeholder="Enter new collection name" />

            <input type="submit" value="Create" />
          </form>

          {/* <form action="upload" method="post" enctype="multipart/form-data">
            <img
              src="https://ds4sd.github.io/docling/assets/logo.png"
              onclick="document.getElementById('file').click()"
            />
  
            <label for="file">Convert a document</label>
            <input
              id="file"
              name="file"
              type="file"
              onchange="form.className += ' loading'; form.submit();"
            />
  
            <noscript>
              <input type="submit" />
            </noscript>
          </form> */}
        </main>
      </Frame>
    );
  } else {
    <Frame>
      <dialog open>{collections.error.message}</dialog>
    </Frame>;
  }
}
