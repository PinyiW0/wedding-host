CREATE TABLE "cake_box_notes" (
	"wedding_id" text NOT NULL,
	"guest_id" text NOT NULL,
	"note" text NOT NULL,
	CONSTRAINT "cake_box_notes_wedding_id_guest_id_pk" PRIMARY KEY("wedding_id","guest_id")
);
