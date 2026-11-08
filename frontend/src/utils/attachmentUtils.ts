import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Video,
  Music,
  Presentation,
  FileCode2,
  File,
} from "lucide-react";

export const getFileDetails = (url: string, mimeType?: string, fileName?: string) => {
  try {
    const cleanUrl = url.split("?")[0];
    const extension = (fileName || cleanUrl).split(".").pop()?.toLowerCase() || "";

    if (
      ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension) ||
      mimeType?.startsWith("image/")
    )
      return { type: "image", Icon: ImageIcon };

    if (["mp4", "mov", "mkv", "webm", "avi", "mpeg"].includes(extension) || mimeType?.startsWith("video/"))
      return { type: "video", Icon: Video };

    if (
      ["mp3", "wav", "ogg", "m4a", "webm", "mpeg-tts"].includes(extension) ||
      mimeType?.startsWith("audio/")
    )
      return { type: "audio", Icon: Music };

    if (extension === "pdf" || mimeType?.includes("pdf"))
      return { type: "pdf", Icon: FileText };

    if (["doc", "docx", "rtf", "txt", "md"].includes(extension) || mimeType?.startsWith("text/"))
      return { type: "document", Icon: FileText };

    if (
      ["csv", "xls", "xlsx"].includes(extension) ||
      mimeType?.includes("spreadsheet")
    )
      return { type: "spreadsheet", Icon: FileSpreadsheet };

    if (
      ["ppt", "pptx"].includes(extension) ||
      mimeType?.includes("presentation")
    )
      return { type: "presentation", Icon: Presentation };

    if (
      ["zip", "rar", "7z", "tar", "gz"].includes(extension) ||
      mimeType?.includes("zip")
    )
      return { type: "archive", Icon: FileArchive };

    if (
      ["json", "js", "jsx", "ts", "tsx", "py", "java", "go", "html", "css", "xml", "yml", "yaml"].includes(extension) ||
      mimeType?.includes("json")
    )
      return { type: "code", Icon: FileCode2 };

    return { type: extension ? extension.toUpperCase() : "file", Icon: File };
  } catch {
    return { type: "file", Icon: File };
  }
};

