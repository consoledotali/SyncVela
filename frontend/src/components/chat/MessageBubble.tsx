import React from "react";
import { Message } from "@/src/store/chatStore";
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
  Download 
} from "lucide-react";

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  isReadRealtime: boolean;
}

// 🛡️ ENTERPRISE FILE PARSER: URL se extension aur name nikalne ka solid tareeqa
const getFileDetails = (url: string) => {
  try {
    // Query parameters hatao
    const cleanUrl = url.split("?")[0];
    const extension = cleanUrl.split(".").pop()?.toLowerCase() || "";
    // URL decode kar ke filename nikalo (e.g. "my%20file.pdf" -> "my file.pdf")
    const filename = decodeURIComponent(cleanUrl.split("/").pop() || "attachment");

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
    return { type: "unknown", extension: "", filename: "attachment", Icon: File };
  }
};

export default function MessageBubble({ msg, isMe, isReadRealtime }: MessageBubbleProps) {
  // 🛡️ STATUS ICON ENGINE (SVG Base, no cheap unicode)
  let StatusIcon = null;
  let statusColor = isMe ? "text-primary-foreground/70" : "text-muted-foreground";

  if (isMe) {
    if (msg.status === "pending") {
      StatusIcon = <Clock className="h-3 w-3" />;
    } else if (msg.status === "sent" && !isReadRealtime) {
      StatusIcon = <Check className="h-3 w-3" />;
    } else if (msg.status === "delivered" && !isReadRealtime) {
      StatusIcon = <CheckCheck className="h-3 w-3" />;
    } else if (msg.status === "read" || isReadRealtime) {
      // Read state prominently visible (Dark blue/black contrast or solid white depending on theme)
      StatusIcon = <CheckCheck className="h-3 w-3" />;
      statusColor = isMe ? "text-white" : "text-primary";
    } else {
      StatusIcon = <Check className="h-3 w-3" />;
    }
  }

  const { type: fileType, filename, Icon: FileIcon } = msg.attachmentUrl 
    ? getFileDetails(msg.attachmentUrl) 
    : { type: "none", filename: "", Icon: File };

  return (
    <div
      className={`p-3 rounded-2xl max-w-[85%] sm:max-w-[75%] flex flex-col shadow-sm relative group ${
        isMe
          ? "bg-primary text-primary-foreground self-end rounded-br-sm"
          : "bg-muted text-foreground self-start rounded-bl-sm border border-border/50"
      } ${msg.status === "pending" ? "opacity-70" : "opacity-100"}`}
    >
      {/* 🖼️ IMAGE & VIDEO RENDERER */}
      {(fileType === "image" || fileType === "video") && msg.attachmentUrl && (
        <div className="mb-2 overflow-hidden rounded-lg border border-black/10 bg-black/5">
          {fileType === "image" ? (
            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={msg.attachmentUrl}
                alt="attachment"
                className="w-full max-h-72 object-cover hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          ) : (
            <video 
              src={msg.attachmentUrl} 
              controls 
              className="w-full max-h-72 object-cover"
              preload="metadata"
            />
          )}
        </div>
      )}

      {/* 📄 UNIVERSAL FILE RENDERER (Documents, Archives, Spreadsheets, etc.) */}
      {fileType !== "none" && fileType !== "image" && fileType !== "video" && msg.attachmentUrl && (
        <a
          href={msg.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-3 rounded-xl mb-2 border transition-all ${
            isMe
              ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
              : "bg-background border-border hover:bg-muted/50"
          }`}
        >
          <div className={`p-2 rounded-lg ${isMe ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
            <FileIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold truncate leading-tight">
              {filename}
            </span>
            <span className={`text-xs uppercase mt-0.5 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {fileType} Document
            </span>
          </div>
          <Download className={`h-4 w-4 shrink-0 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
        </a>
      )}

      {/* 📝 TEXT RENDERER */}
      {msg.text && (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {msg.text}
        </p>
      )}

      {/* 🕒 METADATA FOOTER (Time & Status) */}
      <div
        className={`flex items-center gap-1.5 justify-end mt-1.5 text-[11px] font-medium select-none ${statusColor}`}
      >
        <span>
          {new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {StatusIcon}
      </div>
    </div>
  );
}