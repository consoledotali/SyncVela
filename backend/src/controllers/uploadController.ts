import { Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 Client Initialization with strict types
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY as string,
    secretAccessKey: process.env.DO_SPACES_SECRET as string,
  },
});

export const generatePresignedUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({ error: "Filename and contentType are required" });
      return; // Return zaroori hai taake request aage proceed na kare
    }

    const uniqueFileKey = `chat-attachments/${Date.now()}-${filename.replace(/\s+/g, "-")}`;

    const command = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET as string,
      Key: uniqueFileKey,
      ContentType: contentType,
      ACL: "public-read", // Temporarily public for chat UI rendering
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.json({
      uploadUrl,
      finalFileUrl: `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_ENDPOINT}/${uniqueFileKey}`,
      fileKey: uniqueFileKey,
    });
  } catch (error) {
    console.error("Presigned URL Generation Failed:", error);
    res.status(500).json({ error: "Failed to generate upload ticket" });
  }
};
