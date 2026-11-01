import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageVisibility = "public" | "private";

const normalizeEndpoint = (endpoint: string): string => {
  return endpoint.replace(/\/+$/, "");
};

const legacySpacesEndpoint = process.env.DO_SPACES_ENDPOINT
  ? `https://${process.env.DO_SPACES_ENDPOINT}`
  : undefined;

// Local MinIO uses OBJECT_STORAGE_* values. Existing DigitalOcean Spaces
// deployments continue to work through the legacy DO_SPACES_* fallback.
const STORAGE_ENDPOINT = normalizeEndpoint(
  process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT ||
    process.env.OBJECT_STORAGE_ENDPOINT ||
    legacySpacesEndpoint ||
    "http://127.0.0.1:9000",
);
const STORAGE_REGION =
  process.env.OBJECT_STORAGE_REGION || process.env.DO_SPACES_REGION || "us-east-1";
const STORAGE_ACCESS_KEY =
  process.env.OBJECT_STORAGE_ACCESS_KEY || process.env.DO_SPACES_KEY || "";
const STORAGE_SECRET_KEY =
  process.env.OBJECT_STORAGE_SECRET_KEY || process.env.DO_SPACES_SECRET || "";
const PRIVATE_BUCKET =
  process.env.OBJECT_STORAGE_BUCKET || process.env.DO_SPACES_BUCKET || "syncvela-attachments";
const PUBLIC_BUCKET = process.env.OBJECT_STORAGE_PUBLIC_BUCKET || PRIVATE_BUCKET;
const FORCE_PATH_STYLE = process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true";
const USE_OBJECT_ACL = process.env.OBJECT_STORAGE_USE_ACL !== "false";

// Single source of truth for every S3-compatible provider, including MinIO.
export const s3Client = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET_KEY,
  },
});

// How long a download link stays valid. 1 hour is a good balance between
// security (short-lived) and not re-signing on every render.
const DOWNLOAD_URL_TTL = 60 * 60; // seconds

// Presigned PUT URL — client uploads the raw file directly to this URL.
const getBucketForVisibility = (visibility: StorageVisibility): string => {
  return visibility === "public" ? PUBLIC_BUCKET : PRIVATE_BUCKET;
};

export const getUploadHeaders = (
  visibility: StorageVisibility,
): Record<string, string> => {
  return visibility === "public" && USE_OBJECT_ACL
    ? { "x-amz-acl": "public-read" }
    : {};
};

// `visibility` controls bucket routing. Chat attachments remain private and
// avatars go to the public avatar bucket. MinIO does not need per-object ACLs.
export const createUploadUrl = (
  fileKey: string,
  contentType: string,
  visibility: StorageVisibility = "private",
): Promise<string> => {
  const uploadHeaders = getUploadHeaders(visibility);
  const command = new PutObjectCommand({
    Bucket: getBucketForVisibility(visibility),
    Key: fileKey,
    ContentType: contentType,
    ...(uploadHeaders["x-amz-acl"] ? { ACL: "public-read" as const } : {}),
  });
  // Some S3-compatible providers require ACL to be a signed request header.
  // MinIO local mode disables object ACLs and uses a bucket-level avatar policy.
  return getSignedUrl(s3Client, command, {
    expiresIn: 120,
    ...(uploadHeaders["x-amz-acl"]
      ? { unhoistableHeaders: new Set(["x-amz-acl"]) }
      : {}),
  });
};

export const buildPublicObjectUrl = (fileKey: string): string => {
  const encodedKey = fileKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (FORCE_PATH_STYLE || process.env.OBJECT_STORAGE_PUBLIC_ENDPOINT) {
    return `${STORAGE_ENDPOINT}/${PUBLIC_BUCKET}/${encodedKey}`;
  }

  return `https://${PUBLIC_BUCKET}.${process.env.DO_SPACES_ENDPOINT}/${encodedKey}`;
};

// Presigned GET URL — grants temporary read access to a private object.
export const createDownloadUrl = (fileKey: string): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: fileKey });
  return getSignedUrl(s3Client, command, { expiresIn: DOWNLOAD_URL_TTL });
};

// Avatar objects are intentionally readable through the profile endpoint. The
// endpoint redirects to a short-lived signed URL so local MinIO policy drift
// cannot break profile rendering while chat attachments stay in their private
// bucket and continue using the private download flow above.
export const createAvatarDownloadUrl = (fileKey: string): Promise<string> => {
  const command = new GetObjectCommand({ Bucket: PUBLIC_BUCKET, Key: fileKey });
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
