DROP INDEX "cake_box_assignments_guest_id_index";--> statement-breakpoint
CREATE UNIQUE INDEX "cake_box_assignments_guest_id_index" ON "cake_box_assignments" USING btree ("guest_id");