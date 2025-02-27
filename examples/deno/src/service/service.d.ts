import { DoclingDocument } from "docling";

export interface DocumentService {
  convert(file: File, labels?: string[]): Response<{ id: string }>;
  search(query: DocumentQuery, offset?: number, limit?: number): Response<DocumentSearchEntry[]>;
  read(id: string): Response<DoclingDocument>;
  delete(id: string): Response;
}

export interface DocumentQuery {
  keywords?: string;
  id?: string;
  filename?: string;
}

export interface DocumentSearchEntry {
  id: string;
  url: string;
  document: DoclingDocument;
}

type Response<R = void> = Promise<Payload<R>>;

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
