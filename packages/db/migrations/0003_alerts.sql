-- Price alerts (double opt-in by email). Only the email address and the alert itself are stored.
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"offer_id" text NOT NULL,
	"offer_title" text NOT NULL,
	"threshold_paise" bigint NOT NULL,
	"locale" text NOT NULL DEFAULT 'en',
	"verified" boolean NOT NULL DEFAULT false,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_notified_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_email_idx" ON "alerts" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_offer_idx" ON "alerts" ("offer_id") WHERE "verified";
