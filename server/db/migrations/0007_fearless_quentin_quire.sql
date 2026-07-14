DROP INDEX "cake_box_exclusions_wedding_id_index";--> statement-breakpoint
DROP INDEX "reception_accounts_wedding_id_index";--> statement-breakpoint
DROP INDEX "rundown_roles_wedding_id_index";--> statement-breakpoint
CREATE UNIQUE INDEX "cake_box_exclusions_wedding_id_guest_id_index" ON "cake_box_exclusions" USING btree ("wedding_id","guest_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reception_accounts_wedding_id_username_index" ON "reception_accounts" USING btree ("wedding_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "rundown_roles_wedding_id_name_index" ON "rundown_roles" USING btree ("wedding_id","name");