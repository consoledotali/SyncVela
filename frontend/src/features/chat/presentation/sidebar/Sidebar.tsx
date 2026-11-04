"use client";

import React, { useState } from "react";
import { useChatStore } from "@/src/features/chat/state";

import WorkspaceDropdown from "../workspace/WorkspaceDropdown";
import ChannelList from "../channels/ChannelList";
import DirectMessageList from "../direct-messages/DirectMessageList";
import CurrentUserFooter from "./CurrentUserFooter";

// Modals imported from the parent directory
import NewChannelModal from "../channels/NewChannelModal";
import CreateWorkspaceModal from "../workspace/CreateWorkspaceModal";

export default function Sidebar() {
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const { selectedUser, activeChannelId } = useChatStore();

  return (
    <div
      className={`bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-[100dvh] w-full md:w-[280px] flex-shrink-0 transition-colors ${
        selectedUser || activeChannelId ? "hidden md:flex" : "flex"
      }`}
    >
      <WorkspaceDropdown
        onOpenCreateModal={() => setIsWorkspaceModalOpen(true)}
      />

      <div className="flex-1 overflow-y-auto px-2 scroll-smooth">
        <ChannelList onOpenModal={() => setIsChannelModalOpen(true)} />
        <DirectMessageList />
      </div>

      <CurrentUserFooter />

      {/* INJECT MODALS */}
      <CreateWorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <NewChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
      />
    </div>
  );
}
