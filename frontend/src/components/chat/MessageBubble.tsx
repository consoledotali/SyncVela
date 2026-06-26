import React from "react";
import { Message } from "@/src/store/chatStore";
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
} from "lucide-react";

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  isReadRealtime: boolean;
  hideHeader?: boolean; // 🛡️ THE FIX: Grouping identifier
}

const getFileDetails = (url: string) => {
  try {
    const cleanUrl = url.split("?")[0];
    const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";
    const filename = decodeURIComponent(
      cleanUrl.split("/").pop() || "attachment",
    );
    let type = "unknown";
    let Icon = File;
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)) {
      type = "image";
      Icon = ImageIcon;
    } else if (["mp4", "webm", "mov"].includes(extension)) {
      type = "video";
      Icon = Video;
    } else if (["mp3", "wav", "ogg"].includes(extension)) {
      type = "audio";
      Icon = Music;
    } else if (["pdf", "doc", "docx", "txt"].includes(extension)) {
      type = "document";
      Icon = FileText;
    } else if (["csv", "xls", "xlsx"].includes(extension)) {
      type = "spreadsheet";
      Icon = FileSpreadsheet;
    } else if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
      type = "archive";
      Icon = FileArchive;
    }
    return { type, extension, filename, Icon };
  } catch {
    return {
      type: "unknown",
      extension: "",
      filename: "attachment",
      Icon: File,
    };
  }
};

export default function MessageBubble({
  msg,
  isMe,
  isReadRealtime,
  hideHeader = false,
}: MessageBubbleProps) {
  const {
    type: fileType,
    filename,
    Icon: FileIcon,
  } = msg.attachmentUrl
    ? getFileDetails(msg.attachmentUrl)
    : { type: "none", filename: "", Icon: File };

  const senderName = msg.sender?.name || (isMe ? "You" : "User");
  const initials = senderName.substring(0, 2).toUpperCase();
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex gap-3 px-4 py-1 hover:bg-muted/50 transition-colors group ${!hideHeader ? "mt-4" : ""}`}
    >
      {/* 🖼️ LEFT COLUMN: Avatar OR Hover Timestamp */}
      <div className="w-10 shrink-0 flex items-start justify-center">
        {!hideHeader ? (
          <Avatar className="h-10 w-10 border border-border rounded-md mt-0.5">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`}
            />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 cursor-default select-none">
            {timeString}
          </span>
        )}
      </div>

      {/* 📝 RIGHT COLUMN: Name + Message Content */}
      <div className="flex flex-col min-w-0 flex-1">
        {!hideHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-bold text-[15px] text-foreground">
              {senderName}
            </span>
            <span className="text-xs text-muted-foreground">{timeString}</span>
            {isMe && (
              <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center ml-1">
                {msg.status === "pending" && <Clock className="h-3 w-3" />}
                {msg.status === "sent" && !isReadRealtime && (
                  <Check className="h-3 w-3" />
                )}
                {(msg.status === "delivered" || isReadRealtime) && (
                  <CheckCheck
                    className={`h-3 w-3 ${isReadRealtime ? "text-primary" : ""}`}
                  />
                )}
              </span>
            )}
          </div>
        )}

        {/* Text Content */}
        {msg.text && (
          <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
            {msg.text}
          </p>
        )}

        {/* Attachments */}
        {(fileType === "image" || fileType === "video") &&
          msg.attachmentUrl && (
            <div className="mt-2 overflow-hidden rounded-lg border border-border max-w-sm">
              {fileType === "image" ? (
                <img
                  src={msg.attachmentUrl}
                  alt="attachment"
                  className="w-full h-auto max-h-72 object-cover"
                  loading="lazy"
                />
              ) : (
                <video
                  src={msg.attachmentUrl}
                  controls
                  className="w-full max-h-72 object-cover"
                />
              )}
            </div>
          )}

        {fileType !== "none" &&
          fileType !== "image" &&
          fileType !== "video" &&
          msg.attachmentUrl && (
            <a
              href={msg.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl mt-2 border border-border bg-background hover:bg-muted/50 max-w-sm transition-all"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileIcon className="h-6 w-6" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate leading-tight">
                  {filename}
                </span>
                <span className="text-xs uppercase text-muted-foreground mt-0.5">
                  {fileType} Document
                </span>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          )}
      </div>
    </div>
  );
}
