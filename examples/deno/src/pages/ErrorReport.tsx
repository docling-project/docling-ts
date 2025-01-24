import Frame from "../components/Frame.tsx";
import { DocumentServiceError } from "../service/service.d.ts";

export default function ({ error }: { error: DocumentServiceError }) {
  return (
    <Frame>
      <dialog>
        {error.message}
        <a href="/">Go back</a>
      </dialog>
    </Frame>
  );
}
