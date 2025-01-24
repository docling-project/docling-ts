import Frame from "../components/Frame.tsx";

export default function () {
  return (
    <Frame>
      <main class="brd-home">
        <form action="upload" method="post" enctype="multipart/form-data">
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
        </form>
      </main>
    </Frame>
  );
}
