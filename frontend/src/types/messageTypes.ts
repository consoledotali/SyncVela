export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface Attachment {
  id?: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  status?: MessageStatus;
  tempId?: string;
  attachmentUrl?: string | null;
  attachments?: Attachment[];
  sender?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    isDeleted?: boolean;
  };
  parentMessageId?: string | null;
  _count?: { replies: number };
  reactions?: MessageReaction[];
}

export interface PendingMessage {
  roomId: string;
  targetUserId?: string;
  message: Message;
}

export interface LightboxItem {
  url: string;
  fileName?: string;
  mimeType?: string;
}

