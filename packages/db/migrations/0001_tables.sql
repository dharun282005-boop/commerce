CREATE TABLE "localities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ta" text NOT NULL,
	"pincode" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"zone" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"vertical" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"price_paise" bigint NOT NULL,
	"data" jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"is_sample" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"source_id" text NOT NULL,
	"vertical" text NOT NULL,
	"price_paise" bigint NOT NULL,
	"fees" jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_sample" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"verticals" text[] NOT NULL,
	"tier" integer NOT NULL,
	"enabled_by_default" boolean NOT NULL,
	"terms_url" text,
	"robots_allowed" boolean,
	"last_reviewed" date,
	"is_sample" boolean NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_title_trgm" ON "offers" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "offers_vertical_idx" ON "offers" USING btree ("vertical");--> statement-breakpoint
CREATE INDEX "price_obs_offer_time_idx" ON "price_observations" USING btree ("offer_id","observed_at");