"use client";

import React, { useState, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import Auth from "@/src/components/Auth";

// Naye Components Import karo
import Sidebar from "@/src/components/chat/Sidebar";
import ChatArea from "@/src/components/chat/ChatArea";

export default function ChatPage() {
  const { socket } = useSocket();
  const {
    setUsers,
    setActiveRoomId,
    addMessage,
    setMessages,
    setOnlineUsers,
    setTargetLastReadAt,
    addTypingUser,
    removeTypingUser,
  } = useChatStore();
  const { isAuthenticated, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 1. Initial Data Fetching (Users & Unread Counts)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const fetchInitialData = async () => {
      try {
        const [usersRes, unreadRes] = await Promise.all([
          fetch(`http://localhost:5000/api/users?currentUserId=${user.id}`),
          fetch(
            `http://localhost:5000/api/chat/unread-counts?userId=${user.id}`,
          ),
        ]);

        if (usersRes.ok) setUsers(await usersRes.json());
        if (unreadRes.ok) {
          // Store mein naya data dal do
          const counts = await unreadRes.json();
          useChatStore.setState({ unreadCounts: counts });
        }
      } catch (error) {
        console.error("❌ Failed to fetch initial data", error);
      }
    };
    fetchInitialData();
  }, [isAuthenticated, user?.id, setUsers]);

  // 2. Global Socket Listeners (Engineers yahan ghalti karte hain, inko layout level par hona chahiye)
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = async (roomId: string) => {
      setActiveRoomId(roomId);

      const currentSelectedUser = useChatStore.getState().selectedUser;
      if (currentSelectedUser) {
        socket.emit("markAsRead", {
          roomId,
          targetUserId: currentSelectedUser.id,
        });
        useChatStore.getState().clearUnread(currentSelectedUser.id);
      }

      try {
        const response = await fetch(
          `http://localhost:5000/api/chat/${roomId}/messages`,
        );
        if (response.ok) {
          const data = await response.json();

          const formattedHistory: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          }));
          setMessages(formattedHistory);

          if (currentSelectedUser) {
            const targetParticipant = data.participants.find(
              (p: any) => p.userId === currentSelectedUser.id,
            );
            setTargetLastReadAt(targetParticipant?.lastReadAt || null);
          }

          useChatStore.getState().setPagination(data.hasMore, data.nextCursor);
        }
      } catch (error) {
        console.error("❌ Failed to fetch room history", error);
      }
    };

    const handleMessagesRead = ({ roomId }: { roomId: string }) => {
      const activeRoom = useChatStore.getState().activeRoomId;
      if (activeRoom === roomId) {
        setTargetLastReadAt(new Date().toISOString());
      }
    };

    const handleNewMessage = (message: Message) => {
      const chatState = useChatStore.getState();
      const authState = useAuthStore.getState();

      const currentSelectedUser = chatState.selectedUser;
      const currentRoomId = chatState.activeRoomId;
      const me = authState.user;

      const isMeSender = message.senderId === me?.id;
      const targetUserId = isMeSender
        ? currentSelectedUser?.id
        : message.senderId;

      if (targetUserId) {
        chatState.moveUserToTop(targetUserId);
      }

      if (currentSelectedUser?.id === message.senderId) {
        chatState.addMessage(message);

        if (currentRoomId) {
          socket.emit("markAsRead", {
            roomId: currentRoomId,
            targetUserId: message.senderId,
          });
        }
      } else {
        chatState.incrementUnread(message.senderId);

        // NAYA: Ab tempId bhi sath wapis bhejo
        socket.emit("markAsDelivered", {
          messageId: message.id,
          senderId: message.senderId,
          tempId: message.tempId,
        });
      }
    };

    const handleTyping = ({ senderId }: { senderId: string }) => {
      useChatStore.getState().addTypingUser(senderId);
    };

    const handleStopTyping = ({ senderId }: { senderId: string }) => {
      useChatStore.getState().removeTypingUser(senderId);
    };

    // YEH PURANA WALA HATA DO AUR YEH NAYA LAGA DO
    const handleMessageDelivered = ({
      messageId,
      tempId,
    }: {
      messageId: string;
      tempId?: string;
    }) => {
      // Ek hi call mein dono bhej do, store khud handle kar lega
      useChatStore
        .getState()
        .updateMessageStatus(messageId, "delivered", tempId);
    };

    // NAYA: Jab message database mein chala jaye aur asli ID mil jaye
    const handleMessageAck = ({
      tempId,
      realId,
    }: {
      tempId: string;
      realId: string;
    }) => {
      useChatStore.getState().updateRealMessageId(tempId, realId);
    };

    socket.on("roomJoined", handleRoomJoined);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("receiveMessage", handleNewMessage);

    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);

    socket.on("getOnlineUsers", (userIds: string[]) => {
      setOnlineUsers(userIds);
    });
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);

    const handleDisconnect = () => {
      console.warn("⚠️ Server connection lost. Clearing online users.");
      setOnlineUsers([]); // Fauran sabko offline (Gray) kar do
    };

    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("receiveMessage", handleNewMessage);
      socket.off("userTyping", handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
      socket.off("getOnlineUsers");
      socket.off("disconnect", handleDisconnect);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSentAck", handleMessageAck);
    };
  }, [
    socket,
    setActiveRoomId,
    addMessage,
    setMessages,
    setOnlineUsers,
    setTargetLastReadAt,
    addTypingUser,
    removeTypingUser,
  ]);

  if (!mounted) return null;
  if (!isAuthenticated) return <Auth />;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
