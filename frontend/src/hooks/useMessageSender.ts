import { useState } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

export const useMessageSender = () => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuthStore();
  const { activeRoomId, selectedUser, addMessage, addPendingMessage, moveUserToTop } = useChatStore();
  
  // NAYI STATE: Button Lock ke liye
  const [isUploading, setIsUploading] = useState(false);

  const sendMessage = async (inputText: string, selectedFile: File | null, clearInput: () => void) => {
    if ((!inputText.trim() && !selectedFile) || !activeRoomId || !selectedUser) return;
    
    // Agar pehle se upload chal raha hai toh block karo (Double Click Fix)
    if (isUploading) return;

    const messageId = Math.random().toString(36).substring(7);
    let finalAttachmentUrl = null;

    if (selectedFile) {
      setIsUploading(true);
      try {
        const ticketRes = await fetch("http://localhost:5000/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: selectedFile.name, contentType: selectedFile.type }),
        });

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

        if (!uploadRes.ok) throw new Error("Failed to upload file");
        finalAttachmentUrl = finalFileUrl;
      } catch (error) {
        console.error("Upload Error:", error);
        alert("File upload failed.");
        setIsUploading(false);
        return; 
      }
      setIsUploading(false);
    }

    const payload = {
      roomId: activeRoomId,
      text: inputText,
      targetUserId: selectedUser.id,
      tempId: messageId,
      attachmentUrl: finalAttachmentUrl,
    };

    const msgObj: Message = {
      id: messageId,
      text: inputText,
      senderId: user?.id || "unknown",
      createdAt: new Date().toISOString(),
      status: isConnected ? "sent" : "pending",
      attachmentUrl: finalAttachmentUrl,
    };

    if (isConnected && socket) {
      addMessage(msgObj);
      socket.emit("sendPrivateMessage", payload);
    } else {
      addPendingMessage(activeRoomId, selectedUser.id, msgObj);
    }

    moveUserToTop(selectedUser.id);
    clearInput();
  };

  return { sendMessage, isUploading };
};