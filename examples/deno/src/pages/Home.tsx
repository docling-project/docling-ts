import { DocumentService } from "../service/service.d.ts";
import Frame from "../components/Frame.tsx";
import SearchBar from "../components/SearchBar.tsx";

export default async function ({ service }: { service: DocumentService }) {
  return (
    <Frame>
      <main class="home">
        <img id="icon" src="https://ds4sd.github.io/docling/assets/logo.png" />
        <h1>Doc Hunt</h1>

        <SearchBar />
        
        <form action="/" method="post" enctype="multipart/form-data">
          <h5>Add a document</h5>

          <input
            id="file"
            name="file"
            type="file"
            value="Add documents"
            onchange="document.getElementById('icon').className += 'loading'; form.submit();"
          >
            Add documents
          </input>

          <noscript>
            <input type="submit" />
          </noscript>
        </form>
      </main>
    </Frame>
  );
}
