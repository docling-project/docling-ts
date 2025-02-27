import Frame from "../components/Frame.tsx";
import { DocumentServiceError } from "../service/service.d.ts";

export default function ({ error }: { error: DocumentServiceError }) {
  return (
    <Frame>
      <dialog open>
        <article>
          <header>
            <button aria-label="Close" rel="prev" href=".."></button>
            <p>
              <strong>Oops</strong>
            </p>
          </header>
          <p>{error.message}</p>

          <a href="..">Go back</a>
        </article>
      </dialog>
    </Frame>
  );
}
