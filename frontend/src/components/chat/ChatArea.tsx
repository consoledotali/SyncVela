import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

export default function ChatArea() {
  const { socket, isConnected } = useSocket();
  const { user } = useAuthStore();
  const {
    messages,
    addMessage,
    selectedUser,
    activeRoomId,
    targetLastReadAt,
    hasMore,
    nextCursor,
    isLoadingMore,
    setPagination,
    prependMessages,
    setIsLoadingMore,
    moveUserToTop,
    addPendingMessage,
    typingUsers,
  } = useChatStore();

  const [inputText, setInputText] = useState("");
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(
    null,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // NAYI STATES AUR REFS (Component ke top par add karo)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // THE GATEKEEPER: File Validation Engine
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10MB Limit Check (10 * 1024 * 1024 bytes)
    if (file.size > 10485760) {
      alert("⚠️ File size must be under 10MB");
      if (fileInputRef.current) fileInputRef.current.value = ""; // Input wapis empty karo
      return;
    }

    setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Check karo kya jiski chat khuli hai, wo banda type kar raha hai?
  const isCurrentlyTyping = selectedUser
    ? typingUsers.includes(selectedUser.id)
    : false;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!socket || !activeRoomId || !selectedUser) return;
    socket.emit("typing", { targetUserId: selectedUser.id });
    if (typingTimeout) clearTimeout(typingTimeout);
    const newTimeout = setTimeout(() => {
      socket.emit("stopTyping", { targetUserId: selectedUser.id });
    }, 2000);
    setTypingTimeout(newTimeout);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeRoomId || !selectedUser)
      return;

    const messageId = Math.random().toString(36).substring(7);
    let finalAttachmentUrl = null;

    // 1. Agar koi file select ki gayi hai, toh pehle AWS S3/DO Spaces ka flow chalega
    if (selectedFile) {
      try {
        // Step A: Backend se S3 ka Presigned URL (Ticket) mango
        const ticketRes = await fetch(
          "http://localhost:5000/api/upload/presign",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: selectedFile.name,
              contentType: selectedFile.type,
            }),
          },
        );

        if (!ticketRes.ok) throw new Error("Failed to get upload ticket");
        const { uploadUrl, finalFileUrl } = await ticketRes.json();

        // Step B: Direct Frontend se Cloud Bucket (S3/DO) par file upload karo (PUT request)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": selectedFile.type,
            "x-amz-acl": "public-read", // Same ACL jo backend mein define kiya tha
          },
          body: selectedFile,
        });

        if (!uploadRes.ok)
          throw new Error("Failed to upload file to Cloud Storage");

        // Upload successful! URL save karo taake message mein bhej sakein
        finalAttachmentUrl = finalFileUrl;

        // File upload hone ke baad state se hata do
        removeSelectedFile();
      } catch (error) {
        console.error("Attachment Upload Error:", error);
        alert("File upload failed. Please try again.");
        return; // Agar image upload fail ho jaye, toh message send mat karo
      }
    }

    // 2. Normal Message Payload (Jisme ab image ka URL bhi ja sakta hai)
    // Note: Tumhein apne backend aur socket logic mein `attachmentUrl` ya `mediaUrl` ki field add karni paregi
    const payload = {
      roomId: activeRoomId,
      text: inputText,
      targetUserId: selectedUser.id,
      tempId: messageId,
      attachmentUrl: finalAttachmentUrl, // Naya field add kiya hai
    };

    if (isConnected && socket) {
      const optimisticMsg: Message = {
        id: messageId,
        text: inputText,
        senderId: user?.id || "unknown",
        createdAt: new Date().toISOString(),
        status: "sent",
        attachmentUrl: finalAttachmentUrl,
      };

      addMessage(optimisticMsg);
      socket.emit("sendPrivateMessage", payload);
    } else {
      const pendingMsg: Message = {
        id: messageId,
        text: inputText,
        senderId: user?.id || "unknown",
        createdAt: new Date().toISOString(),
        status: "pending",
        attachmentUrl: finalAttachmentUrl,
      };

      addPendingMessage(activeRoomId, selectedUser.id, pendingMsg);
    }

    if (selectedUser?.id) moveUserToTop(selectedUser.id);
    setInputText("");
    if (socket && isConnected)
      socket.emit("stopTyping", { targetUserId: selectedUser.id });
    if (typingTimeout) clearTimeout(typingTimeout);
  };

  const handleScroll = async () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    if (
      scrollTop === 0 &&
      hasMore &&
      !isLoadingMore &&
      nextCursor &&
      activeRoomId
    ) {
      setIsLoadingMore(true);
      const previousScrollHeight = scrollHeight;
      try {
        const res = await fetch(
          `http://localhost:5000/api/chat/${activeRoomId}/messages?cursor=${nextCursor}`,
        );
        if (res.ok) {
          const data = await res.json();
          const formattedOlder: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
          }));
          prependMessages(formattedOlder);
          setPagination(data.hasMore, data.nextCursor);
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop =
                scrollContainerRef.current.scrollHeight - previousScrollHeight;
            }
          }, 0);
        }
      } catch (err) {
        console.error("Failed to load older messages", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 100);
    }
  }, [messages, isCurrentlyTyping]);

  useEffect(() => {
    if (activeRoomId) setIsInitialLoad(true);
  }, [activeRoomId]);

  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
      setIsInitialLoad(false);
    }
  }, [messages, isInitialLoad]);

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-300 mb-2">
            SyncVela Private Chat
          </h2>
          <p className="text-gray-400">
            Select a contact from the sidebar to start messaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="bg-white p-4 shadow-sm border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">{selectedUser.name}</h2>
        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
          {activeRoomId ? "Room Secured 🔒" : "Securing Room..."}
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-gray-50"
      >
        {isLoadingMore && (
          <div className="text-center p-2 text-xs text-blue-500 font-medium">
            Loading older messages...
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">
            Start the conversation with {selectedUser.name}
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = user?.id === msg.senderId;

            const isReadRealtime =
              isMe &&
              targetLastReadAt &&
              new Date(msg.createdAt) <= new Date(targetLastReadAt);

            let statusIcon = null;
            if (isMe) {
              if (msg.status === "pending") {
                statusIcon = <span className="text-gray-300">⏳</span>;
              } else if (msg.status === "sent" && !isReadRealtime) {
                statusIcon = <span className="text-gray-300">✓</span>;
              } else if (msg.status === "delivered" && !isReadRealtime) {
                statusIcon = <span className="text-gray-300">✓✓</span>;
              } else if (msg.status === "read" || isReadRealtime) {
                statusIcon = <span className="text-black">✓✓</span>;
              } else {
                statusIcon = <span className="text-gray-300">✓</span>;
              }
            }

            return (
              <div
                key={msg.id}
                className={`p-3 rounded-lg max-w-[70%] flex flex-col ${
                  isMe
                    ? "bg-blue-600 text-white self-end rounded-br-none"
                    : "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                } ${msg.status === "pending" ? "opacity-80" : "opacity-100"}`}
              >
                <p>{msg.text}</p>
                <div
                  className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                    isMe ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {statusIcon}
                </div>
              </div>
            );
          })
        )}

        {/* NAYA UI LOGIC */}
        {isCurrentlyTyping && (
          <div className="p-3 rounded-lg bg-gray-100 text-gray-500 self-start rounded-bl-none animate-pulse text-sm font-medium">
            {selectedUser?.name} is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* NAYA UI: File Preview Box (Agar koi file select ki hai toh form ke oopar dikhegi) */}
      {selectedFile && (
        <div className="bg-gray-100 p-2 mx-4 mt-2 rounded-md flex justify-between items-center border border-gray-300">
          <span className="text-sm text-gray-700 truncate max-w-[80%]">
            📎 {selectedFile.name} (
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </span>
          <button
            type="button"
            onClick={removeSelectedFile}
            className="text-red-500 hover:text-red-700 text-sm font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* UPDATED FORM: Paperclip icon ke sath */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white p-4 border-t border-gray-200 flex gap-2 items-center"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.csv,.doc,.docx"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!activeRoomId || !isConnected}
          className="p-2 text-gray-500 hover:text-blue-600 disabled:text-gray-300 transition-colors"
          title="Attach File"
        >
          {/* Simple SVG Paperclip Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
            />
          </svg>
        </button>

        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={
            isConnected
              ? `Message ${selectedUser.name}...`
              : "Reconnecting to server..."
          }
          className={`flex-1 border rounded-md p-2 text-black focus:outline-none ${!isConnected ? "bg-gray-100 border-red-300 cursor-not-allowed" : "border-gray-300 focus:border-blue-500"}`}
          disabled={!activeRoomId || !isConnected}
        />

        <button
          type="submit"
          // Button tab tak disable rahega jab tak koi text YA koi file select nahi hoti
          disabled={
            !activeRoomId ||
            !isConnected ||
            (!inputText.trim() && !selectedFile)
          }
          className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${!activeRoomId || !isConnected ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          Send
        </button>
      </form>
    </div>
  );
}
