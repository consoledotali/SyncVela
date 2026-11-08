/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from "react";
import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  X,
} from "lucide-react";

interface AttachmentPreviewProps {
  attachment: File;
  isUploading: boolean;
  progress?: number;
  onRemove: () => void;
}

const extensionOf = (fileName: string) =>
  fileName.split(".").pop()?.toLowerCase() || "file";

const filePresentation = (attachment: File) => {
  const extension = extensionOf(attachment.name);
  const mime = attachment.type.toLowerCase();

  if (mime.startsWith("image/")) return { label: "Image", Icon: FileText };
  if (mime.startsWith("video/") || ["mp4", "mov", "mkv", "webm", "avi"].includes(extension)) {
    return { label: "Video", Icon: FileVideo };
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(extension)) {
    return { label: "Audio", Icon: FileAudio };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return { label: "Archive", Icon: FileArchive };
  }
  if (["xls", "xlsx", "csv"].includes(extension)) {
    return { label: "Spreadsheet", Icon: FileSpreadsheet };
  }
  if (["ppt", "pptx"].includes(extension)) {
    return { label: "Presentation", Icon: Presentation };
  }
  if (["json", "md", "js", "ts", "tsx", "jsx", "py", "java", "css", "html"].includes(extension)) {
    return { label: "Code", Icon: FileCode2 };
  }
  if (extension === "pdf") return { label: "PDF", Icon: FileText };
  if (["doc", "docx", "rtf", "txt"].includes(extension)) return { label: "Document", Icon: FileText };
  return { label: extension.toUpperCase(), Icon: FileText };
};

function ImageAttachmentThumbnail({ attachment }: Pick<AttachmentPreviewProps, "attachment">) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const thumbUrl = useMemo(() => URL.createObjectURL(attachment), [attachment]);
  useEffect(() => () => URL.revokeObjectURL(thumbUrl), [thumbUrl]);

  if (failedPreviewUrl === thumbUrl) {
    return <FileText className="h-5 w-5 text-primary" aria-label="Image preview unavailable" />;
  }

  return (
    <img
      src={thumbUrl}
      alt={attachment.name}
      className="h-full w-full rounded object-cover"
      onError={() => setFailedPreviewUrl(thumbUrl)}
    />
  );
}

function VideoAttachmentThumbnail({ attachment }: Pick<AttachmentPreviewProps, "attachment">) {
  const previewUrl = useMemo(() => URL.createObjectURL(attachment), [attachment]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return <video src={previewUrl} muted preload="metadata" className="h-full w-full rounded object-cover" />;
}

export const AttachmentPreview = ({
  attachment,
  isUploading,
  progress = 0,
  onRemove,
}: AttachmentPreviewProps) => {
  const presentation = filePresentation(attachment);
  const isImage = presentation.label === "Image";
  const isVideo = presentation.label === "Video";
  const totalMB = (attachment.size / 1024 / 1024).toFixed(2);
  const remainingMB = isUploading
    ? ((attachment.size * (100 - progress)) / 100 / 1024 / 1024).toFixed(2)
    : null;
  const TypeIcon = presentation.Icon;

  return (
    <div className="relative flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2 shadow-sm transition-all">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {isImage ? (
            <ImageAttachmentThumbnail attachment={attachment} />
          ) : isVideo ? (
            <VideoAttachmentThumbnail attachment={attachment} />
          ) : (
            <TypeIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground" title={attachment.name}>
            {attachment.name}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {isUploading && remainingMB !== null
              ? `${remainingMB} MB remaining`
              : `${presentation.label} · ${totalMB} MB`}
          </p>
        </div>

        {!isUploading && (
          <button
            onClick={onRemove}
            type="button"
            aria-label={`Remove ${attachment.name}`}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isUploading && (
        <div className="w-full">
          <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>Uploading</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

