"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";

interface DeleteWorkspaceDialogProps {
  isOpen: boolean;
  workspaceName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteWorkspaceDialog({
  isOpen,
  workspaceName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteWorkspaceDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-workspace-title"
        aria-describedby="delete-workspace-description"
        className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-6 text-card-foreground shadow-2xl shadow-black/20"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id="delete-workspace-title" className="text-lg font-semibold tracking-tight">
                Delete workspace?
              </h2>
              <button
                type="button"
                onClick={onCancel}
                disabled={isDeleting}
                aria-label="Close delete workspace dialog"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p id="delete-workspace-description" className="mt-2 text-sm leading-6 text-muted-foreground">
              This will permanently delete <strong className="font-semibold text-foreground">{workspaceName}</strong> and its conversations. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            autoFocus
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {isDeleting ? "Deleting…" : "Delete workspace"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export type { DeleteWorkspaceDialogProps };
