import { DoclingDocument } from "docling";

export interface DocumentService {
  convert(files: File[], labels?: string[]): Response<{ batch: string }>;
  search(query: DocumentQuery): Response<TaggedDocument[]>;
  delete(query: DocumentQuery): Response;
}

export interface DocumentQuery {
  page?: number;
  batch?: string[];
  filename?: string[];
  tag?: string[];
  q?: string;
}

export interface TaggedDocument extends DoclingDocument {
  annotations?: DocumentTag[];
}

export interface DocumentTag {
  kind: "tag";
  tag: string;
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
