-- Durable per-channel owner and per-member visibility controls.
ALTER TABLE "channels" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "channel_members" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- Every existing channel has a creator membership. Use its first member as
-- the deterministic historical owner before making the ownership relation required.
UPDATE "channels" AS channel
SET "ownerId" = membership."userId"
FROM LATERAL (
  SELECT "userId"
  FROM "channel_members"
  WHERE "channelId" = channel.id
  ORDER BY "createdAt" ASC, id ASC
  LIMIT 1
) AS membership
WHERE channel."ownerId" IS NULL;

-- Defensive fallback for malformed legacy data without a channel-member row.
UPDATE "channels" AS channel
SET "ownerId" = workspace_owner."userId"
FROM LATERAL (
  SELECT "userId"
  FROM "workspace_members"
  WHERE "workspaceId" = channel."workspaceId" AND role = 'OWNER'
  ORDER BY "createdAt" ASC, id ASC
  LIMIT 1
) AS workspace_owner
WHERE channel."ownerId" IS NULL;

ALTER TABLE "channels" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "channels"
  ADD CONSTRAINT "channels_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "channels_ownerId_idx" ON "channels"("ownerId");
CREATE INDEX "channel_members_channelId_isHidden_idx" ON "channel_members"("channelId", "isHidden");
