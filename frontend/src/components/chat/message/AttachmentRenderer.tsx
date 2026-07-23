import React from "react";
import { Download } from "lucide-react";
import { getFileDetails } from "./utils";

interface AttachmentProps {
  attachment: {
    id?: string;
    url: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
  };
  isMulti?: boolean;
  // Called when the attachment is clicked, so the parent can open a single
  // shared Lightbox positioned at this attachment within the whole message.
  onOpen?: () => void;
}

export const AttachmentRenderer = ({
  attachment,
  isMulti = false,
  onOpen,
}: AttachmentProps) => {
  if (!attachment || !attachment.url) return null;

  const { type: fileType, Icon: FileIcon } = getFileDetails(
    attachment.url,
    attachment.mimeType,
  );
  const sizeMB = attachment.size
    ? (attachment.size / 1024 / 1024).toFixed(2)
    : "0.00";

  const isPdf =
    fileType === "document" &&
    (attachment.mimeType?.includes("pdf") ||
      attachment.url.split("?")[0].toLowerCase().endsWith(".pdf"));

  if (fileType === "image") {
    return (
      <div
        onClick={onOpen}
        className={`overflow-hidden rounded-lg border border-border bg-muted/20 hover:opacity-95 transition-opacity cursor-pointer shadow-sm w-full ${
          isMulti ? "aspect-square" : "max-w-[360px]"
        }`}
      >
        <img
          src={attachment.url}
          alt={attachment.fileName || "Image attachment"}
          className={`w-full h-full ${
            isMulti ? "object-cover" : "object-contain max-h-[360px]"
          }`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (fileType === "video") {
    return (
      <div
        onClick={onOpen}
        className={`overflow-hidden rounded-lg border border-border bg-black shadow-sm w-full cursor-pointer ${
          isMulti ? "aspect-square" : "max-w-[360px]"
        }`}
      >
        <video
          src={attachment.url}
          className={`w-full h-full pointer-events-none ${
            isMulti ? "object-cover" : "object-contain max-h-[360px]"
          }`}
          preload="metadata"
        />
      </div>
    );
  }

  if (fileType === "audio") {
    return (
      // 🚀 THE GIANT BOX KILLER: Fixed height constraints and transparent background
      <div className="w-full max-w-[320px] h-[54px] flex items-center bg-muted/30 border border-border rounded-xl px-2 shadow-sm mt-1">
        <audio
          src={attachment.url}
          controls
          className="w-full h-9 outline-none bg-transparent"
          preload="metadata"
        />
      </div>
    );
  }

  // PDFs preview in the shared lightbox; other doc types open/download directly.
  if (isPdf) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/60 max-w-sm w-full transition-all duration-150 group/file mt-1 text-left"
      >
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover/file:bg-primary/20 transition-colors">
          <FileIcon className="h-5 w-5" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[13px] font-semibold truncate text-foreground leading-tight">
            {attachment.fileName || "Document"}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {fileType} • {sizeMB} MB
          </span>
        </div>
      </button>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/60 max-w-sm w-full transition-all duration-150 group/file mt-1"
    >
      <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover/file:bg-primary/20 transition-colors">
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[13px] font-semibold truncate text-foreground leading-tight">
          {attachment.fileName || "Document"}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
          {fileType} • {sizeMB} MB
        </span>
      </div>
      <Download className="h-4 w-4 text-muted-foreground shrink-0 mr-1 group-hover/file:text-foreground transition-colors" />
    </a>
  );
};
