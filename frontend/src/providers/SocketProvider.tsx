"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { refreshAccessToken } from "@/src/utils/apiUtils";
import { useChatStore } from "@/src/store/chatStore";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      const cleanupTask = window.setTimeout(() => {
        setSocket((currentSocket) => {
          currentSocket?.disconnect();
          return null;
        });
        setIsConnected(false);
      }, 0);

      return () => window.clearTimeout(cleanupTask);
    }

    const socketInstance = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
      {
        auth: { token: token },
      },
    );

    socketInstance.on("connect", () => {
      setIsConnected(true);
      socketInstance.emit("presence:heartbeat");

      setTimeout(() => {
        const { pendingQueue, removePendingMessage, updateMessageStatus } =
          useChatStore.getState();

        if (pendingQueue.length > 0) {
          pendingQueue.forEach((pendingItem) => {
            socketInstance.emit("sendPrivateMessage", {
              roomId: pendingItem.roomId,
              text: pendingItem.message.text,
              targetUserId: pendingItem.targetUserId,
              tempId: pendingItem.message.id,
            });
            removePendingMessage(pendingItem.message.id);
            updateMessageStatus(pendingItem.message.id, "sent");
          });
        }
      }, 1000);
    });

    socketInstance.on("connect_error", async (err) => {
      const errorMessage = err.message.toLowerCase();

      if (
        errorMessage.includes("invalid") ||
        errorMessage.includes("expired") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("token")
      ) {
        try {
          const session = await refreshAccessToken();
          if (!session) throw new Error("Refresh API rejected the request");

          socketInstance.auth = { token: session.accessToken };
          socketInstance.connect();
        } catch {
          useAuthStore.getState().logout();
          router.push("/auth/login");
        }
      }
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    const presenceHeartbeat = () => socketInstance.emit("presence:heartbeat");
    const heartbeatInterval = window.setInterval(presenceHeartbeat, 30_000);

    const invalidateWorkspace = () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
    };
    socketInstance.on("channel_created", invalidateWorkspace);
    socketInstance.on("added_to_channel", invalidateWorkspace);

        const socketStateTask = window.setTimeout(() => {
      setSocket(socketInstance);
    }, 0);

    return () => {
      window.clearTimeout(socketStateTask);

      socketInstance.off("connect");
      socketInstance.off("connect_error");
      socketInstance.off("disconnect");
      socketInstance.off("channel_created", invalidateWorkspace);
      socketInstance.off("added_to_channel", invalidateWorkspace);
      window.clearInterval(heartbeatInterval);
      socketInstance.disconnect();
    };
  }, [isAuthenticated, queryClient, router, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

