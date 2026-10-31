import { z } from "zod";

export const workspaceOwnershipTransferSchema = z.object({
  newOwnerId: z.string().trim().min(1, "A valid workspace member is required."),
});
