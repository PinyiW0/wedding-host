ALTER TABLE "blessings" ALTER COLUMN "guest_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "blessings" ADD COLUMN "guest_name" text;