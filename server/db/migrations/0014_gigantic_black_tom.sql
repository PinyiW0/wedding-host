CREATE TABLE "short_links" (
	"code" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "short_links_wedding_id_kind_index" ON "short_links" USING btree ("wedding_id","kind");