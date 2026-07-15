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

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB Strict Limit

export const generatePresignedUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { filename, contentType, fileSize } = req.body;

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

    // 🚀 THE SLACK FIX: Accept ALL formats. 
    // Agar browser format na bhej paye, toh usay raw binary treat karo.
    const finalContentType = contentType || "application/octet-stream";

    const uniqueFileKey = `chat-attachments/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "")}`;

    const command = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET as string,
      Key: uniqueFileKey,
      ContentType: finalContentType,
      ACL: "public-read",
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 120 });

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