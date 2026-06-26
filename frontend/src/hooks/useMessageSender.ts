import { useState } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";

export const useMessageSender = () => {
  const { socket, isConnected } = useSocket();
  const { user, token } = useAuthStore();

  const {
    activeRoomId,
    activeChannelId,
    selectedUser,
    addMessage,
    addPendingMessage,
    moveUserToTop,
  } = useChatStore() as any;

  const [isUploading, setIsUploading] = useState(false);

  const sendMessage = async (
    inputText: string,
    selectedFile: File | null,
    clearInput: () => void,
  ) => {
    const isChannelContext = !!activeChannelId;
    const isDMContext = !!activeRoomId && !!selectedUser;

    if (
      (!inputText.trim() && !selectedFile) ||
      (!isChannelContext && !isDMContext)
    )
      return;
    if (isUploading) return;

    const messageId = Math.random().toString(36).substring(7);
    let finalAttachmentUrl = null;

    // ==========================================
    // 🛡️ SECURE S3 UPLOAD LOGIC
    // ==========================================
    if (selectedFile) {
      setIsUploading(true);
      try {
        if (!token) throw new Error("Authentication missing for upload");

        const ticketRes = await fetch(
          "http://localhost:5000/api/upload/presign",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filename: selectedFile.name,
              contentType: selectedFile.type,
            }),
          },
        );

        if (!ticketRes.ok) throw new Error("Failed to get upload ticket");
        const { uploadUrl, finalFileUrl } = await ticketRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": selectedFile.type,
            "x-amz-acl": "public-read",
          },
          body: selectedFile,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload file to S3");
        finalAttachmentUrl = finalFileUrl;
      } catch (error) {
        console.error("Upload Error:", error);
        alert("File upload failed. Check format or connection.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // ==========================================
    // 🚀 UNIFIED SENDING LOGIC
    // ==========================================
    const msgObj: Message = {
      id: messageId,
      text: inputText,
      senderId: user?.id || "unknown",
      createdAt: new Date().toISOString(),
      status: isConnected ? "sent" : "pending",
      attachmentUrl: finalAttachmentUrl,
      tempId: messageId,
      // 🛡️ THE IDENTITY FIX: UI ab ghalti se 'You' render nahi karega
      sender: {
        id: user?.id || "",
        name: user?.name || "Unknown",
        avatarUrl: null,
      },
    };

    if (isConnected && socket) {
      addMessage(msgObj);

      if (isChannelContext) {
        socket.emit("send_channel_message", {
          channelId: activeChannelId,
          content: inputText,
          attachmentUrl: finalAttachmentUrl,
          tempId: messageId,
        });
      } else if (isDMContext) {
        socket.emit("sendPrivateMessage", {
          roomId: activeRoomId,
          text: inputText,
          targetUserId: selectedUser.id,
          tempId: messageId,
          attachmentUrl: finalAttachmentUrl,
        });
        moveUserToTop(selectedUser.id);
      }
    } else {
      if (isDMContext) {
        addPendingMessage(activeRoomId, selectedUser.id, msgObj);
      }
    }

    clearInput();
  };

  return { sendMessage, isUploading };
};
