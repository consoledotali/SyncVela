import React from "react";
import { X, FileText, Image as ImageIcon } from "lucide-react";

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

  return (
    <div className="flex items-center gap-3 p-2.5 mx-2 mt-2 bg-background/50 rounded-lg border border-border w-max animate-in slide-in-from-bottom-2">
      <div className="p-2 bg-background rounded-md shadow-sm border border-border flex items-center justify-center">
        {isImage ? (
          <ImageIcon className="h-5 w-5 text-primary" />
        ) : (
          <FileText className="h-5 w-5 text-blue-500" />
        )}
      </div>

      <div className="flex flex-col max-w-[180px]">
        <span className="text-sm font-semibold truncate text-foreground leading-tight">
          {attachment.name}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground mt-0.5">
          {sizeMB} MB {isUploading && "• Uploading..."}
        </span>
      </div>

      <button
        onClick={onRemove}
        disabled={isUploading}
        type="button"
        className="ml-1 p-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-md transition-colors disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
