"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

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

      // 🛡️ THE RACE CONDITION FIX: Delay the flush by 1 second
      setTimeout(() => {
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
      }, 1000);
    });

    // 🟡 SILENT TOKEN REFRESH INTERCEPTOR
    socketInstance.on("connect_error", async (err) => {
      console.log("🔴 EXACT SOCKET ERROR:", err.message);

      const errorMessage = err.message.toLowerCase();

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

          if (!res.ok) throw new Error("Refresh API rejected the request");

          const data = await res.json();
          console.log("✅ Token silently refreshed! Injecting hot-swap...");

          socketInstance.auth = { token: data.accessToken };
          useAuthStore.setState({ token: data.accessToken });
          socketInstance.connect();
        } catch (error) {
          console.error("❌ Refresh token strictly failed. Wiping state.");
          useAuthStore.getState().logout();

          // 🛡️ THE FIX: Force redirect to NEW auth route if completely dead
          router.push("/auth/login");
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
  }, [isAuthenticated, router]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
