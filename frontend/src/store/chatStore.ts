import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatStore } from "@/src/types/storeTypes";
import { createWorkspaceSlice } from "./slices/workspaceSlice";
import { createChatUISlice } from "./slices/uiSlice";
import { createUserSlice } from "./slices/userSlice";
import { createMessageSlice } from "./slices/messageSlice";

export const useChatStore = create<ChatStore>()(
  persist(
    (...a) => ({
      ...createWorkspaceSlice(...a),
      ...createChatUISlice(...a),
      ...createUserSlice(...a),
      ...createMessageSlice(...a),
    }),
    {
      name: "syncvela-chat-storage",
      partialize: (state) => ({ pendingQueue: state.pendingQueue }),
    },
  ),
);

export type { Workspace, WorkspaceRole, SidebarUser } from "@/src/types/workspaceTypes";
export type { Channel } from "@/src/types/channelTypes";
export type { Message, Attachment, MessageReaction, MessageStatus } from "@/src/types/messageTypes";
export type { ChatStore } from "@/src/types/storeTypes";

