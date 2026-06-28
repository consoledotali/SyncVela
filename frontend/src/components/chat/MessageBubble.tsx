import React from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chat";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Video,
  Music,
  File,
  Download,
  Trash2,
} from "lucide-react";

// ============================================================================
// 🛠️ 1. UTILS: PURE FUNCTIONS (No React lifecycle overhead)
// ============================================================================
const getFileDetails = (url: string) => {
  try {
    const cleanUrl = url.split("?")[0];
    const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";
    const filename = decodeURIComponent(
      cleanUrl.split("/").pop() || "attachment",
    );

    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension))
      return { type: "image", extension, filename, Icon: ImageIcon };
    if (["mp4", "webm", "mov"].includes(extension))
      return { type: "video", extension, filename, Icon: Video };
    if (["mp3", "wav", "ogg"].includes(extension))
      return { type: "audio", extension, filename, Icon: Music };
    if (["pdf", "doc", "docx", "txt"].includes(extension))
      return { type: "document", extension, filename, Icon: FileText };
    if (["csv", "xls", "xlsx"].includes(extension))
      return {
        type: "spreadsheet",
        extension,
        filename,
        Icon: FileSpreadsheet,
      };
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension))
      return { type: "archive", extension, filename, Icon: FileArchive };

    return { type: "unknown", extension, filename, Icon: File };
  } catch {
    return {
      type: "unknown",
      extension: "",
      filename: "attachment",
      Icon: File,
    };
  }
};

// ============================================================================
// 🧩 2. MICRO-COMPONENTS: ISOLATED UI BLOCKS
// ============================================================================

// 🟢 STATUS INDICATOR (The WhatsApp/Slack Logic Engine)
const MessageStatus = ({
  status,
  isReadRealtime,
  isChannel,
  isTargetOnline,
}: {
  status?: string;
  isReadRealtime: boolean;
  isChannel: boolean;
  isTargetOnline: boolean;
}) => {
  // Slack Architecture: No ticks in channels, only pending state if network is slow
  if (isChannel) {
    if (status === "pending")
      return (
        <Clock className="h-3 w-3 text-muted-foreground animate-pulse ml-2" />
      );
    return null;
  }

  // WhatsApp Architecture: DMs need exact tick status
  const safeStatus = status || "delivered"; // Historical messages from DB are delivered

  // Backfill logic: If RAM says "sent" but we know target is online, effectively consider it "delivered"
  const effectivelyDelivered =
    safeStatus === "delivered" || (safeStatus === "sent" && isTargetOnline);

  return (
    <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center ml-2 select-none">
      {safeStatus === "pending" && <Clock className="h-3 w-3 animate-pulse" />}
      {safeStatus === "sent" && !effectivelyDelivered && !isReadRealtime && (
        <Check className="h-3 w-3" />
      )}
      {effectivelyDelivered && !isReadRealtime && (
        <CheckCheck className="h-3.5 w-3.5" />
      )}
      {isReadRealtime && <CheckCheck className="h-3.5 w-3.5 text-blue-500" />}
    </span>
  );
};

// 🟢 ATTACHMENT RENDERER
const AttachmentPreview = ({
  msg,
  fileType,
  filename,
  FileIcon,
}: {
  msg: Message;
  fileType: string;
  filename: string;
  FileIcon: any;
}) => {
  if (!msg.attachmentUrl) return null;

  if (fileType === "image") {
    return (
      <div className="mt-1.5 overflow-hidden rounded-lg border border-border max-w-sm bg-muted/20 hover:opacity-95 transition-opacity cursor-pointer">
        <img
          src={msg.attachmentUrl}
          alt="attachment"
          className="w-full h-auto max-h-64 object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (fileType === "video") {
    return (
      <div className="mt-1.5 overflow-hidden rounded-lg border border-border max-w-sm bg-black">
        <video
          src={msg.attachmentUrl}
          controls
          className="w-full max-h-64 object-cover"
        />
      </div>
    );
  }

  return (
    <a
      href={msg.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg mt-1.5 border border-border bg-card hover:bg-muted/60 max-w-sm transition-all duration-150 group/file"
    >
      <div className="p-2.5 rounded-md bg-primary/10 text-primary group-hover/file:bg-primary/20 transition-colors">
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs font-medium truncate text-foreground leading-tight">
          {filename}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
          {fileType}
        </span>
      </div>
      <Download className="h-4 w-4 text-muted-foreground shrink-0 mr-1 group-hover/file:text-foreground transition-colors" />
    </a>
  );
};

// ============================================================================
// 🚀 3. THE MAIN ORCHESTRATOR COMPONENT
// ============================================================================
interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  isReadRealtime: boolean;
  hideHeader?: boolean;
}

export default function MessageBubble({
  msg,
  isMe,
  isReadRealtime,
  hideHeader = false,
}: MessageBubbleProps) {
  const { socket } = useSocket();
  const {
    activeChannelId,
    activeRoomId,
    selectedUser,
    deleteMessage,
    onlineUsers,
  } = useChatStore();

  const isChannelView = !!activeChannelId;
  const isTargetOnline = selectedUser
    ? onlineUsers.includes(selectedUser.id)
    : false;

  // Derive file info
  const {
    type: fileType,
    filename,
    Icon: FileIcon,
  } = msg.attachmentUrl
    ? getFileDetails(msg.attachmentUrl)
    : { type: "none", filename: "", Icon: File };

  // Derive sender info
  const senderName = msg.sender?.name || (isMe ? "You" : "User");
  const initials = senderName.substring(0, 2).toUpperCase();
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Handle Deletion
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

  return (
    <div
      className={`relative group flex gap-3 px-6 py-1 hover:bg-muted/40 transition-colors duration-150 ${!hideHeader ? "mt-3" : ""}`}
    >
      {/* 🔴 SLACK-STYLE FLOATING ACTION DOCK (Visible on hover) */}
      {isMe && (
        <div className="absolute right-6 -top-3.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20 pointer-events-none group-hover:pointer-events-auto">
          <div className="flex items-center border border-border bg-popover text-popover-foreground rounded-md shadow-md overflow-hidden p-0.5 h-8">
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
              title="Delete Message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 🖼️ LEFT COLUMN: Avatar OR Micro-Timestamp */}
      <div className="w-9 shrink-0 flex items-start justify-center select-none">
        {!hideHeader ? (
          <Avatar className="h-9 w-9 border border-border rounded shadow-sm mt-0.5">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`}
            />
            <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold rounded">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[9px] text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-100 mt-1.5 cursor-default">
            {timeString.split(" ")[0]}
          </span>
        )}
      </div>

      {/* 📝 RIGHT COLUMN: Metadata & Content */}
      <div className="flex flex-col min-w-0 flex-1">
        {/* Header: Name, Time, and Status Ticks */}
        {!hideHeader && (
          <div className="flex items-baseline gap-2 mb-0.5 select-none">
            <span className="font-semibold text-sm text-foreground hover:underline cursor-pointer">
              {senderName}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
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

        {/* The Actual Text */}
        {msg.text && msg.text.trim() !== "" && (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
            {msg.text}
          </p>
        )}

        {/* The Media / Attachment */}
        <AttachmentPreview
          msg={msg}
          fileType={fileType}
          filename={filename}
          FileIcon={FileIcon}
        />
      </div>
    </div>
  );
}
