CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"niche" text NOT NULL,
	"owner" text NOT NULL,
	"platform_handle" text,
	"video_gen_tool" text NOT NULL,
	"needs_voiceover" boolean DEFAULT false NOT NULL,
	"voice_style" text,
	"accent_color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "daily_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"idea_title" text NOT NULL,
	"hook" text,
	"video_prompt" text,
	"voiceover_script" text,
	"post_status" text DEFAULT 'idea' NOT NULL,
	"posted_at" timestamp,
	"informed_by_insight_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"summary" text NOT NULL,
	"recommendations" text DEFAULT '[]' NOT NULL,
	"source" text DEFAULT 'claude' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posted_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"daily_plan_id" text,
	"idea_title" text DEFAULT '' NOT NULL,
	"platform_video_id" text,
	"posted_at" timestamp DEFAULT now() NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer,
	"avg_view_duration" real,
	"retention_note" text,
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_informed_by_insight_id_insights_id_fk" FOREIGN KEY ("informed_by_insight_id") REFERENCES "public"."insights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posted_videos" ADD CONSTRAINT "posted_videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posted_videos" ADD CONSTRAINT "posted_videos_daily_plan_id_daily_plans_id_fk" FOREIGN KEY ("daily_plan_id") REFERENCES "public"."daily_plans"("id") ON DELETE set null ON UPDATE no action;