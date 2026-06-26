"use client";

import React, { useState } from "react";
import { useChatStore } from "@/src/store/chat";

import WorkspaceDropdown from "./WorkspaceDropdown";
import ChannelList from "./ChannelList";
import DirectMessageList from "./DirectMessageList";
import CurrentUserFooter from "./CurrentUserFooter";

// Modals imported from the parent directory
import NewChannelModal from "../NewChannelModal";
import CreateWorkspaceModal from "../CreateWorkspaceModal";

export default function Sidebar() {
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  const { selectedUser, activeChannelId } = useChatStore();

  return (
    <div
      className={`bg-[#f8f9fa] border-r border-border flex-col h-[100dvh] w-full md:w-[280px] flex-shrink-0 transition-all ${
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
