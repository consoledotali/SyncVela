import React, { useState } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { usePermissions } from "@/src/hooks/usePermissions";
import { MessageSquare } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { AttachmentRenderer } from "./AttachmentRenderer";
import { getFileDetails } from "@/src/utils/attachmentUtils";
import { MessageStatus } from "./MessageStatus";
import { MessageActions } from "./MessageActions";
import { Lightbox, LightboxItem } from "./Lightbox";
import { createReactionPayload } from "@/src/utils/socket/socketPayloads";
import { resolveAvatarUrl } from "@/src/utils/avatarUtils";
import type {
  Attachment,
  Message,
  SidebarUser,
} from "@/src/types/chat";

type MessageBubbleProps = {
  msg: Message;
  isMe: boolean;
  isReadRealtime?: boolean;
  hideHeader?: boolean;
  isInsideThreadPanel?: boolean;
};

type ReactionSummary = { emoji: string; userIds: string[] };

export default function MessageBubble({
  msg,
  isMe,
  isReadRealtime = false,
  hideHeader = false,
  isInsideThreadPanel = false,
}: MessageBubbleProps) {
  const { socket } = useSocket();
  const { user } = useAuthStore();
  const {
    activeChannelId,
    activeWorkspaceId,
    activeRoomId,
    selectedUser,
    setSelectedUser,
    deleteMessage,
    editMessage,
    onlineUsers,
    users,
    openThread,
    highlightedMessageId,
    targetLastReadAt,
    updateMessageReactions,
  } = useChatStore();

  const { hasPermission } = usePermissions();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || "");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isChannelView = !!activeChannelId;
  const isTargetOnline = selectedUser
    ? onlineUsers.includes(selectedUser.id)
    : false;

  const canModerate = hasPermission("MANAGE_MESSAGES");
  const canDelete = isMe || (isChannelView && canModerate);
  const canEdit = isMe;

  const isDeletedSender = !isMe && (msg.sender?.isDeleted === true || !msg.sender);
  const senderName = msg.sender?.isDeleted ? "Deleted User" : (msg.sender?.name || (isMe ? "You" : "Deleted User"));

  const initials = senderName.substring(0, 2).toUpperCase();
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const sender = msg.sender;
  const isFormerMember =
    !isMe && Boolean(sender && !sender.isDeleted && !users.some((user) => user.id === sender.id));

  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  const replyCount = msg._count?.replies || 0;
  const reactionSummaries = Object.values(
    (msg.reactions || []).reduce<Record<string, ReactionSummary>>((groups, reaction) => {
      const summary = groups[reaction.emoji] || {
        emoji: reaction.emoji,
        userIds: [],
      };
      summary.userIds.push(reaction.userId);
      groups[reaction.emoji] = summary;
      return groups;
    }, {}),
  );

  const mediaFiles = attachments.filter((att: Attachment) => {
    if (!att || !att.url) return false;
    const type = getFileDetails(att.url, att.mimeType, att.fileName).type;
    return type === "image" || type === "video";
  });

  const docFiles = attachments.filter((att: Attachment) => {
    if (!att || !att.url) return false;
    const type = getFileDetails(att.url, att.mimeType, att.fileName).type;
    return type !== "image" && type !== "video";
  });

  const isPreviewable = (att: Attachment) => {
    const type = getFileDetails(att.url, att.mimeType, att.fileName).type;
    if (type === "image" || type === "video") return true;
    return type === "pdf";
  };

  const previewables: LightboxItem[] = attachments
    .filter((att: Attachment) => Boolean(att?.url) && isPreviewable(att))
    .map((att: Attachment) => ({
      url: att.url,
      fileName: att.fileName,
      mimeType: att.mimeType,
    }));

  const previewIndexOf = (att: Attachment) =>
    previewables.findIndex((p) => p.url === att.url);

  const handleDelete = () => {
    if (!socket || !canDelete) return;
    deleteMessage(msg.id);
    socket.emit("delete_message", {
      messageId: msg.id,
      roomId: activeChannelId || activeRoomId,
      isChannel: isChannelView,
      targetUserId: selectedUser?.id,
    });
  };

  const handleEditSubmit = () => {
    if (
      !socket ||
      !canEdit ||
      editText.trim() === "" ||
      editText === msg.text
    ) {
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

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMe || isFormerMember || isDeletedSender || !sender) return;

    const targetSidebarUser = users.find((user) => user.id === sender.id);
    const targetUserPayload: SidebarUser = targetSidebarUser || {
      id: sender.id,
      name: sender.name,
      email: "",
      avatarUrl: sender.avatarUrl,
    };

    setSelectedUser(targetUserPayload);

    if (socket) {
      socket.emit("joinPrivateChat", {
        targetUserId: sender.id,
        workspaceId: activeWorkspaceId || undefined,
      });
    }
  };

  const handleReactionToggle = (emoji: string) => {
    if (!socket) return;
    const payload = createReactionPayload(msg.id, emoji);
    if (!payload) return;
    socket.emit(
      "toggle_reaction",
      payload,
      (result: {
        ok?: true;
        reactions?: Array<{ emoji: string; userId: string }>;
      }) => {
        if (result?.ok && result.reactions) {
          updateMessageReactions(msg.id, result.reactions);
        }
      },
    );
  };

  const isThreadReplyRead = React.useMemo(() => {
    if (!isMe || !isInsideThreadPanel || !targetLastReadAt) return false;
    const msgTime = new Date(msg.createdAt).getTime();
    const readTime = new Date(targetLastReadAt).getTime();
    return msgTime <= readTime + 2000;
  }, [isMe, isInsideThreadPanel, targetLastReadAt, msg.createdAt]);

  const isCurrentlyHighlighted = highlightedMessageId === msg.id;

  return (
    <div
      className={`relative group flex gap-3 pr-6 pl-4 transition-all duration-500 border-l-[3px] ${
        isCurrentlyHighlighted
          ? "bg-primary/5 border-primary font-medium shadow-xs"
          : "border-transparent hover:bg-muted/40 hover:border-primary/40"
      } ${!hideHeader ? "mt-4 pt-1 pb-1" : "mt-[2px] pt-[2px] pb-[2px]"}`}
    >
      <MessageActions
        canEdit={canEdit}
        canDelete={canDelete}
        isEditing={isEditing}
        hasText={!!msg.text}
        onEdit={() => setIsEditing(true)}
        onDelete={handleDelete}
        onReply={!isInsideThreadPanel ? () => openThread(msg) : undefined}
        onReactionSelect={handleReactionToggle}
      />

      <div className="w-[42px] shrink-0 flex flex-col items-center select-none relative">
        {!hideHeader ? (
          <Avatar
            onClick={handleUserClick}
            className={`h-[40px] w-[40px] !rounded-md border border-border shadow-sm ${
              isFormerMember
                ? "opacity-50 grayscale"
                : "cursor-pointer hover:opacity-80 transition-opacity"
            }`}
          >
            <AvatarImage
              src={
                resolveAvatarUrl(msg.sender?.avatarUrl)
                  ? resolveAvatarUrl(msg.sender?.avatarUrl)
                  : `https://api.dicebear.com/7.x/initials/svg?seed=${senderName}`
              }
              className="object-cover w-full h-full !rounded-md"
            />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold !rounded-md">
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
          <div className="flex items-center gap-2 select-none mb-0.5 flex-wrap">
            <span
              onClick={handleUserClick}
              className={`font-bold text-[15px] ${
                isFormerMember
                  ? "text-muted-foreground line-through"
                  : "text-foreground hover:underline cursor-pointer"
              }`}
            >
              {senderName}
            </span>

            {isDeletedSender ? (
              <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider rounded-sm">
                Deleted User
              </span>
            ) : isFormerMember ? (
              <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[9px] font-bold uppercase tracking-wider rounded-sm">
                Deactivated
              </span>
            ) : null}

            <span className="text-xs text-muted-foreground font-medium ml-1">
              {timeString}
            </span>
            {isMe && (
              <MessageStatus
                status={msg.status ?? "sent"}
                isReadRealtime={
                  isInsideThreadPanel ? isThreadReplyRead : isReadRealtime
                }
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
            <p
              className={`text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words ${isFormerMember ? "text-muted-foreground/80 italic" : "text-foreground/95"}`}
            >
              {msg.text}
            </p>
          )
        )}

        {mediaFiles.length > 0 && (
          <div
            className={`mt-1.5 grid gap-1.5 ${mediaFiles.length === 1 ? "grid-cols-1 max-w-[360px]" : "grid-cols-2 max-w-[420px]"}`}
          >
            {mediaFiles.map((att: Attachment, index: number) => (
              <AttachmentRenderer
                key={att.id || index}
                attachment={att}
                isMulti={mediaFiles.length > 1}
                onOpen={() => setLightboxIndex(previewIndexOf(att))}
              />
            ))}
          </div>
        )}

        {docFiles.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {docFiles.map((att: Attachment, index: number) => (
              <AttachmentRenderer
                key={att.id || index}
                attachment={att}
                isMulti={false}
                onOpen={
                  isPreviewable(att)
                    ? () => setLightboxIndex(previewIndexOf(att))
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {reactionSummaries.length > 0 && (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Message reactions"
          >
            {reactionSummaries.map(({ emoji, userIds }) => {
              const reactedByCurrentUser = userIds.includes(user?.id || "");
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReactionToggle(emoji)}
                  aria-pressed={reactedByCurrentUser}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    reactedByCurrentUser
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {lightboxIndex !== null && previewables.length > 0 && (
          <Lightbox
            items={previewables}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        {!isInsideThreadPanel && replyCount > 0 && (
          <button
            onClick={() => openThread(msg)}
            className="mt-2 flex items-center gap-2 text-xs font-bold text-primary hover:bg-primary/5 border border-primary/20 rounded-md py-1.5 px-3 w-max select-none transition-all group/thread shadow-sm animate-in zoom-in-95 duration-150"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/thread:scale-110" />
            <span>
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

