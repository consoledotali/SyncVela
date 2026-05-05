"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/src/store/authStore";
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { token, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketInstance = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
      {
        auth: {
          token: token,
        },
      },
    );

    // 🟢 CONNECTION & FLUSH ENGINE
    socketInstance.on("connect", () => {
      console.log("🟢 Frontend Connected to WebSocket Engine");
      setIsConnected(true);

      const { pendingQueue, removePendingMessage, updateMessageStatus } =
        useChatStore.getState();

      if (pendingQueue.length > 0) {
        console.log(
          `🔄 Flushing ${pendingQueue.length} pending messages to server...`,
        );
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
    });

    // 🟡 SILENT TOKEN REFRESH INTERCEPTOR (NAYA CODE)
    socketInstance.on("connect_error", async (err) => {
      // Backend se agar auth error aaye toh trigger karo
      if (
        err.message === "Invalid token" ||
        err.message === "jwt expired" ||
        err.message === "Authentication error"
      ) {
        console.warn("⚠️ Access token expired. Attempting silent refresh...");

        try {
          const res = await fetch("http://localhost:5000/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Agar backend cookies use karega toh yeh line lazmi hai
            credentials: "include",
          });

          if (!res.ok) throw new Error("Refresh failed");

          const data = await res.json();

          console.log(
            "✅ Token silently refreshed! Zustand will trigger reconnection.",
          );

          // Zustand store ko update karo. Yeh line trigger karte hi React ka
          // useEffect dobara chalega naye token ke sath!
          useAuthStore.setState({ token: data.accessToken });
        } catch (error) {
          console.error("❌ Refresh token expired or failed. Forcing logout.");
          // Agar refresh token bhi expire ho gaya, toh strictly user ko bahar nikalo
          useAuthStore.setState({
            token: null,
            isAuthenticated: false,
            user: null,
          });
          window.location.href = "/login";
        }
      }
    });

    socketInstance.on("disconnect", () => {
      console.log("🔴 Frontend Disconnected");
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
