"use client";

import React, { useState } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { usePermissions } from "@/src/hooks/usePermissions"; // 🚀 RBAC IMPORT
import {
  MessageSquare,
  ChevronDown,
  UserPlus,
  Plus,
  Trash2,
  Loader2,
  Settings,
} from "lucide-react";
import WorkspaceInviteModal from "./WorkspaceInviteModal";
import ManageMembersModal from "./ManageMembersModal"; // 🚀 NEW MODAL IMPORT

interface WorkspaceDropdownProps {
  onOpenCreateModal: () => void;
}

export default function WorkspaceDropdown({
  onOpenCreateModal,
}: WorkspaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false); // 🚀 NEW STATE
  const [isDeleting, setIsDeleting] = useState(false);

  const { token } = useAuthStore();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    setActiveChannelId,
    setSelectedUser,
    setWorkspaces,
  } = useChatStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // 🛡️ THE CLEAN RBAC ENGINE
  const { hasPermission } = usePermissions();
  const canInvite = hasPermission("INVITE_USERS");
  const canDelete = hasPermission("DELETE_WORKSPACE");
  const canManageWorkspace = hasPermission("MANAGE_WORKSPACE");

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspaceId) return;
    const confirmDelete = window.confirm(
      `Are you absolutely sure you want to delete "${activeWorkspace?.name}"?\nThis action cannot be undone.`,
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const updatedWorkspaces = workspaces.filter(
          (w) => w.id !== activeWorkspaceId,
        );
        setWorkspaces(updatedWorkspaces);
        setActiveChannelId(null);
        setSelectedUser(null);
        setIsOpen(false);

        if (updatedWorkspaces.length > 0) {
          setActiveWorkspaceId(updatedWorkspaces[0].id);
          localStorage.setItem(
            "lastActiveWorkspaceId",
            updatedWorkspaces[0].id,
          );
        } else {
          setActiveWorkspaceId(null);
          localStorage.removeItem("lastActiveWorkspaceId");
        }
      } else {
        const data = await response.json();
        alert(`❌ Deletion Failed: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Critical Error: Failed to delete workspace.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="relative z-40">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="p-4 flex justify-between items-center h-[60px] cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 select-none"
        >
          <div className="flex items-center gap-2 font-bold text-lg text-foreground truncate">
            <MessageSquare
              className="h-5 w-5 text-primary shrink-0"
              fill="currentColor"
            />
            <span className="truncate">
              {activeWorkspace ? activeWorkspace.name : "SyncVela"}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            ></div>
            <div className="absolute top-[55px] left-2 right-2 bg-background border border-border rounded-lg shadow-xl py-1 z-50">
              <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Switch Workspace
              </div>
              <div className="max-h-48 overflow-y-auto">
                {workspaces.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => {
                      if (w.id !== activeWorkspaceId) {
                        setActiveChannelId(null);
                        setSelectedUser(null);
                        setActiveWorkspaceId(w.id);
                      }
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                      w.id === activeWorkspaceId
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted text-foreground font-medium"
                    }`}
                  >
                    {w.name}
                  </div>
                ))}
              </div>

              <div className="border-t border-border mt-1 mb-1"></div>

              {/* 🛡️ UI GATEKEEPER via Hooks */}
              {canInvite && (
                <div
                  onClick={() => {
                    setIsOpen(false);
                    setIsInviteModalOpen(true);
                  }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-foreground font-medium flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" /> Invite people
                </div>
              )}

              {/* 🚀 THE MANAGEMENT DASHBOARD TRIGGER */}
              {canManageWorkspace && (
                <div
                  onClick={() => {
                    setIsOpen(false);
                    setIsManageModalOpen(true);
                  }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-foreground font-medium flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" /> Manage Workspace Members
                </div>
              )}

              {canDelete && (
                <div
                  onClick={handleDeleteWorkspace}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-red-50 text-red-600 font-medium flex items-center gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}{" "}
                  Delete workspace
                </div>
              )}

              <div
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted text-primary font-bold flex items-center gap-2 border-t border-border mt-1 pt-2"
              >
                <Plus className="h-4 w-4" /> Create new workspace
              </div>
            </div>
          </>
        )}
      </div>

      {activeWorkspace && (
        <WorkspaceInviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          workspaceName={activeWorkspace.name}
          inviteCode={(activeWorkspace as any).inviteCode || ""}
        />
      )}

      {/* 🚀 THE MANAGEMENT MODAL */}
      <ManageMembersModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </>
  );
}

