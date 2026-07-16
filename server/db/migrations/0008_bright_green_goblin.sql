--> 賓客分類正規化（issue #94）：category 名稱字串 → category_id 引用 + tier/is_main_table 語意欄位。
--> drizzle-kit 產出的 naive 版本（直接 DROP category、ADD PK NOT NULL）在非空表會炸且丟資料，
--> 手改補上資料搬遷與 DROP 前的 RAISE 安全閘。整份 migration 在單一 transaction 內
--> （drizzle migrator 的 session.transaction），任一步 RAISE 會連同所有 DDL 回滾。

--> 1) guest_categories 加欄位（category_id 先 nullable：非空表不能直接加 NOT NULL）
ALTER TABLE "guest_categories" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "guest_categories" ADD COLUMN "tier" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_categories" ADD COLUMN "is_main_table" boolean DEFAULT false NOT NULL;--> statement-breakpoint

--> 2) 既有字典列補 id（對齊 handler 的 gcat-<uuid8> 慣例）
UPDATE "guest_categories" SET "category_id" = 'gcat-' || substr(gen_random_uuid()::text, 1, 8) WHERE "category_id" IS NULL;--> statement-breakpoint

--> 3) 在用但不在字典的分類補建（DISTINCT btrim 正規化；空字串不建）
INSERT INTO "guest_categories" ("category_id", "wedding_id", "name")
SELECT 'gcat-' || substr(gen_random_uuid()::text, 1, 8), d."wedding_id", d."name"
FROM (
  SELECT DISTINCT "wedding_id", btrim("category") AS "name"
  FROM "guests" WHERE btrim("category") <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "guest_categories" gc
  WHERE gc."wedding_id" = d."wedding_id" AND gc."name" = d."name"
);--> statement-breakpoint

--> 4) 全表補語意欄位（CASE 需與 server/utils/guest-category.ts 的 inferCategoryDefaults 逐字一致）
UPDATE "guest_categories" SET
  "tier" = CASE
    WHEN "name" = '新人' THEN 0
    WHEN "name" ~ '雙親|父母|家人|家屬|長輩|親戚' THEN 1
    WHEN "name" ~* '主管|貴賓|vip|摯友|朋友' THEN 2
    ELSE 3 END,
  "is_main_table" = ("name" IN ('新人', '雙親'));--> statement-breakpoint

--> 5) category_id 收 NOT NULL、換 PK、補 unique（(wedding_id,name) 同場不得同名）
ALTER TABLE "guest_categories" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_categories" DROP CONSTRAINT "guest_categories_wedding_id_name_pk";--> statement-breakpoint
ALTER TABLE "guest_categories" ADD PRIMARY KEY ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_categories_wedding_id_name_index" ON "guest_categories" USING btree ("wedding_id","name");--> statement-breakpoint

--> 6) guests 加 category_id + 回填（btrim 對位；category='' 留 NULL，順帶併同名不同空白的髒資料）
ALTER TABLE "guests" ADD COLUMN "category_id" text;--> statement-breakpoint
UPDATE "guests" g SET "category_id" = gc."category_id"
FROM "guest_categories" gc
WHERE gc."wedding_id" = g."wedding_id" AND gc."name" = btrim(g."category");--> statement-breakpoint

--> 7) 安全閘：非空 category 全數對到才准 DROP（RAISE 連同整份 transaction 回滾，絕不「回填漏了但欄位已刪」）
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "guests" WHERE btrim("category") <> '' AND "category_id" IS NULL) THEN
    RAISE EXCEPTION '回填未完成：仍有賓客的 category 未對到 category_id';
  END IF;
END $$;--> statement-breakpoint

--> 8) 建 guests.category_id index + DROP 舊 category 欄
CREATE INDEX "guests_category_id_index" ON "guests" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "guests" DROP COLUMN "category";
