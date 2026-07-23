import React, { useEffect, useState } from "react";
import { X, FileText, Image as ImageIcon } from "lucide-react";

interface AttachmentPreviewProps {
  attachment: File;
  isUploading: boolean;
  progress?: number; // 0-100
  onRemove: () => void;
}

export const AttachmentPreview = ({
  attachment,
  isUploading,
  progress = 0,
  onRemove,
}: AttachmentPreviewProps) => {
  const isImage = attachment.type.startsWith("image/");
  const totalMB = (attachment.size / 1024 / 1024).toFixed(2);
  const remainingMB = isUploading
    ? ((attachment.size * (100 - progress)) / 100 / 1024 / 1024).toFixed(2)
    : null;

  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(attachment);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment, isImage]);

  return (
    <div className="relative flex flex-col gap-1.5 p-2 bg-background/50 rounded-lg border border-border w-[200px] shadow-sm group transition-all">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-md border border-border flex items-center justify-center h-10 w-10 overflow-hidden shrink-0">
          {isImage && thumbUrl ? (
            <img src={thumbUrl} alt={attachment.name} className="h-full w-full object-cover rounded" decoding="async" />
          ) : isImage ? (
            <ImageIcon className="h-5 w-5 text-primary" />
          ) : (
            <FileText className="h-5 w-5 text-blue-500" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate text-foreground leading-tight">
            {attachment.name}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {isUploading && remainingMB !== null
              ? `${remainingMB} MB remaining`
              : `${totalMB} MB`}
          </span>
        </div>
      </div>

      {/* Progress bar — only shown while uploading */}
      {isUploading && (
        <div className="w-full">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

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
