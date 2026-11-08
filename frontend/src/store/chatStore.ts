import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ChatStore } from "@/src/types/chat";
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

export type {
  Workspace,
  Channel,
  Message,
  SidebarUser,
  WorkspaceRole,
  Attachment,
  MessageReaction,
  MessageStatus,
} from "@/src/types/chat";

