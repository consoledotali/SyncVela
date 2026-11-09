import { z } from "zod";

export const socketIdentifierSchema = z.string().trim().min(1).max(191);
const optionalTrimmedTextSchema = z.string().trim().max(20_000).optional();

export const attachmentSchema = z.object({
  url: z.string().max(4096).default(""),
  fileKey: z.string().min(1).max(1024).optional(),
  fileName: z.string().min(1).max(255).optional(),
  mimeType: z.string().min(1).max(255).optional(),
  size: z.number().int().min(0).max(100 * 1024 * 1024).optional(),
});

const messageBasePayloadSchema = z
  .object({
    text: optionalTrimmedTextSchema,
    content: optionalTrimmedTextSchema,
    attachments: z.array(attachmentSchema).max(50).optional(),
    tempId: z.string().trim().min(1).max(128).optional(),
    parentMessageId: socketIdentifierSchema.optional(),
  })
  .superRefine((payload, context) => {
    const text = payload.text || payload.content;
    if (!text && (!payload.attachments || payload.attachments.length === 0)) {
      context.addIssue({
        code: "custom",
        message: "A message needs text or at least one attachment.",
        path: ["text"],
      });
    }

    const totalAttachmentBytes = (payload.attachments || []).reduce(
      (total, attachment) => total + (attachment.size || 0),
      0,
    );
    if (totalAttachmentBytes > 100 * 1024 * 1024) {
      context.addIssue({
        code: "custom",
        message: "The combined attachments exceed the 100 MB message limit.",
        path: ["attachments"],
      });
    }
  });

export const channelMessagePayloadSchema = messageBasePayloadSchema.extend({
  channelId: socketIdentifierSchema,
});

export const directMessagePayloadSchema = messageBasePayloadSchema.extend({
  recipientId: socketIdentifierSchema,
});

export const reactionPayloadSchema = z.object({
  messageId: socketIdentifierSchema,
  emoji: z.string().trim().min(1).max(32),
});

export const roomIdPayloadSchema = z.object({
  roomId: socketIdentifierSchema,
});

export const channelIdPayloadSchema = z.object({
  channelId: socketIdentifierSchema,
});

export const deliveryReceiptPayloadSchema = z.object({
  messageId: socketIdentifierSchema,
  tempId: z.string().trim().min(1).max(128).optional(),
});

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

