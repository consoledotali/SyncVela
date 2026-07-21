import { useState } from "react";
import { useAuthStore } from "@/src/store/authStore";

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
            visibility,
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

      const { uploadUrl, finalFileUrl, fileKey } = await presignRes.json();

      // Content-Type must match what was signed. No ACL header — the object is
      // private and served later via short-lived signed GET URLs.
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
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

