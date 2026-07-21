"use client";

import React, { useEffect, useState } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { X, ShieldAlert, Loader2, ShieldCheck, UserX } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManageMembersModal({
  isOpen,
  onClose,
}: ManageMembersModalProps) {
  const { token } = useAuthStore();
  const { activeWorkspaceId } = useChatStore();
  const { workspaces } = useChatStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchWorkspaceMembers = async () => {
    if (!activeWorkspaceId || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to load workspace members", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchWorkspaceMembers();
  }, [isOpen, activeWorkspaceId]);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/members/role`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            workspaceId: activeWorkspaceId,
            targetUserId,
            newRole,
          }),
        },
      );

      if (res.ok) {
        setMembers(
          members.map((m) =>
            m.id === targetUserId ? { ...m, role: newRole } : m,
          ),
        );
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("API request failed.");
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members/${targetUserId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setMembers(members.filter((m) => m.id !== targetUserId));
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("API request failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

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
              Promote permissions or purge accounts inside{" "}
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
            members.map((member) => (
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
                          : `https://api.dicebear.com/7.x/initials/svg?seed=${member?.name}`
                      }
                      className="object-cover w-full h-full !rounded-md"
                    />
                    <AvatarFallback className="!rounded-md bg-primary/10 text-primary font-bold">
                      {member.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate">
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {member.role === "OWNER" ? (
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2.5 py-1 rounded">
                      Owner
                    </span>
                  ) : (
                    <>
                      {actionLoadingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <select
                            value={member.role || "MEMBER"}
                            onChange={(e) =>
                              handleRoleChange(member.id, e.target.value)
                            }
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
                            className="p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600 rounded transition-colors"
                            title="Kick from workspace"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

