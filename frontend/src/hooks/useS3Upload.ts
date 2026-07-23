import { useState } from "react";
import axios from "axios";
import { authFetch } from "@/src/lib/authFetch";

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (
    file: File,
    visibility: "public" | "private" = "private",
    onProgress?: (percent: number) => void,
  ): Promise<{
    url: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null> => {
    setIsUploading(true);
    try {
      const presignRes = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/upload/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
            visibility,
          }),
        },
      );

      if (!presignRes.ok) throw new Error("Failed to get upload ticket");

      const { uploadUrl, finalFileUrl, fileKey, visibility: signedVisibility } =
        await presignRes.json();

      const putHeaders: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
      };
      if ((signedVisibility ?? visibility) === "public") {
        putHeaders["x-amz-acl"] = "public-read";
      }

      await axios.put(uploadUrl, file, {
        headers: putHeaders,
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });

      return {
        url: finalFileUrl,
        fileKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      };
    } catch (error: any) {
      console.error("❌ S3 Pipeline Failed:", error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
};

