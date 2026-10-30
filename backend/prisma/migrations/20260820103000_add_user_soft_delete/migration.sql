-- Preserve historical chat identity while preventing deleted accounts from appearing as active users.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_isDeleted_idx" ON "users"("isDeleted");
