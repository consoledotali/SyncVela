import { useState } from "react";
import { useAuthStore } from "@/src/store/authStore";

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useAuthStore.getState();

  const uploadFile = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      // Step 1: Request Presigned URL
      const presignRes = await fetch(
        "http://localhost:5000/api/upload/presign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        },
      );

      if (!presignRes.ok) throw new Error("Failed to get upload ticket");
      const { uploadUrl, finalFileUrl } = await presignRes.json();

      // Step 2: Direct Upload to DigitalOcean Spaces
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-amz-acl": "public-read" },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload to cloud");

      return finalFileUrl;
    } catch (error) {
      console.error("❌ S3 Pipeline Failed:", error);
      alert("Failed to upload file. Please try again.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
};
