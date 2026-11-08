"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useChatStore, type WorkspaceRole } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { X, Loader2, ShieldCheck, UserX, Crown } from "lucide-react";
import { authFetch } from "@/src/utils/apiClient";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AssignableWorkspaceRole = Exclude<WorkspaceRole, "OWNER">;

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: WorkspaceRole;
}

export default function ManageMembersModal({
  isOpen,
  onClose,
}: ManageMembersModalProps) {
  const { token, user } = useAuthStore();
  const { activeWorkspaceId, workspaces, setWorkspaces, setCurrentUserRole } =
    useChatStore();
  const { socket } = useSocket();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!activeWorkspaceId || !token) return;
    setIsLoading(true);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members`,
      );
      if (res.ok) {
        const data: WorkspaceMember[] = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to load workspace members", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, token]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTask = window.setTimeout(() => {
      void fetchWorkspaceMembers();
    }, 0);

    return () => window.clearTimeout(fetchTask);
  }, [fetchWorkspaceMembers, isOpen]);

  useEffect(() => {
    if (!socket || !isOpen || !activeWorkspaceId) return;

    const handleOwnershipTransferred = (data: {
      workspaceId: string;
      previousOwnerId: string;
      newOwnerId: string;
    }) => {
      if (data.workspaceId !== activeWorkspaceId) return;
      setMembers((currentMembers) =>
        currentMembers.map((m) => {
          if (m.id === data.newOwnerId) return { ...m, role: "OWNER" };
          if (m.id === data.previousOwnerId) return { ...m, role: "ADMIN" };
          return m;
        }),
      );
    };

    const handleRoleUpdated = (data: {
      workspaceId: string;
      userId: string;
      newRole: WorkspaceRole;
    }) => {
      if (data.workspaceId !== activeWorkspaceId) return;
      setMembers((currentMembers) =>
        currentMembers.map((m) =>
          m.id === data.userId ? { ...m, role: data.newRole } : m,
        ),
      );
    };

    const handleMemberKicked = (data: {
      workspaceId: string;
      userId: string;
    }) => {
      if (data.workspaceId !== activeWorkspaceId) return;
      if (user?.id === data.userId) {
        onClose();
        return;
      }
      setMembers((currentMembers) =>
        currentMembers.filter((m) => m.id !== data.userId),
      );
    };

    const handleMemberJoined = (data: {
      workspaceId: string;
      member?: WorkspaceMember;
      user?: WorkspaceMember;
    }) => {
      if (data.workspaceId !== activeWorkspaceId) return;
      const newMember = data.member || data.user;
      if (newMember) {
        setMembers((currentMembers) => {
          if (currentMembers.some((m) => m.id === newMember.id)) {
            return currentMembers;
          }
          return [...currentMembers, newMember];
        });
      }
    };

    socket.on("workspace_ownership_transferred", handleOwnershipTransferred);
    socket.on("member_role_updated", handleRoleUpdated);
    socket.on("member_kicked", handleMemberKicked);
    socket.on("workspace_member_joined", handleMemberJoined);

    return () => {
      socket.off("workspace_ownership_transferred", handleOwnershipTransferred);
      socket.off("member_role_updated", handleRoleUpdated);
      socket.off("member_kicked", handleMemberKicked);
      socket.off("workspace_member_joined", handleMemberJoined);
    };
  }, [socket, isOpen, activeWorkspaceId, user?.id, onClose]);

  const handleRoleChange = async (
    targetUserId: string,
    newRole: AssignableWorkspaceRole,
  ) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/members/role`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: activeWorkspaceId,
            targetUserId,
            newRole,
          }),
        },
      );

      if (res.ok) {
        setMembers((currentMembers) =>
          currentMembers.map((m) =>
            m.id === targetUserId ? { ...m, role: newRole } : m,
          ),
        );
        toast.success("Member role updated successfully.");
      } else {
        const data: { error?: string } = await res.json();
        toast.error(data.error ?? "Unable to update this member");
      }
    } catch {
      toast.error("API request failed. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleKickMember = async (targetUserId: string, name: string) => {
    const confirmKick = window.confirm(
      `Are you absolutely sure you want to kick ${name} from this workspace?`,
    );
    if (!confirmKick) return;

    setActionLoadingId(targetUserId);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members/${targetUserId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        setMembers((currentMembers) =>
          currentMembers.filter((member) => member.id !== targetUserId),
        );
        toast.success(`${name} has been removed from the workspace.`);
      } else {
        const data: { error?: string } = await res.json();
        toast.error(data.error ?? "Unable to remove this member");
      }
    } catch {
      toast.error("API request failed. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleWorkspaceOwnershipTransfer = async (
    targetUserId: string,
    name: string,
  ) => {
    if (!activeWorkspaceId || !user) return;

    const confirmed = window.confirm(
      `Transfer workspace ownership to ${name}? You will become an admin after this action.`,
    );
    if (!confirmed) return;

    setActionLoadingId(targetUserId);
    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/transfer-ownership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerId: targetUserId }),
        },
      );

      if (!res.ok) {
        const data: { error?: string } = await res.json();
        toast.error(data.error ?? "Unable to transfer workspace ownership");
        return;
      }

      setMembers((currentMembers) =>
        currentMembers.map((member) => {
          if (member.id === targetUserId) return { ...member, role: "OWNER" };
          if (member.id === user.id) return { ...member, role: "ADMIN" };
          return member;
        }),
      );

      setCurrentUserRole("ADMIN");
      setWorkspaces(
        workspaces.map((w) =>
          w.id === activeWorkspaceId ? { ...w, ownerId: targetUserId } : w,
        ),
      );

      toast.success(
        `Workspace ownership successfully transferred to ${name}. You are now an Admin.`,
      );
    } catch {
      toast.error("API request failed. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  const isCurrentWorkspaceOwner = members.some(
    (member) => member.id === user?.id && member.role === "OWNER",
  );

  const renderRoleBadge = (role: WorkspaceRole) => {
    switch (role) {
      case "OWNER":
        return (
          <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded">
            Owner
          </span>
        );
      case "ADMIN":
        return (
          <span className="text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded">
            Admin
          </span>
        );
      case "GUEST":
        return (
          <span className="text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded">
            Guest
          </span>
        );
      case "MEMBER":
      default:
        return (
          <span className="text-[10px] font-bold tracking-wider uppercase bg-muted text-muted-foreground border border-border px-2.5 py-1 rounded">
            Member
          </span>
        );
    }
  };

  const rolePriority: Record<WorkspaceRole, number> = {
    OWNER: 1,
    ADMIN: 2,
    MEMBER: 3,
    GUEST: 4,
  };

  const sortedMembers = [...members].sort((a, b) => {
    const priorityA = rolePriority[a.role] ?? 99;
    const priorityB = rolePriority[b.role] ?? 99;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-xl rounded-xl shadow-2xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Workspace Identity Control Center
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {isCurrentWorkspaceOwner
                ? "Promote permissions or purge accounts inside "
                : "Workspace members inside "}
              <span className="font-semibold text-foreground">
                {activeWorkspace?.name}
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

        <div className="max-h-[350px] overflow-y-auto pr-1 flex flex-col gap-2 mb-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            sortedMembers.map((member) => {
              const isSelf = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-border/60 rounded-lg bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 !rounded-md border border-border">
                      <AvatarImage
                        src={
                          member?.avatarUrl
                            ? member.avatarUrl
                            : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member?.name || "User")}`
                        }
                        className="object-cover w-full h-full !rounded-md"
                      />
                      <AvatarFallback className="!rounded-md bg-primary/10 text-primary font-bold">
                        {(member.name || "U").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-foreground truncate">
                          {member.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            (you)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrentWorkspaceOwner && !isSelf && member.role !== "OWNER" ? (
                      actionLoadingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <select
                            value={member.role || "MEMBER"}
                            onChange={(e) => {
                              const nextRole = e.target.value;
                              if (
                                nextRole === "ADMIN" ||
                                nextRole === "MEMBER" ||
                                nextRole === "GUEST"
                              ) {
                                handleRoleChange(member.id, nextRole);
                              }
                            }}
                            className="bg-background border border-border rounded p-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                            <option value="GUEST">Guest</option>
                          </select>

                          <button
                            onClick={() =>
                              handleKickMember(member.id, member.name)
                            }
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 rounded transition-colors"
                            title="Kick from workspace"
                          >
                            <UserX className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() =>
                              handleWorkspaceOwnershipTransfer(member.id, member.name)
                            }
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                            title="Transfer workspace ownership"
                          >
                            <Crown className="h-3.5 w-3.5" />
                            Transfer
                          </button>
                        </>
                      )
                    ) : (
                      renderRoleBadge(member.role)
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

