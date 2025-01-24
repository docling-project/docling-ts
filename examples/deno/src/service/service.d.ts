import { DoclingDocument } from "docling";

export interface DocumentService {
  convert(file: File): Response<{ id: string }>;

  fetch(id: string): Response<DoclingDocument>;
}

type Response<R> = Promise<Payload<R>>;

type Payload<R> =
  | {
      success: true;
      result: R;
    }
  | {
      success: false;
      error: DocumentServiceError;
    };

export interface DocumentServiceError {
  message: string;
}
