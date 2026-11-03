import {
  deliveryReceiptPayloadSchema,
  reactionPayloadSchema,
  roomIdPayloadSchema,
} from "@/src/features/chat/protocol/validation/socketSchemas";

export function createReactionPayload(messageId: string, emoji: string) {
  const result = reactionPayloadSchema.safeParse({ messageId, emoji });
  return result.success ? result.data : null;
}

export function createRoomReceiptPayload(roomId: string | null | undefined) {
  const result = roomIdPayloadSchema.safeParse({ roomId });
  return result.success ? result.data : null;
}

export function createDeliveryReceiptPayload(
  messageId: string,
  tempId?: string,
) {
  const result = deliveryReceiptPayloadSchema.safeParse({ messageId, tempId });
  return result.success ? result.data : null;
}
