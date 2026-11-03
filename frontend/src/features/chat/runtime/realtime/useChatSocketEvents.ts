import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/features/chat/state";
import { useDMEvents } from "../direct-messages/useDMEvents";
import { useChannelEvents } from "../channels/useChannelEvents";
import { usePresenceEvents } from "../presence/usePresenceEvents";
import { useWorkspaceEvents } from "../workspace/useWorkspaceEvents";

export const useChatSocketEvents = () => {
  const { socket } = useSocket();
  const activeWorkspaceId = useChatStore((state) => state.activeWorkspaceId);

  useDMEvents(socket);
  useChannelEvents(socket);
  usePresenceEvents(socket);
  useWorkspaceEvents(socket);

  useEffect(() => {
    if (!socket || !activeWorkspaceId) return;

    const joinActiveWorkspace = () => {
      socket.emit(
        "join_workspace",
        activeWorkspaceId,
        (result: { onlineUserIds?: string[]; error?: string }) => {
          if (result.onlineUserIds) {
            useChatStore.getState().setOnlineUsers(
              [...new Set(result.onlineUserIds.map(String))],
            );
          }
        },
      );
    };

    joinActiveWorkspace();
    socket.on("connect", joinActiveWorkspace);

    return () => {
      socket.off("connect", joinActiveWorkspace);
    };
  }, [activeWorkspaceId, socket]);
};
