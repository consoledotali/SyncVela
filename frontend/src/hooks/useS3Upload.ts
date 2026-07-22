import { useState } from "react";
import { authFetch } from "@/src/lib/authFetch";

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);

  // 🚀 THE FIX: Return full object for Relational Database
  const uploadFile = async (
    file: File,
    visibility: "public" | "private" = "private",
  ): Promise<{
    url: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null> => {
    setIsUploading(true);
    try {
      // authFetch attaches the token and handles the 401 → refresh → retry
      // dance internally, so no manual refresh block is needed here.
      const presignRes = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/upload/presign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

      // Build PUT headers. Content-Type must match what was signed. For public
      // objects the server signed an x-amz-acl header, so we MUST send that exact
      // header back or DigitalOcean Spaces stores the object as private → 403 on
      // read. Private objects need no ACL header (private is the Space default).
      const putHeaders: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
      };
      if ((signedVisibility ?? visibility) === "public") {
        putHeaders["x-amz-acl"] = "public-read";
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: putHeaders,
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload to cloud");

      // Return metadata. fileKey drives signed-URL generation on the server.
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

