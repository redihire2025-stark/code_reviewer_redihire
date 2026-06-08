-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "installation_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "github_pr_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "head_sha" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL,
    "head_branch" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "html_url" TEXT NOT NULL,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "repository_id" TEXT NOT NULL,

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "head_sha" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overall_score" DOUBLE PRECISION,
    "files_reviewed" INTEGER NOT NULL DEFAULT 0,
    "total_comments" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "high_count" INTEGER NOT NULL DEFAULT 0,
    "medium_count" INTEGER NOT NULL DEFAULT 0,
    "low_count" INTEGER NOT NULL DEFAULT 0,
    "summary_body" TEXT,
    "github_review_id" INTEGER,
    "error_message" TEXT,
    "processing_ms" INTEGER,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "pull_request_id" TEXT NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "line" INTEGER,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "why_it_matters" TEXT NOT NULL,
    "suggested_fix" TEXT NOT NULL,
    "improved_code" TEXT,
    "learning_insight" TEXT NOT NULL,
    "github_comment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_id" TEXT NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_metrics" (
    "id" TEXT NOT NULL,
    "bugs_found" INTEGER NOT NULL DEFAULT 0,
    "ts_issues" INTEGER NOT NULL DEFAULT 0,
    "react_issues" INTEGER NOT NULL DEFAULT 0,
    "perf_issues" INTEGER NOT NULL DEFAULT 0,
    "security_issues" INTEGER NOT NULL DEFAULT 0,
    "arch_issues" INTEGER NOT NULL DEFAULT 0,
    "quality_issues" INTEGER NOT NULL DEFAULT 0,
    "testing_issues" INTEGER NOT NULL DEFAULT 0,
    "strengths" TEXT[],
    "improvements" TEXT[],
    "learning_recs" TEXT[],
    "review_id" TEXT NOT NULL,

    CONSTRAINT "review_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_rules" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "file_sha" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "repository_id" TEXT NOT NULL,

    CONSTRAINT "coding_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_id_key" ON "repositories"("github_id");
CREATE UNIQUE INDEX "repositories_full_name_key" ON "repositories"("full_name");
CREATE INDEX "repositories_installation_id_idx" ON "repositories"("installation_id");

-- CreateIndex
CREATE INDEX "pull_requests_author_idx" ON "pull_requests"("author");
CREATE INDEX "pull_requests_head_sha_idx" ON "pull_requests"("head_sha");
CREATE UNIQUE INDEX "pull_requests_repository_id_number_key" ON "pull_requests"("repository_id", "number");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");
CREATE UNIQUE INDEX "reviews_pull_request_id_head_sha_key" ON "reviews"("pull_request_id", "head_sha");

-- CreateIndex
CREATE INDEX "review_comments_severity_idx" ON "review_comments"("severity");
CREATE INDEX "review_comments_category_idx" ON "review_comments"("category");
CREATE INDEX "review_comments_file_path_idx" ON "review_comments"("file_path");

-- CreateIndex
CREATE UNIQUE INDEX "review_metrics_review_id_key" ON "review_metrics"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "coding_rules_repository_id_key" ON "coding_rules"("repository_id");

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_metrics" ADD CONSTRAINT "review_metrics_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_rules" ADD CONSTRAINT "coding_rules_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
