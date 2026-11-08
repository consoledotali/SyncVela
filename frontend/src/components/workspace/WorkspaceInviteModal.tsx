"use client";

import React, { useState, useSyncExternalStore } from "react";
import { X, Link as LinkIcon, Copy, Check } from "lucide-react";

interface WorkspaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  inviteCode: string;
}

export default function WorkspaceInviteModal({
  isOpen,
  onClose,
  workspaceName,
  inviteCode,
}: WorkspaceInviteModalProps) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "",
  );
  const inviteUrl = origin ? `${origin}/invite/${inviteCode}` : "";
  const inviteLinkPreview = origin
    ? `${new URL(origin).host}/invite/••••••${inviteCode.slice(-6)}`
    : "Preparing secure link…";

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Invite to Workspace
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Share this link to invite others to{" "}
              <span className="font-semibold text-foreground">
                {workspaceName}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <div className="min-w-0 flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground" aria-label="Secure workspace invite link">
            <span className="block truncate">{inviteLinkPreview}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all min-w-[100px] ${
              copied
                ? "bg-green-500 text-white hover:bg-green-600"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-4 italic">
          Anyone with this link will be able to join your workspace.
        </p>
      </div>
    </div>
  );
}

