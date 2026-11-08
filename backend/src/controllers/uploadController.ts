import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createUploadUrl, getUploadHeaders } from "../services/storageService";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const normalizeContentType = (contentType: string): string => {
  const normalized = contentType.trim().toLowerCase();

  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg";
  }

  if (normalized === "image/x-png") {
    return "image/png";
  }

  if (normalized === "application/x-zip-compressed") {
    return "application/zip";
  }

  return normalized;
};

const uploadTicketSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(128).transform(normalizeContentType),
  fileSize: z.number().int().positive(),
  kind: z.enum(["attachment", "avatar"]).default("attachment"),
});

const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MIME_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;

export const generatePresignedUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = uploadTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid upload ticket request.",
        code: "INVALID_UPLOAD_TICKET",
      });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Authentication is required." });
      return;
    }

    const { filename, contentType, fileSize, kind } = parsed.data;

    if (fileSize > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File exceeds the strict 100MB limit." });
      return;
    }

    if (kind === "avatar" && (!AVATAR_TYPES.has(contentType) || fileSize > MAX_AVATAR_SIZE)) {
      res.status(400).json({ error: "Avatars must be PNG, JPEG, or WebP images up to 5MB." });
      return;
    }
    if (kind === "attachment" && !MIME_TYPE_PATTERN.test(contentType)) {
      res.status(400).json({
        error:
          "The selected file does not provide a valid media type. Please select the original file again.",
        code: "INVALID_ATTACHMENT_MEDIA_TYPE",
      });
      return;
    }

    const isPublic = kind === "avatar";
    const folder = isPublic ? `avatars/${userId}` : `chat-attachments/${userId}`;

    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "").slice(-120) || "upload";
    const uniqueFileKey = `${folder}/${randomUUID()}-${safeName}`;

    const uploadUrl = await createUploadUrl(
      uniqueFileKey,
      contentType,
      isPublic ? "public" : "private",
    );

    res.json({
      uploadUrl,
      uploadHeaders: getUploadHeaders(isPublic ? "public" : "private"),
      fileKey: uniqueFileKey,
      kind,
      visibility: isPublic ? "public" : "private",
    });
  } catch (error) {
    console.error("❌ Presigned URL Generation Failed:", error);
    res.status(500).json({ error: "Failed to generate upload ticket" });
  }
};
