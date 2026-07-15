import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Video,
  Music,
  File,
} from "lucide-react";

export const getFileDetails = (url: string, mimeType?: string) => {
  try {
    const cleanUrl = url.split("?")[0];
    const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";

    if (
      ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension) ||
      mimeType?.startsWith("image/")
    )
      return { type: "image", Icon: ImageIcon };

    if (["mp4", "mov"].includes(extension) || mimeType?.startsWith("video/"))
      return { type: "video", Icon: Video };

    if (
      ["mp3", "wav", "ogg", "m4a", "webm", "mpeg-tts"].includes(extension) ||
      mimeType?.startsWith("audio/")
    )
      return { type: "audio", Icon: Music };

    if (
      ["pdf", "doc", "docx", "txt"].includes(extension) ||
      mimeType?.includes("pdf")
    )
      return { type: "document", Icon: FileText };

    if (
      ["csv", "xls", "xlsx"].includes(extension) ||
      mimeType?.includes("spreadsheet")
    )
      return { type: "spreadsheet", Icon: FileSpreadsheet };

    if (
      ["zip", "rar", "7z", "tar", "gz"].includes(extension) ||
      mimeType?.includes("zip")
    )
      return { type: "archive", Icon: FileArchive };

    return { type: "unknown", Icon: File };
  } catch {
    return { type: "unknown", Icon: File };
  }
};
