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

    // 🟡 SILENT TOKEN REFRESH INTERCEPTOR
    socketInstance.on("connect_error", async (err) => {
      console.log("🔴 EXACT SOCKET ERROR:", err.message);
      
      const errorMessage = err.message.toLowerCase();

      // 🛡️ NAYA: Strict (===) ki jagah .includes() use karo taake koi bhi auth error miss na ho
      if (
        errorMessage.includes("invalid") ||
        errorMessage.includes("expired") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("token")
      ) {
        console.warn("⚠️ Access token expired. Attempting silent refresh...");

        try {
          const res = await fetch("http://localhost:5000/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          if (!res.ok) throw new Error("Refresh failed");

          const data = await res.json();
          console.log("✅ Token silently refreshed! Zustand will trigger reconnection.");

          // Zustand store update karo (ye lazmi token inject karega aur naya socket banayega)
          useAuthStore.setState({ token: data.accessToken });
          
        } catch (error) {
          console.error("❌ Refresh token expired or failed. Forcing logout.");
          useAuthStore.getState().logout(); // Proper Zustand logout action use karo
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
