import Frame from "../components/Frame.tsx";
import SearchBar from "../components/SearchBar.tsx";

export default function () {
  return (
    <Frame>
      <main class="home">
        <img id="icon" src="/static/logo.png" />
        <h1>Doc Hunt</h1>

        <SearchBar />

        <form action="/" method="post" enctype="multipart/form-data">
          <h5>Add documents</h5>

          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept="application/pdf,image/*"
            capture="environment"
            required
            onchange="document.getElementById('icon').className += 'loading'; form.submit();"
          />

          <noscript>
            <input type="submit" />
          </noscript>
        </form>
      </main>
    </Frame>
  );
}
