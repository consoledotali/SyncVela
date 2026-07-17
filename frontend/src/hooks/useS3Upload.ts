import { useState } from "react";
import { useAuthStore } from "@/src/store/authStore";

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);

  // 🚀 THE FIX: Return full object for Relational Database
  const uploadFile = async (
    file: File,
  ): Promise<{
    url: string;
    fileName: string;
    mimeType: string;
    size: number;
  } | null> => {
    setIsUploading(true);
    try {
      let currentToken = useAuthStore.getState().token;

      const fetchPresignUrl = async (tokenToUse: string | null) => {
        return fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/upload/presign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenToUse}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });
      };

      let presignRes = await fetchPresignUrl(currentToken);

      if (presignRes.status === 401 || presignRes.status === 403) {
        const refreshRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        if (!refreshRes.ok) {
          useAuthStore.getState().logout();
          window.location.href = "/auth/login";
          throw new Error("Session completely expired. Please log in again.");
        }

        const authData = await refreshRes.json();
        const newToken = authData.accessToken || authData.token;

        useAuthStore.setState({ token: newToken });
        currentToken = newToken;

        presignRes = await fetchPresignUrl(currentToken);
        if (!presignRes.ok) throw new Error("Retry failed.");
      } else if (!presignRes.ok) {
        throw new Error("Failed to get upload ticket");
      }

      const { uploadUrl, finalFileUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-amz-acl": "public-read",
        },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload to cloud");

      // 🚀 THE ENTERPRISE FIX: Return Metadata Object
      return {
        url: finalFileUrl,
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

