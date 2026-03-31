CREATE TYPE "public"."blog_source" AS ENUM('ai_generated', 'manual', 'refresh');--> statement-breakpoint
CREATE TYPE "public"."blog_topic_status" AS ENUM('pending', 'generating', 'generated', 'published', 'rejected', 'stale');--> statement-breakpoint
CREATE TYPE "public"."bulk_email_status" AS ENUM('draft', 'sending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fund_release_status" AS ENUM('held', 'approved', 'processing', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."info_request_status" AS ENUM('pending', 'responded', 'expired', 'closed');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('pending', 'evidence_submitted', 'approved', 'rejected', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('donation_refunded', 'donation_refund_reversed', 'campaign_completed', 'campaign_archived', 'campaign_status_changed', 'role_changed', 'account_deleted', 'new_message', 'message_flagged', 'campaign_donation_received', 'campaign_milestone', 'campaign_message_received', 'withdrawal_processed', 'campaign_submitted', 'campaign_paused', 'campaign_resumed', 'campaign_suspended', 'campaign_cancelled', 'info_request', 'info_request_reminder', 'milestone_approved', 'milestone_rejected', 'fund_released', 'verification_approved', 'verification_rejected', 'bulk_refund_processed');--> statement-breakpoint
CREATE TYPE "public"."refund_batch_status" AS ENUM('processing', 'completed', 'partial_failure');--> statement-breakpoint
CREATE TYPE "public"."refund_record_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."support_channel" AS ENUM('site_chat', 'whatsapp', 'email', 'phone', 'social_media');--> statement-breakpoint
CREATE TYPE "public"."support_conversation_status" AS ENUM('open', 'assigned', 'pending_user', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."support_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'submitted_for_review', 'documents_uploaded', 'identity_verified', 'fully_verified', 'info_requested', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('requested', 'approved', 'completed', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'emergency';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'charity';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'education';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'animal';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'environment';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'business';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'competition';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'creative';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'event';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'faith';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'family';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'sports';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'travel';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'volunteer';--> statement-breakpoint
ALTER TYPE "public"."campaign_category" ADD VALUE 'wishes';--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'paused';--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'under_review';--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'suspended';--> statement-breakpoint
ALTER TYPE "public"."campaign_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model" text NOT NULL,
	"prompt_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_generation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"post_id" uuid,
	"step" text NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_topic_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"primary_keyword" text NOT NULL,
	"secondary_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_intent" text,
	"target_word_count" integer DEFAULT 3000 NOT NULL,
	"cause_category" text,
	"priority_score" integer DEFAULT 50 NOT NULL,
	"seasonal_boost" integer DEFAULT 0 NOT NULL,
	"news_hook" text,
	"source_news_id" uuid,
	"content_brief" jsonb,
	"outline" jsonb,
	"status" "blog_topic_status" DEFAULT 'pending' NOT NULL,
	"generated_post_id" uuid,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_topic_queue_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bulk_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sent_by" uuid NOT NULL,
	"template_name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" "bulk_email_status" DEFAULT 'draft' NOT NULL,
	"campaign_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"donor_name" text DEFAULT 'Anonymous' NOT NULL,
	"donor_location" text,
	"message" text NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"donation_id" uuid,
	"flagged" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"phase" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"evidence_type" text NOT NULL,
	"fund_percentage" integer NOT NULL,
	"estimated_completion" timestamp with time zone,
	"status" "milestone_status" DEFAULT 'pending' NOT NULL,
	"fund_amount" integer,
	"released_amount" integer DEFAULT 0 NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestones_phase_check" CHECK ("campaign_milestones"."phase" >= 1 AND "campaign_milestones"."phase" <= 3),
	CONSTRAINT "milestones_fund_pct_check" CHECK ("campaign_milestones"."fund_percentage" >= 10 AND "campaign_milestones"."fund_percentage" <= 60)
);
--> statement-breakpoint
CREATE TABLE "campaign_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "withdrawal_status" DEFAULT 'requested' NOT NULL,
	"stripe_connect_account" text,
	"processed_by" uuid,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donor_campaign_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_email" text NOT NULL,
	"user_id" uuid,
	"campaign_id" uuid NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fund_pool_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" uuid NOT NULL,
	"source_campaign_id" uuid NOT NULL,
	"target_campaign_id" uuid,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"allocated_at" timestamp with time zone,
	"disbursed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fund_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "fund_release_status" DEFAULT 'held' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_connect_account" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "info_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"target_user" uuid NOT NULL,
	"request_type" text NOT NULL,
	"details" text NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" "info_request_status" DEFAULT 'pending' NOT NULL,
	"pause_campaign" boolean DEFAULT false NOT NULL,
	"response_text" text,
	"response_files" jsonb DEFAULT '[]'::jsonb,
	"responded_at" timestamp with time zone,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_rotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"keyword" text NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"description" text,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewer_notes" text,
	"reviewed_at" timestamp with time zone,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"total_donations" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"refunded_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" "refund_batch_status" DEFAULT 'processing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"stripe_refund_id" text,
	"status" "refund_record_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text,
	"user_name" text,
	"channel" "support_channel" NOT NULL,
	"subject" text,
	"status" "support_conversation_status" DEFAULT 'open' NOT NULL,
	"priority" "support_priority" DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"tier" integer DEFAULT 1 NOT NULL,
	"campaign_id" uuid,
	"external_conversation_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"document_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"description" text,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewer_notes" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "source" "blog_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "primary_keyword" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "secondary_keywords" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "seo_score" integer;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "word_count" integer;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "readability_score" integer;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "internal_links" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "external_links" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "faq_data" jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "topic_id" uuid;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "cause_category" text;--> statement-breakpoint
ALTER TABLE "campaign_updates" ADD COLUMN "update_type" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_profile" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_organizer" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "fund_usage_plan" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "simulation_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "simulation_config" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "last_donor_name" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "last_donor_amount" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "beneficiary_relation" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "verification_status" "verification_status" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cancellation_notes" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "paused_reason" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "verification_reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "verification_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "milestone_fund_release" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "total_released_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "subscribed_to_updates" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "article_body" text;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "admin_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "admin_override_category" "campaign_category";--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "campaigns_created" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_emails" ADD CONSTRAINT "bulk_emails_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_emails" ADD CONSTRAINT "bulk_emails_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_milestones" ADD CONSTRAINT "campaign_milestones_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_withdrawals" ADD CONSTRAINT "campaign_withdrawals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_withdrawals" ADD CONSTRAINT "campaign_withdrawals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_withdrawals" ADD CONSTRAINT "campaign_withdrawals_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_campaign_subscriptions" ADD CONSTRAINT "donor_campaign_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_campaign_subscriptions" ADD CONSTRAINT "donor_campaign_subscriptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_pool_allocations" ADD CONSTRAINT "fund_pool_allocations_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_pool_allocations" ADD CONSTRAINT "fund_pool_allocations_source_campaign_id_campaigns_id_fk" FOREIGN KEY ("source_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_pool_allocations" ADD CONSTRAINT "fund_pool_allocations_target_campaign_id_campaigns_id_fk" FOREIGN KEY ("target_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_releases" ADD CONSTRAINT "fund_releases_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_releases" ADD CONSTRAINT "fund_releases_milestone_id_campaign_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."campaign_milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_releases" ADD CONSTRAINT "fund_releases_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_requests" ADD CONSTRAINT "info_requests_target_user_users_id_fk" FOREIGN KEY ("target_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_milestone_id_campaign_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."campaign_milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_evidence" ADD CONSTRAINT "milestone_evidence_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_batches" ADD CONSTRAINT "refund_batches_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_batches" ADD CONSTRAINT "refund_batches_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_batch_id_refund_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."refund_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_records" ADD CONSTRAINT "refund_records_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_created_at" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_model" ON "ai_usage_logs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_prompt_type" ON "ai_usage_logs" USING btree ("prompt_type");--> statement-breakpoint
CREATE INDEX "idx_blog_gen_logs_topic" ON "blog_generation_logs" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_blog_gen_logs_step" ON "blog_generation_logs" USING btree ("step");--> statement-breakpoint
CREATE INDEX "idx_blog_gen_logs_created" ON "blog_generation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_blog_topic_queue_status" ON "blog_topic_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_blog_topic_queue_priority" ON "blog_topic_queue" USING btree ("priority_score");--> statement-breakpoint
CREATE INDEX "idx_blog_topic_queue_category" ON "blog_topic_queue" USING btree ("cause_category");--> statement-breakpoint
CREATE INDEX "idx_bulk_emails_status" ON "bulk_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_messages_campaign" ON "campaign_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_messages_user" ON "campaign_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_messages_created" ON "campaign_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_messages_flagged" ON "campaign_messages" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "idx_milestones_campaign" ON "campaign_milestones" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_milestones_status" ON "campaign_milestones" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_milestones_campaign_phase" ON "campaign_milestones" USING btree ("campaign_id","phase");--> statement-breakpoint
CREATE INDEX "idx_campaign_withdrawals_campaign" ON "campaign_withdrawals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_withdrawals_status" ON "campaign_withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_withdrawals_requested_by" ON "campaign_withdrawals" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_donor_subs_campaign" ON "donor_campaign_subscriptions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_donor_subs_email" ON "donor_campaign_subscriptions" USING btree ("donor_email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_donor_subs_email_campaign" ON "donor_campaign_subscriptions" USING btree ("donor_email","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_fund_pool_status" ON "fund_pool_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fund_pool_source" ON "fund_pool_allocations" USING btree ("source_campaign_id");--> statement-breakpoint
CREATE INDEX "idx_fund_pool_target" ON "fund_pool_allocations" USING btree ("target_campaign_id");--> statement-breakpoint
CREATE INDEX "idx_fund_releases_campaign" ON "fund_releases" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_fund_releases_status" ON "fund_releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_info_requests_campaign" ON "info_requests" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_info_requests_status" ON "info_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_info_requests_deadline" ON "info_requests" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "idx_keyword_rotation_category" ON "keyword_rotation" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_keyword_rotation_category_keyword" ON "keyword_rotation" USING btree ("category","keyword");--> statement-breakpoint
CREATE INDEX "idx_milestone_evidence_milestone" ON "milestone_evidence" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_evidence_campaign" ON "milestone_evidence" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_refund_batches_campaign" ON "refund_batches" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_refund_batches_status" ON "refund_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_refund_records_batch" ON "refund_records" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_refund_records_donation" ON "refund_records" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "idx_support_conversations_status" ON "support_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_support_conversations_user" ON "support_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_support_conversations_channel" ON "support_conversations" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_verification_docs_campaign" ON "verification_documents" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_verification_docs_status" ON "verification_documents" USING btree ("status");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_verification_reviewer_id_users_id_fk" FOREIGN KEY ("verification_reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaigns_simulation_flag" ON "campaigns" USING btree ("simulation_flag");--> statement-breakpoint
CREATE INDEX "idx_campaigns_creator_id" ON "campaigns" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_news_items_admin_flagged" ON "news_items" USING btree ("admin_flagged");