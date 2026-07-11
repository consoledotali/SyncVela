import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useDMEvents } from "./chat-events/useDMEvents";
import { useChannelEvents } from "./chat-events/useChannelEvents";
import { usePresenceEvents } from "./chat-events/usePresenceEvents";
import { useWorkspaceEvents } from "./chat-events/useWorkspaceEvents";

export const useChatSocketEvents = () => {
  const { socket } = useSocket();

  useDMEvents(socket);
  useChannelEvents(socket);
  usePresenceEvents(socket);
  useWorkspaceEvents(socket);

  useEffect(() => {
    if (!socket) return;
    socket.emit("requestOnlineUsers");
  }, [socket]);
};
