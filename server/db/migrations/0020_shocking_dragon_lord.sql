ALTER TABLE "guests" ADD COLUMN "flower_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rsvp_form_configs" DROP COLUMN "show_guest_flowers";