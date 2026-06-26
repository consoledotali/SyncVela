import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatStore } from "./types";
import { createWorkspaceSlice } from "./workspaceSlice";
import { createChatUISlice } from "./uiSlice";
import { createUserSlice } from "./userSlice";
import { createMessageSlice } from "./messageSlice";

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

// 🛡️ RE-EXPORT TYPES FOR EASY IMPORT ANYWHERE IN APP
export type { Workspace, Channel, Message, SidebarUser } from "./types";