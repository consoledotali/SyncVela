import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Single source of truth for the S3 / DigitalOcean Spaces client.
export const s3Client = new S3Client({
  region: process.env.DO_SPACES_REGION || "us-east-1",
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY as string,
    secretAccessKey: process.env.DO_SPACES_SECRET as string,
  },
});

const BUCKET = process.env.DO_SPACES_BUCKET as string;

// How long a download link stays valid. 1 hour is a good balance between
// security (short-lived) and not re-signing on every render.
const DOWNLOAD_URL_TTL = 60 * 60; // seconds

// Presigned PUT URL — client uploads the raw file directly to this URL.
// `visibility` controls the object ACL: chat attachments stay private (served
// via signed GET URLs), avatars are public-read (displayed directly + cached).
export const createUploadUrl = (
  fileKey: string,
  contentType: string,
  visibility: "public" | "private" = "private",
): Promise<string> => {
  const isPublic = visibility === "public";
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: contentType,
    // Only set ACL for public objects. Private is the Space default, so leaving
    // it off keeps the signature simple (no acl header required on upload).
    ...(isPublic ? { ACL: "public-read" as const } : {}),
  });
  // DigitalOcean Spaces only honors the ACL when it arrives as a REQUEST HEADER,
  // not as a hoisted query param. Marking x-amz-acl unhoistable forces the SDK
  // to keep it as a signed header — the client must then send that exact header
  // on the PUT (see useS3Upload) or the object silently falls back to private.
  return getSignedUrl(s3Client, command, {
    expiresIn: 120,
    ...(isPublic
      ? { unhoistableHeaders: new Set(["x-amz-acl"]) }
      : {}),
  });
};

// Presigned GET URL — grants temporary read access to a private object.
export const createDownloadUrl = (fileKey: string): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_URL_TTL });
};

// Attachments as stored in the DB (url is legacy/public, fileKey drives signing).
interface RawAttachment {
  id?: string;
  url: string;
  fileKey?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  [key: string]: unknown;
}

// Replace each attachment's `url` with a fresh signed URL so the client never
// needs the bucket to be public. Falls back to the stored url for legacy rows
// (uploaded before fileKey existed).
export const signAttachments = async <T extends RawAttachment>(
  attachments: T[] | undefined | null,
): Promise<T[]> => {
  if (!attachments || attachments.length === 0) return [];
  return Promise.all(
    attachments.map(async (att) => {
      if (!att.fileKey) return att;
      const signedUrl = await createDownloadUrl(att.fileKey);
      return { ...att, url: signedUrl };
    }),
  );
};

// Sign attachments across a list of messages (channel/DM history).
export const signMessageAttachments = async <
  T extends { attachments?: RawAttachment[] },
>(
  messages: T[],
): Promise<T[]> => {
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.attachments || msg.attachments.length === 0) return msg;
      return { ...msg, attachments: await signAttachments(msg.attachments) };
    }),
  );
};
