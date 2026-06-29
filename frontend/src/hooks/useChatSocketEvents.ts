import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useDMEvents } from "./chat-events/useDMEvents";
import { useChannelEvents } from "./chat-events/useChannelEvents";
import { usePresenceEvents } from "./chat-events/usePresenceEvents";

export const useChatSocketEvents = () => {
  const { socket } = useSocket();

  // 🛡️ DOMAIN-DRIVEN EVENT DELEGATION
  useDMEvents(socket);
  useChannelEvents(socket);
  usePresenceEvents(socket);

  // 🟢 GLOBAL INITIALIZATION
  useEffect(() => {
    if (!socket) return;

    // Request online user presence map exactly once when socket mounts
    socket.emit("requestOnlineUsers");
  }, [socket]);
};
