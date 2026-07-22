"use client";

import React, { useState } from "react";
import { X, Loader2, Hash, Lock } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/lib/authFetch";

interface NewChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewChannelModal({
  isOpen,
  onClose,
}: NewChannelModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isLoading, setIsLoading] = useState(false);

  const { token } = useAuthStore();
  const { activeWorkspaceId, channels, setChannels } = useChatStore();
  const { socket } = useSocket();

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !activeWorkspaceId || !token) return;

    setIsLoading(true);
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim().toLowerCase(),
          type,
          workspaceId: activeWorkspaceId,
        }),
      });

      if (response.ok) {
        const newChannel = await response.json();
        setChannels([...channels, newChannel]);

        // 🚀 THE REAL-TIME FIX: Dynamically join the newly created channel's room!
        if (socket) {
          socket.emit("join_channel", newChannel.id);
        }

        setName("");
        onClose();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to create channel");
      }
    } catch (error) {
      console.error("❌ Channel creation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border w-full max-w-md rounded-xl shadow-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold mb-1">Create a channel</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Channels are where your team communicates.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Channel Name
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="e.g. marketing, bug-reports"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\s+/g, "-"))}
                className="pl-9"
                maxLength={30}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Visibility
            </label>
            <div className="flex gap-3">
              <div
                onClick={() => setType("PUBLIC")}
                className={`flex-1 p-3 border rounded-lg cursor-pointer transition-colors ${type === "PUBLIC" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <Hash className="h-4 w-4" /> Public
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Anyone in the workspace can join.
                </p>
              </div>
              <div
                onClick={() => setType("PRIVATE")}
                className={`flex-1 p-3 border rounded-lg cursor-pointer transition-colors ${type === "PRIVATE" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <Lock className="h-4 w-4" /> Private
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Only invited members can view.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Channel"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

