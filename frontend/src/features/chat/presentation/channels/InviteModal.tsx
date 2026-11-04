"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useChatStore } from "@/src/features/chat/state";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { X, UserPlus, Loader2, Check } from "lucide-react";
import { authFetch } from "@/src/lib/authFetch";
import { toast } from "sonner";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WorkspaceInviteMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export default function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceInviteMember[]
  >([]);
  const [channelMemberIds, setChannelMemberIds] = useState<Set<string>>(new Set());
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  const { activeChannelId, channels, activeWorkspaceId } = useChatStore();

  // 🚀 THE FIX: Get the current logged-in 'user' from authStore
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  useEffect(() => {
    if (!isOpen || !activeWorkspaceId) {
      return;
    }

    const fetchValidMembers = async () => {
      setIsFetchingMembers(true);
      setChannelMemberIds(new Set());
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const [workspaceResponse, channelResponse] = await Promise.all([
          authFetch(`${apiBase}/api/workspaces/${activeWorkspaceId}/members`),
          activeChannelId
            ? authFetch(`${apiBase}/api/channels/${activeChannelId}/members`)
            : Promise.resolve(null),
        ]);

        if (workspaceResponse.ok) {
          const data: WorkspaceInviteMember[] = await workspaceResponse.json();
          setWorkspaceMembers(data);
        }
        if (channelResponse?.ok) {
          const channelMembers: WorkspaceInviteMember[] = await channelResponse.json();
          setChannelMemberIds(new Set(channelMembers.map((member) => member.id)));
        }
            } catch (error) {
        console.error("Failed to fetch verified workspace members", error);
        toast.error("Unable to load workspace members. Please try again.");

      } finally {
        setIsFetchingMembers(false);
      }
    };

    fetchValidMembers();
  }, [isOpen, activeWorkspaceId, activeChannelId]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id],
    );
  };

  const handleInvite = async () => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);

    try {
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${activeChannelId}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userIds: selectedIds }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        if (socket && activeChannel) {
          socket.emit("notify_channel_invites", {
            channelId: activeChannel.id,
          });
        }

        setSelectedIds([]);
        onClose();
      } else {
                toast.error(data.error || "Failed to send invites.");

      }
    } catch (error) {
            console.error("Invite failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send invites.");

    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !activeChannelId) return null;

  // 🚀 THE ISOLATION FIX: Filter out the current user so they don't see themselves
  const invitableMembers = workspaceMembers.filter(
    (member) => member.id !== user?.id && !channelMemberIds.has(member.id),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add People
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Invite members to{" "}
              <span className="font-semibold text-foreground">
                #{activeChannel?.name}
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

        <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-2 mb-6 custom-scrollbar">
          {isFetchingMembers ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invitableMembers.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-4">
              No other members in this workspace to invite.
            </p>
          ) : (
            // 🚀 Iterate over the filtered list instead of the raw workspaceMembers
            invitableMembers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-foreground overflow-hidden border border-border shrink-0">
                      {u.avatarUrl ? (
                        <Image
                          src={u.avatarUrl}
                          alt={u.name}
                          fill
                          unoptimized
                          sizes="32px"
                          className="object-cover"
                        />
                      ) : (
                        u.name.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`text-sm truncate ${isSelected ? "font-semibold text-primary" : "font-medium text-foreground"}`}
                    >
                      {u.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={handleInvite}
          disabled={selectedIds.length === 0 || isLoading || isFetchingMembers}
          className="w-full flex items-center justify-center py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Invite ${selectedIds.length > 0 ? `(${selectedIds.length})` : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
