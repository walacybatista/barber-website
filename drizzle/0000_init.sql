CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "barbers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"specialties" text[] DEFAULT '{}'::text[] NOT NULL,
	"photo" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "barbers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"barber_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"manage_token_hash" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	CONSTRAINT "bookings_manage_token_hash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "bookings_period_order" CHECK ("bookings"."end_at" > "bookings"."start_at")
);
--> statement-breakpoint
CREATE TABLE "busy_periods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"barber_id" integer NOT NULL,
	"period" "tstzrange" NOT NULL,
	"booking_id" bigint,
	"block_id" bigint,
	CONSTRAINT "busy_periods_one_owner" CHECK (num_nonnulls("busy_periods"."booking_id", "busy_periods"."block_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekday" smallint NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	CONSTRAINT "opening_hours_weekday" CHECK ("opening_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "opening_hours_order" CHECK ("opening_hours"."close_time" > "opening_hours"."open_time")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_min" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug"),
	CONSTRAINT "services_duration_step" CHECK ("services"."duration_min" > 0 AND "services"."duration_min" % 15 = 0),
	CONSTRAINT "services_price_nonneg" CHECK ("services"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"barber_id" integer NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_blocks_period_order" CHECK ("time_blocks"."end_at" > "time_blocks"."start_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "busy_periods" ADD CONSTRAINT "busy_periods_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "busy_periods" ADD CONSTRAINT "busy_periods_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "busy_periods" ADD CONSTRAINT "busy_periods_block_id_time_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."time_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_barber_start_idx" ON "bookings" USING btree ("barber_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_start_idx" ON "bookings" USING btree ("start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "busy_periods_booking_uq" ON "busy_periods" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "busy_periods_block_uq" ON "busy_periods" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "login_attempts_key_idx" ON "login_attempts" USING btree ("key","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_hours_weekday_open_uq" ON "opening_hours" USING btree ("weekday","open_time");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "time_blocks_barber_start_idx" ON "time_blocks" USING btree ("barber_id","start_at");