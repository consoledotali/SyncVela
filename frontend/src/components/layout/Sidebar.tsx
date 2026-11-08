"use client";

import React, { useState } from "react";
import { useChatStore } from "@/src/store/chatStore";

import WorkspaceDropdown from "@/src/components/workspace/WorkspaceDropdown";
import ChannelList from "@/src/components/channels/ChannelList";
import DirectMessageList from "@/src/components/direct-messages/DirectMessageList";
import CurrentUserFooter from "./CurrentUserFooter";

import NewChannelModal from "@/src/components/channels/NewChannelModal";
import CreateWorkspaceModal from "@/src/components/workspace/CreateWorkspaceModal";

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

