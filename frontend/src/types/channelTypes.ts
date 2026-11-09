export type ChannelType = "PUBLIC" | "PRIVATE";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  workspaceId: string;
  ownerId: string;
  lastMessageAt?: string;
}

export type ChannelWithUnread = Channel & {
  unreadCount?: number;
};

