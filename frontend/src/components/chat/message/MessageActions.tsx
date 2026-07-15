import React from "react";
import { Pencil, Trash2 } from "lucide-react";

interface MessageActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  hasText: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const MessageActions = ({
  canEdit,
  canDelete,
  isEditing,
  hasText,
  onEdit,
  onDelete,
}: MessageActionsProps) => {
  if ((!canEdit && !canDelete) || isEditing) return null;

  return (
    <div className="absolute right-6 -top-3.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
      <div className="flex items-center border border-border bg-popover text-popover-foreground rounded-md shadow-md overflow-hidden p-0.5 h-8">
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
