import React, { useState } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { AttachmentRenderer } from "./message/AttachmentRenderer";
import { getFileDetails } from "./message/utils";
import { MessageStatus } from "./message/MessageStatus";
import { MessageActions } from "./message/MessageActions";

export default function MessageBubble({
  msg,
  isMe,
  isReadRealtime,
  hideHeader = false,
}: any) {
  const { socket } = useSocket();
  const {
    activeChannelId,
    activeRoomId,
    selectedUser,
    deleteMessage,
    editMessage,
    onlineUsers,
  } = useChatStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || "");

  const isChannelView = !!activeChannelId;
  const isTargetOnline = selectedUser
    ? onlineUsers.includes(selectedUser.id)
    : false;

  const senderName = msg.sender?.name || (isMe ? "You" : "User");
  const initials = senderName.substring(0, 2).toUpperCase();
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // 🚀 STRICT RELATIONAL EXTRACTION (No legacy fallback)
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

  const mediaFiles = attachments.filter((att: any) => {
    if (!att || !att.url) return false;
    const type = getFileDetails(att.url).type;
    return type === "image" || type === "video";
  });

  const docFiles = attachments.filter((att: any) => {
    if (!att || !att.url) return false;
    const type = getFileDetails(att.url).type;
    return type !== "image" && type !== "video";
  });

  const handleDelete = () => {
    if (!socket || !isMe) return;
    deleteMessage(msg.id);
    socket.emit("delete_message", {
      messageId: msg.id,
      roomId: activeChannelId || activeRoomId,
      isChannel: isChannelView,
      targetUserId: selectedUser?.id,
    });
  };

  const handleEditSubmit = () => {
    if (!socket || !isMe || editText.trim() === "" || editText === msg.text) {
      setIsEditing(false);
      return;
    }
    editMessage(msg.id, editText.trim());
    setIsEditing(false);
    socket.emit("edit_message", {
      messageId: msg.id,
      newText: editText.trim(),
      roomId: activeChannelId || activeRoomId,
      isChannel: isChannelView,
      targetUserId: selectedUser?.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(msg.text || "");
    }
  };

  return (
    <div
      className={`relative group flex gap-3 pr-6 pl-4 hover:bg-muted/40 transition-colors duration-150 border-l-[3px] border-transparent hover:border-primary/40 ${!hideHeader ? "mt-4 pt-1 pb-1" : "mt-[2px] pt-[2px] pb-[2px]"}`}
    >
      <MessageActions
        isMe={isMe}
        isEditing={isEditing}
        hasText={!!msg.text}
        onEdit={() => setIsEditing(true)}
        onDelete={handleDelete}
      />

      <div className="w-[42px] shrink-0 flex flex-col items-center select-none relative">
        {!hideHeader ? (
          <Avatar className="h-[40px] w-[40px] border border-border rounded-md shadow-sm">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`}
            />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold rounded-md">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute top-1.5 w-12 text-center pointer-events-none">
            {timeString}
          </span>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        {!hideHeader && (
          <div className="flex items-baseline gap-2 select-none mb-0.5">
            <span className="font-bold text-[15px] text-foreground hover:underline cursor-pointer">
              {senderName}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {timeString}
            </span>
            {isMe && (
              <MessageStatus
                status={msg.status}
                isReadRealtime={isReadRealtime}
                isChannel={isChannelView}
                isTargetOnline={isTargetOnline}
              />
            )}
          </div>
        )}

        {isEditing ? (
          <div className="mt-1 max-w-2xl bg-background border border-border rounded-lg p-2 shadow-sm focus-within:ring-1 focus-within:ring-primary transition-all">
            <textarea
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-[14.5px] bg-transparent resize-none outline-none text-foreground leading-relaxed"
              rows={2}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditText(msg.text || "");
                }}
                className="text-xs px-2 py-1.5 hover:bg-muted text-muted-foreground rounded transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="text-xs px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded transition-colors shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          msg.text &&
          msg.text.trim() !== "" && (
            <p className="text-[14.5px] text-foreground/95 leading-[1.45] whitespace-pre-wrap break-words">
              {msg.text}
            </p>
          )
        )}

        {mediaFiles.length > 0 && (
          <div
            className={`mt-1.5 grid gap-1.5 ${mediaFiles.length === 1 ? "grid-cols-1 max-w-[360px]" : "grid-cols-2 max-w-[420px]"}`}
          >
            {mediaFiles.map((att: any, index: number) => (
              <AttachmentRenderer
                key={att.id || index}
                attachment={att}
                isMulti={mediaFiles.length > 1}
              />
            ))}
          </div>
        )}

        {docFiles.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {docFiles.map((att: any, index: number) => (
              <AttachmentRenderer
                key={att.id || index}
                attachment={att}
                isMulti={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
