import React from "react";
import { Pencil, Trash2, MessageSquareReply } from "lucide-react";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀"] as const;

interface MessageActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  hasText: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReply?: () => void;
  onReactionSelect: (emoji: string) => void;
}

export const MessageActions = ({
  canEdit,
  canDelete,
  isEditing,
  hasText,
  onEdit,
  onDelete,
  onReply,
  onReactionSelect,
}: MessageActionsProps) => {
  if (isEditing) return null;

  return (
    <div className="absolute right-6 -top-3.5 z-20 pointer-events-none opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      <div
        className="relative flex h-8 items-center overflow-hidden rounded-md border border-border bg-popover p-0.5 text-popover-foreground shadow-md"
      >
        <div className="flex items-center gap-0.5 pr-0.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReactionSelect(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded text-[15px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`React with ${emoji}`}
              title={`React with ${emoji}`}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
        {onReply && (
          <button
            type="button"
            onClick={onReply}
            className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Reply in Thread"
          >
            <MessageSquareReply className="h-3.5 w-3.5" />
          </button>
        )}

        {canEdit && hasText && (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Edit Message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Delete Message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

