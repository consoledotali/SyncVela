export type StorageVisibility = "public" | "private";

export interface RawAttachment {
  id?: string;
  url: string;
  fileKey?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  [key: string]: unknown;
}

export type UploadTicketKind = "attachment" | "avatar";

export interface UploadTicketRequest {
  filename: string;
  contentType: string;
  fileSize: number;
  kind?: UploadTicketKind;
}

