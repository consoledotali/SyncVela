import React, { useEffect, useState } from "react";
import { X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";

interface AttachmentPreviewProps {
  attachment: File;
  isUploading: boolean;
  onRemove: () => void;
}

export const AttachmentPreview = ({
  attachment,
  isUploading,
  onRemove,
}: AttachmentPreviewProps) => {
  const isImage = attachment.type.startsWith("image/");
  const sizeMB = (attachment.size / 1024 / 1024).toFixed(2);

  // Instant local thumbnail — no network. Object URL is revoked on unmount to
  // avoid memory leaks.
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(attachment);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment, isImage]);

  return (
    <div className="relative flex items-center gap-3 p-2 bg-background/50 rounded-lg border border-border w-max shadow-sm group transition-all">
      {/* 🟢 SLACK STYLE INDIVIDUAL SPINNER */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] rounded-lg z-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary drop-shadow-md" />
        </div>
      )}

      <div className="p-2 bg-muted rounded-md shadow-sm border border-border flex items-center justify-center h-10 w-10 overflow-hidden">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={attachment.name}
            className="h-full w-full object-cover rounded"
            decoding="async"
          />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-primary" />
        ) : (
          <FileText className="h-5 w-5 text-blue-500" />
        )}
      </div>

      <div className="flex flex-col max-w-[180px] pr-2">
        <span className="text-sm font-semibold truncate text-foreground leading-tight">
          {attachment.name}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground mt-0.5">
          {sizeMB} MB
        </span>
      </div>

      {/* Upload hotay waqt cancel button hide karo */}
      {!isUploading && (
        <button
          onClick={onRemove}
          type="button"
          className="absolute -top-2 -right-2 bg-background border border-border p-1 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground rounded-full transition-all z-20 shadow-sm opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
          title="Remove attachment"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
