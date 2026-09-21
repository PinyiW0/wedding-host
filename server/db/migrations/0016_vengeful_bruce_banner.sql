DROP INDEX "short_links_wedding_id_kind_index";--> statement-breakpoint
ALTER TABLE "short_links" ADD COLUMN "guest_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "short_links_wedding_id_kind_guest_id_index" ON "short_links" USING btree ("wedding_id","kind","guest_id");