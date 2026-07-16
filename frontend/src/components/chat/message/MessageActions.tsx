import React from "react";
import { Pencil, Trash2, MessageSquareReply } from "lucide-react"; // 🚀 Icon added

interface MessageActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  hasText: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReply?: () => void; // 🚀 Injected
}

export const MessageActions = ({
  canEdit,
  canDelete,
  isEditing,
  hasText,
  onEdit,
  onDelete,
  onReply,
}: MessageActionsProps) => {
  if (isEditing) return null;

  return (
    <div className="absolute right-6 -top-3.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
      <div className="flex items-center border border-border bg-popover text-popover-foreground rounded-md shadow-md overflow-hidden p-0.5 h-8">
        {/* 🚀 REPLY HOVER BUTTON */}
        {onReply && (
          <button
            onClick={onReply}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Reply in Thread"
          >
            <MessageSquareReply className="h-3.5 w-3.5" />
          </button>
        )}

        {canEdit && hasText && (
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Edit Message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
            title="Delete Message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
