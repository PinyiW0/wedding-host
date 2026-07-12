ALTER TABLE "venue_layouts" ADD COLUMN "ref_image_x" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_layouts" ADD COLUMN "ref_image_y" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_layouts" ADD COLUMN "ref_image_scale" double precision DEFAULT 1 NOT NULL;