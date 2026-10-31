import { z } from "zod";

export const channelOwnershipTransferSchema = z.object({
  newOwnerId: z.string().cuid(),
});

export const channelMemberVisibilitySchema = z.object({
  userId: z.string().cuid(),
  visible: z.boolean(),
});
