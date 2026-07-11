import { Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY as string,
    secretAccessKey: process.env.DO_SPACES_SECRET as string,
  },
});

// 🛡️ SECURITY FIX: The Whitelist
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB Limit (Optional concept for frontend validation reminder)

export const generatePresignedUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      res
        .status(400)
        .json({ error: "Filename and contentType are strictly required" });
      return;
    }

    // 🛡️ SECURITY FIX: Abort if format is not allowed
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      res.status(415).json({
        error: "Unsupported file format. Only Images and PDFs are allowed.",
      });
      return;
    }

    const uniqueFileKey = `chat-attachments/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "")}`; // Sanitized filename

    const command = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET as string,
      Key: uniqueFileKey,
      ContentType: contentType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 120 }); // Reduced to 2 mins for security

    res.json({
      uploadUrl,
      finalFileUrl: `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}/${uniqueFileKey}`,
      fileKey: uniqueFileKey,
    });
  } catch (error) {
    console.error("❌ Presigned URL Generation Failed:", error);
    res.status(500).json({ error: "Failed to generate upload ticket" });
  }
};
