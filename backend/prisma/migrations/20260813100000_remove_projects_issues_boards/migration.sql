BEGIN;

DROP TABLE "issue_activities";
DROP TABLE "issue_comments";
DROP TABLE "issue_label_assignments";
DROP TABLE "issues";
DROP TABLE "board_columns";
DROP TABLE "boards";
DROP TABLE "issue_labels";
DROP TABLE "projects";

DROP TYPE "ActivityType";
DROP TYPE "IssueStatus";
DROP TYPE "IssuePriority";
DROP TYPE "IssueType";

COMMIT;
