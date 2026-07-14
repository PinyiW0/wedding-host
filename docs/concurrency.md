# 併發與資料一致性盤點（issue #71）

正式站是多裝置併發場景：婚禮當天多台接待機同時報到／登記禮金／發喜餅，加上賓客自助報到與後台操作並行。本文盤點全部 `server/api` 寫入端點（71 個）的併發風險並記錄修補與接受的殘餘風險。

**技術前提**：DB 走 **neon-http driver，不支援 `db.transaction()`**。解法優先序：(1) unique constraint / DB 層兜底 → (2) 單語句 upsert（`ON CONFLICT`）／單句 SQL → (3) 真正需要交易才評估換 neon WebSocket（`Pool`）driver（動基礎設施，慎重）。

分類定義：
- **A｜會撞且會壞資料**：check-then-write、delete+insert 非原子替換、迴圈多筆非原子、需唯一性但無 constraint。
- **B｜會撞但 last-write-wins 可接受**：單列覆蓋，最後寫入為準在業務上可接受。
- **C｜不會撞**：純 insert（PK 由 handler 產生）、單列刪除、唯讀衍生。

---

## 已修（A 類，constraint / upsert / 單句 SQL）

| 端點 | 原問題 | 手法 |
|---|---|---|
| `cake-box-types/[id]/assignment.post` | delete 舊指派 + insert 新指派，非原子；併發產生重複 | `cakeBoxAssignments.guestId` 加 **unique index**，改單語句 **`onConflictDoUpdate`** 真 upsert（migration 0006） |
| `rundown-roles/[roleId]/index.delete` | 級聯清理 roleTasks 用 select→迴圈逐筆 update（N 次非原子往返） | 改**單句 SQL**：`jsonb_agg`+`jsonb_array_elements` 一次過濾所有含該角色的 item，`@>` 只掃命中列 |
| `guest-categories/index.put` | delete-all + insert 整份，非原子；併發互刪／PK 撞 | 改「**upsert 先行（`onConflictDoNothing`，複合 PK 去重）+ 刪除不在新集合者**」，消除清單瞬間清空的窗口 |
| `rundown-items/index.put` | 整表 delete-all + insert，非原子；併發丟更新 | 改「**`onConflictDoUpdate`（by rundownItemId）+ 刪除不在新集合者**」；顯示序由 GET 依 `time` 排序、不依賴 seq，故 upsert 不影響排序 |
| `cake-box-exclusions/index.post` | check-then-insert，可插重複排除列 | `(weddingId, guestId)` 加 **unique index**，改 **`onConflictDoNothing`** 冪等寫入（migration 0007） |
| `reception-accounts/index.post` `[id].patch` | (weddingId,username) 唯一性靠查後寫，併發建帳撞名 | `(weddingId, username)` 加 **unique index** 作 DB 兜底（保留 handler 友善 409；migration 0007） |
| `rundown-roles/index.post` | (weddingId,name) 唯一性靠查後寫 | `(weddingId, name)` 加 **unique index** 作 DB 兜底（保留 handler 友善 400；migration 0007） |

> **DB 兜底的語意**：reception-accounts／rundown-roles 保留原本的 check-then-write 友善錯誤（常見情境回 409/400），unique index 僅在「兩請求同時通過檢查」的極罕見競態時由 DB 擋下重複——此時競態輸家會收到 500（無資料損壞）。這是 issue 優先序 (1) 的「DB 層兜底」。

## 順手改善（issue 指定）

| 端點 | 改動 |
|---|---|
| `dashboard-stats.get` | 撈全表 JS 聚合改為**單一 SQL 聚合**（`count/sum ... filter (where ...)`），母集語意（active＝未軟刪且非待審）與原本完全一致 |

---

## 接受的殘餘風險（明確記錄）

### 需要交易才能真正原子（neon-http 不支援）→ 候選：換 neon WebSocket driver（issue 優先序 3）

- **`tables/[tableId]/seats/index.post`（座位容量 check-then-write）**：兩台同時排位可能超賣座位、或同賓客被雙重入座。座位安排是**婚禮前的單人規劃作業**（非當天多機併發），實際併發機率極低。真正原子需交易或悲觀鎖；`(tableId, seatNumber)` 無法加 unique（會破壞 `seats/move` 互換兩席的非原子兩步 update）。**接受，列為換 driver 候選**。
- **`seats/move.post`（互換兩席）**：兩句 update 無法在 neon-http 原子化。同上，低頻規劃作業。**接受**。
- **`guests/[guestId]/index.patch`（partySize 變動觸發席位 delete+insert 重排）**：低頻（admin 編輯單一賓客）。**接受**。
- **`users/index.post`／`users/[userId].patch`（users.weddingId ↔ weddings.ownerId 雙向關聯跨表雙寫）**：中途失敗會半更新。設定時低頻操作。**接受**，列為換 driver 候選。
- **`users/[userId].delete`（不得停用最後管理者的 check-then-write）**：兩台同停不同管理者理論上可歸零。極低頻。**接受**（可改單句 `UPDATE ... WHERE (SELECT count(*) ...) > 1` 收斂，列為後續）。

### 唯一性但暫緩加 constraint

- **`admins/index.post`（email）／`users/index.post`（username）**：兩者都寫 `users` 表。新人帳號 `email=''`（空字串佔位），admins 的 username＝email，直接加 `email`/`username` 的 partial unique 會與 `email=''` 或跨角色命名相撞，需精算 partial 條件（`WHERE deleted_at IS NULL AND email <> ''` 等）才安全。**暫緩**——handler 的 check-then-write 已覆蓋常見情境，併發撞名極低頻；正確的 partial unique index 列為後續。

### last-write-wins 可接受（B 類，單列覆蓋，不需改）

報到 `check-in`／`self-check-in`、禮金 `gift-money.post/patch`、喜餅發放 `cake-box-distribution`、RSVP `rsvp`／`rsvp-override`／`invitation-sent`、LINE 綁定 `line-binding`、賓客／婚禮還原 `restore`、祝福審核 `approve`/`reject`/`project`、待確認賓客 `confirm`/`reject`、單列編輯 `gift-items/[id].patch`／`tables/[id].patch`／`venue-markers/[id].patch`／`weddings/[id].patch`。這些皆為單列覆蓋，最後寫入為準在業務上可接受（一位賓客的禮金/報到由一位接待員登記一次；重複屬人為流程問題非 DB 損壞）。

### 灰區（低頻，接受並記錄）

- **單例設定 PUT 的「首寫競態」**（`venue-layout`／`rsvp-config`／`projection-settings`／`line-oa`／`thank-you-card/template`／`customizations`）：手動 upsert（select→無則 insert、有則 update）。穩態是 LWW；只有「兩請求同時對尚無資料的婚禮首寫」會雙 insert 撞 PK → 其一 500（無損壞）。低頻。**接受**（可改 drizzle 原生 `onConflictDoUpdate` 一句原子 upsert 消除此邊角，列為後續）。
- **「單一預設」不變式**（`cake-box-types/index.post`、`[id]/index.patch` 的 `isDefault`）：先清其他預設再設自己，多列非原子；兩台同時設不同款為預設可能出現 0 或 2 個預設。建立款式為單人規劃、低頻。**接受**（patch 可改單句 `UPDATE ... SET is_default = (cake_box_type_id = $target)` 收斂，列為後續）。
- **`pending-guests/merge.post` 雙併入**、**`tables/[tableId]/index.delete` 孤兒座位**、**`thank-you/batch-send.post` 重複群發（外部副作用，非 DB 一致性）**：低頻，**接受並記錄**。

---

## 全端點分類總表

> A 類已於上方逐一處理（修或接受）。B/C 類母數如下，細節見上方 LWW 段落。

- **A（會壞資料）**：17 個 → 已修 7、接受並記錄 10（多數需交易或屬低頻設定作業）。
- **B（LWW 可接受）**：28 個 → 單列覆蓋，不需改。
- **C（不會撞）**：26 個 → 純 insert（handler UUID PK）／單列刪除／唯讀。

新增 constraint 對應 migration：`0006`（cakeBoxAssignments.guestId unique）、`0007`（cakeBoxExclusions / receptionAccounts / rundownRoles 複合 unique）。
