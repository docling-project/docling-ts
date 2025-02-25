import { DoclingDocument } from "docling";

export interface DocumentService {
  createCollection(name: string): Response<{ collectionId: string }>;
  readCollections(): Response<string[]>;
  deleteCollection(collectionId: string): Response;

  convertDocument(collectionId: string, file: File): Response<{ documentId: string }>;
  readDocuments(collectionId: string): Response<string[]>;
  readDocument(
    collectionId: string,
    documentId: string
  ): Response<DoclingDocument>;
  deleteDocument(collectionId: string, documentId: string): Response;
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

export function success<R>(result: R) {
  return { success: true, result };
}

export function error(exception: any): Response {
  console.error(exception);

  return {
    success: false,
    error: exception.toString()
  };
}