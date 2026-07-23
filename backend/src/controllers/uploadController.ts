import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { createUploadUrl } from "../utils/s3";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB Strict Limit

export const generatePresignedUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { filename, contentType, fileSize, visibility } = req.body;

    if (!filename || fileSize === undefined) {
      res
        .status(400)
        .json({ error: "Filename and fileSize are strictly required." });
      return;
    }

    if (fileSize > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File exceeds the strict 100MB limit." });
      return;
    }

    // Accept ALL formats. If the browser can't determine one, treat as raw binary.
    const finalContentType = contentType || "application/octet-stream";

    // Avatars are public (displayed directly); chat attachments stay private.
    const isPublic = visibility === "public";
    const folder = isPublic ? "avatars" : "chat-attachments";

    // Unguessable key (randomUUID) so object paths can't be enumerated.
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "");
    const uniqueFileKey = `${folder}/${randomUUID()}-${safeName}`;

    const uploadUrl = await createUploadUrl(
      uniqueFileKey,
      finalContentType,
      isPublic ? "public" : "private",
    );

    res.json({
      uploadUrl,
      // Stored for reference; actual access always goes through signed GET URLs.
      finalFileUrl: `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}/${uniqueFileKey}`,
      fileKey: uniqueFileKey,
      // Tells the client whether it must send the x-amz-acl header on the PUT.
      visibility: isPublic ? "public" : "private",
    });
  } catch (error) {
    console.error("❌ Presigned URL Generation Failed:", error);
    res.status(500).json({ error: "Failed to generate upload ticket" });
  }
};
