"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Users, Loader2, ShieldAlert, Search, Trash2 } from "lucide-react"; // 🟢 Added Search icon
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/lib/authFetch";
import { useChatStore } from "@/src/features/chat/state";

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

// 🟢 THE FIX: Role must exist in your backend response
interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  email: string;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "GUEST"; // Backend lazmi bheje yeh
  isHidden?: boolean;
}

// Distinct visual treatment per role for the members list badge.
const ROLE_BADGE_STYLES: Record<string, string> = {
  OWNER: "bg-primary/10 text-primary",
  ADMIN: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  MEMBER: "bg-muted text-muted-foreground",
  GUEST: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export default function ChannelMembersModal({
  isOpen,
  onClose,
  channelId,
  channelName,
}: ChannelMembersModalProps) {
  // 🟢 Added 'user' from store to identify "(you)"
  const { token, user } = useAuthStore();
  const currentUserRole = useChatStore((state) => state.currentUserRole);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // 🟢 Search State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const canGovernChannel = currentUserRole === "OWNER";

  useEffect(() => {
    if (!isOpen || !channelId) {
      const resetTask = window.setTimeout(() => {
        setSearchQuery("");
        setIsDeleteConfirmationOpen(false);
      }, 0);
      return () => window.clearTimeout(resetTask);
    }

    const fetchMembers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${channelId}/members`,
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch members");
        }

        setMembers(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch members");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen, channelId, token]);

  // ==========================================
  // 🚀 THE PRODUCTION ENGINE (Filter + Sort)
  // ==========================================
  const filteredAndSortedMembers = members
    .filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      // Rule 1: Owner hamesha strictly top par hoga
      if (a.role === "OWNER" && b.role !== "OWNER") return -1;
      if (b.role === "OWNER" && a.role !== "OWNER") return 1;

      // Rule 2: Alphabetical Fallback
      return a.name.localeCompare(b.name);
    });

  const memberCountLabel = useMemo(
    () => `${members.length} members in`,
    [members.length],
  );

  const runChannelAction = async (
    memberId: string,
    visible: boolean,
  ) => {
    setPendingMemberId(memberId);
    setError("");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await authFetch(
        `${apiBase}/api/channels/${channelId}/member-visibility`,
        {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, visible }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Channel update failed.");

      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? { ...member, isHidden: !visible } : member,
        ),
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Channel update failed.",
      );
    } finally {
      setPendingMemberId(null);
    }
  };

  const leaveChannel = async () => {
    setPendingMemberId(user?.id || "leave");
    setError("");
    try {
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${channelId}/leave`,
        { method: "POST" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not leave channel.");
      onClose();
    } catch (leaveError) {
      setError(
        leaveError instanceof Error ? leaveError.message : "Could not leave channel.",
      );
    } finally {
      setPendingMemberId(null);
    }
  };

  const deleteChannel = async () => {
    setPendingMemberId("delete");
    setError("");
    try {
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${channelId}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete channel.");

      setIsDeleteConfirmationOpen(false);
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete channel.",
      );
    } finally {
      setPendingMemberId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" />
              Channel Members
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {memberCountLabel}{" "}
              <span className="font-semibold text-foreground">
                #{channelName}
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

        {/* 🟢 Search Bar (Slack-style) */}
        <div className="px-6 pb-4 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[250px] max-h-[400px] overflow-y-auto px-4 py-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-10">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Loading members...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500 mt-10 bg-red-50 p-4 rounded-lg mx-2">
              <ShieldAlert className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium text-center">{error}</p>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-10">
              <p className="text-sm">No members match your search.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredAndSortedMembers.map((member) => {
                const isMe = user?.id === member.id;
                const role = member.role || "MEMBER";
                const badgeStyle =
                  ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.MEMBER;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage
                          src={
                            member?.avatarUrl
                              ? member.avatarUrl
                              : `https://api.dicebear.com/7.x/initials/svg?seed=${member?.name}`
                          }
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {member.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {member.name}
                          </span>
                          {/* 🟢 Identify the current user */}
                          {isMe && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              (you)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canGovernChannel && !isMe && (
                        <>
                          <button
                            type="button"
                            disabled={pendingMemberId === member.id}
                            onClick={() =>
                              runChannelAction(member.id, Boolean(member.isHidden))
                            }
                            className="text-[10px] font-semibold rounded-md border border-border px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                          >
                            {member.isHidden ? "Show" : "Hide"}
                          </button>
                        </>
                      )}
                      {member.isHidden && canGovernChannel && (
                        <span className="text-[10px] font-semibold text-amber-700">Hidden</span>
                      )}
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-sm ${badgeStyle}`}
                      >
                        {role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-border px-6 py-3">
          {canGovernChannel ? (
            isDeleteConfirmationOpen ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-foreground">
                  <span className="font-semibold">Delete #{channelName}?</span>{" "}
                  This permanently removes its messages and reactions for everyone.
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingMemberId === "delete"}
                    onClick={() => setIsDeleteConfirmationOpen(false)}
                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pendingMemberId === "delete"}
                    onClick={() => void deleteChannel()}
                    className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {pendingMemberId === "delete" ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  As workspace owner, you control member visibility and can delete this channel.
                </p>
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmationOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete channel
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Leaving hides this channel from your sidebar. A workspace owner can restore visibility.
              </p>
              <button
                type="button"
                disabled={pendingMemberId === (user?.id || "leave")}
                onClick={() => void leaveChannel()}
                className="shrink-0 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                Leave channel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

