-- AlterTable: change INT4 columns to BIGINT for GitHub IDs
-- GitHub IDs exceed 32-bit integer range (max 2,147,483,647)

ALTER TABLE "repositories" ALTER COLUMN "github_id" TYPE BIGINT;
ALTER TABLE "repositories" ALTER COLUMN "installation_id" TYPE BIGINT;

ALTER TABLE "pull_requests" ALTER COLUMN "github_pr_id" TYPE BIGINT;

ALTER TABLE "reviews" ALTER COLUMN "github_review_id" TYPE BIGINT;

ALTER TABLE "review_comments" ALTER COLUMN "github_comment_id" TYPE BIGINT;
