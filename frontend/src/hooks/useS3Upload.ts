import { useState } from "react";
import axios from "axios";
import { authFetch } from "@/src/utils/apiUtils";

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  "7z": "application/x-7z-compressed",
  avi: "video/x-msvideo",
  bmp: "image/bmp",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  gz: "application/gzip",
  json: "application/json",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  md: "text/markdown",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  rar: "application/vnd.rar",
  rtf: "application/rtf",
  tar: "application/x-tar",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

const resolveContentType = (file: File): string => {
  const browserType = file.type.trim().toLowerCase();
  const normalizedBrowserType =
    browserType === "image/jpg" || browserType === "image/pjpeg"
      ? "image/jpeg"
      : browserType === "image/x-png"
        ? "image/png"
        : browserType === "application/x-zip-compressed"
          ? "application/zip"
          : browserType;

  if (normalizedBrowserType && normalizedBrowserType !== "application/octet-stream") {
    return normalizedBrowserType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return (extension && MIME_TYPE_BY_EXTENSION[extension]) || "application/octet-stream";
};

export const useS3Upload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (
    file: File,
    kind: "attachment" | "avatar" = "attachment",
    onProgress?: (percent: number) => void,
  ): Promise<{
    url: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    size: number;
  }> => {
    setIsUploading(true);
    try {
      const contentType = resolveContentType(file);
      const presignRes = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/upload/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            fileSize: file.size,
            kind,
          }),
        },
      );

      if (!presignRes.ok) {
        const payload = (await presignRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Failed to get upload ticket");
      }

      const { uploadUrl, fileKey, uploadHeaders = {} } =
        await presignRes.json();

      const putHeaders: Record<string, string> = {
        "Content-Type": contentType,
        ...uploadHeaders,
      };

      await axios.put(uploadUrl, file, {
        headers: putHeaders,
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });

      return {
        url: "",
        fileKey,
        fileName: file.name,
        mimeType: contentType,
        size: file.size,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "File upload failed. Please retry.";
      throw new Error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
};
