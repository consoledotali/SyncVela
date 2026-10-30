CREATE TYPE "IssueType" AS ENUM ('TASK', 'BUG', 'STORY', 'EPIC');
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "IssueStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'UPDATED', 'MOVED', 'COMMENTED', 'ASSIGNED', 'LABEL_ADDED', 'LABEL_REMOVED');

CREATE TABLE "projects" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "key" TEXT NOT NULL, "description" TEXT,
  "issueCounter" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "workspaceId" TEXT NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "boards" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "projectId" TEXT NOT NULL,
  CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "board_columns" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "position" DECIMAL(20,10) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "boardId" TEXT NOT NULL, CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "issue_labels" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "workspaceId" TEXT NOT NULL,
  CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "issues" (
  "id" TEXT NOT NULL, "issueNumber" INTEGER NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "type" "IssueType" NOT NULL DEFAULT 'TASK', "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "IssueStatus" NOT NULL DEFAULT 'BACKLOG', "position" DECIMAL(20,10) NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "projectId" TEXT NOT NULL, "boardColumnId" TEXT,
  "reporterId" TEXT NOT NULL, "assigneeId" TEXT, CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "issue_label_assignments" (
  "issueId" TEXT NOT NULL, "labelId" TEXT NOT NULL,
  CONSTRAINT "issue_label_assignments_pkey" PRIMARY KEY ("issueId", "labelId")
);
CREATE TABLE "issue_comments" (
  "id" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "issueId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "issue_activities" (
  "id" TEXT NOT NULL, "type" "ActivityType" NOT NULL, "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "issueId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_workspaceId_key_key" ON "projects"("workspaceId", "key");
CREATE INDEX "projects_workspaceId_idx" ON "projects"("workspaceId");
CREATE INDEX "boards_projectId_idx" ON "boards"("projectId");
CREATE UNIQUE INDEX "board_columns_boardId_position_key" ON "board_columns"("boardId", "position");
CREATE INDEX "board_columns_boardId_position_idx" ON "board_columns"("boardId", "position");
CREATE UNIQUE INDEX "issue_labels_workspaceId_name_key" ON "issue_labels"("workspaceId", "name");
CREATE UNIQUE INDEX "issues_projectId_issueNumber_key" ON "issues"("projectId", "issueNumber");
CREATE INDEX "issues_projectId_status_idx" ON "issues"("projectId", "status");
CREATE INDEX "issues_boardColumnId_position_idx" ON "issues"("boardColumnId", "position");
CREATE INDEX "issues_assigneeId_idx" ON "issues"("assigneeId");
CREATE INDEX "issue_label_assignments_labelId_idx" ON "issue_label_assignments"("labelId");
CREATE INDEX "issue_comments_issueId_createdAt_idx" ON "issue_comments"("issueId", "createdAt");
CREATE INDEX "issue_activities_issueId_createdAt_idx" ON "issue_activities"("issueId", "createdAt");

ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "boards" ADD CONSTRAINT "boards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_boardColumnId_fkey" FOREIGN KEY ("boardColumnId") REFERENCES "board_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issue_label_assignments" ADD CONSTRAINT "issue_label_assignments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_label_assignments" ADD CONSTRAINT "issue_label_assignments_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "issue_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
