export type SocketAcknowledgementCallback = (result: {
  error?: string;
  ok?: true;
}) => void;

export interface SocketAttachmentPayload {
  url: string;
  fileKey?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

export interface ChannelMessagePayload {
  channelId: string;
  text?: string;
  content?: string;
  attachments?: SocketAttachmentPayload[];
  tempId?: string;
  parentMessageId?: string;
}

export interface DirectMessagePayload {
  roomId?: string;
  targetUserId: string;
  workspaceId?: string;
  text?: string;
  content?: string;
  attachments?: SocketAttachmentPayload[];
  tempId?: string;
  parentMessageId?: string;
}

export interface RoomIdPayload {
  roomId: string;
}

export interface ChannelIdPayload {
  channelId: string;
}

export interface DeliveryReceiptPayload {
  messageId: string;
  tempId?: string;
}

export interface ReactionPayload {
  messageId: string;
  emoji: string;
}

export interface EditMessagePayload {
  messageId: string;
  newText: string;
}

export interface DeleteMessagePayload {
  messageId: string;
}

