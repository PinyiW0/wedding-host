# 安全審查報告（issue #70）

全站安全縱深審查：站在攻擊者角度對 `server/api`（105 個端點）＋ `server/utils`／`server/db`／`server/middleware` 的存量掃描（非 diff 級）。多視角：授權（IDOR）、注入、資訊洩露、資源濫用。

- 審查日期：2026-07-13
- 範圍：`server/**` 全部 handler、授權鏈、簽名機制、密鑰設定
- 方法：`/security-review` 起手 + 四路對抗式掃描（租戶隔離 / 注入輸入驗證 / 資訊洩露 PII / 密鑰與基礎設施）

授權模型現況（供對照）：`server/middleware/auth.ts` 對登入者以 `assertWeddingScope` 驗 path 上的 `weddingId` 歸屬（新人限自有、接待員限綁定、管理者跨場放行）；匿名存取以 HMAC 簽名（`w.` 婚禮／`g.` 賓客）綁定 path `weddingId`。`enforced` 模式（production）無 token 即 401、分享／賓客連結需簽名；`open` 模式（dev／e2e）無 token 退回預設管理員、簽名不強制。

---

## 發現總表（依風險排序）

| # | 風險 | 端點 / 位置 | 類別 | 狀態 |
|---|------|------------|------|------|
| H1 | High | `nuxt.config.ts` runtimeConfig（`jwtSecret`／`guestLinkSecret`） | 密鑰硬編碼、無啟動守衛 | ✅ 已修 |
| H2 | High | `auth/login.post.ts` | 登入無 rate limiting（憑證爆破） | ✅ 已修 |
| H3 | High | `reception-accounts/[accountId].delete.ts` | 跨婚禮刪除接待帳號（IDOR） | ✅ 已修 |
| H4 | High | `blessings/index.get.ts` | 匿名簽名者可讀待審／被退祝福＋退件原因 | ✅ 已修 |
| M1 | Med | `venue-layout.put.ts` | mass assignment → 跨租戶寫入 | ✅ 已修 |
| M2 | Med | `thank-you-card/public/[guestId].get.ts` | 跨婚禮賓客姓名外洩＋存在探測 | ✅ 已修 |
| M3 | Med | `guests/index.get.ts` | 接待員可見 PII 欄位過寬 | ✅ 已修 |
| M4 | Med | 多端點（見下） | 數字欄未驗（NaN／浮點／溢位／負值）、enum 未白名單 | ✅ 已修 |
| M5 | Med | `uploads/presign.post.ts` | presign 無限簽發 → bucket 灌爆／成本 | ✅ 已修（限流）＋殘餘風險 |
| M6 | Med | `blessings/index.post.ts` | 冒用任意 `guestId` 上牆 | ✅ 已修 |
| M7 | Med | `nuxt.config.ts` | 無安全標頭（clickjacking／MIME sniff） | ✅ 已修 |
| L1 | Low | `weddings/[weddingId]/index.get.ts` | 匿名者取得 `ownerId`／`deletedAt` | ✅ 已修 |
| L2 | Low | `guests/[guestId]/cake-box-distribution.post.ts` | `cakeBoxTypeId` 未驗歸屬 | ✅ 已修 |
| L3 | Low | `thank-you-card/customizations.post.ts` | `guestId` 未驗歸屬（資料完整性） | ✅ 已修 |
| L4 | Low | `__test__/reset.post.ts` | 僅靠 `authMode` 防護（誤設 open 於 prod 會清庫） | 接受（部署清單把關） |
| R1 | 接受 | `guest-link.ts` | HMAC 連結無過期（業務約束） | 記錄殘餘風險 |
| R2 | 接受 | `guests/display-names`、`flowers` | 簽名者可列全賓客姓名（公開頁設計） | 記錄殘餘風險 |
| R3 | 接受 | `rate-limit.ts` | in-memory 限流於 serverless 為單實例 | 記錄殘餘風險 |

---

## High 風險（已全數修復）

### H1 — 密鑰硬編碼且無啟動守衛
`nuxt.config.ts` 的 `jwtSecret`、`guestLinkSecret` 有 `dev-only-...-change-me` 預設值。若正式站環境變數（`NUXT_JWT_SECRET`／`NUXT_GUEST_LINK_SECRET`）忘了覆蓋，攻擊者可用公開的預設值**偽造任意 JWT**（冒充管理者）與**偽造婚禮／賓客簽名連結**——等同全站淪陷。原本僅靠註解提醒，無強制。

**修補**：新增 `server/plugins/00.security-guard.ts` nitro 啟動外掛，`enforced` 模式下若偵測到密鑰仍為 dev 預設值或空字串，**直接 throw 阻止啟動**（fail-fast，避免帶著弱密鑰上線）。`open` 模式（dev／e2e）不受影響。

### H2 — 登入端點無 rate limiting
`auth/login.post.ts`（新人與接待帳號共用）無任何嘗試次數限制。端點雖已做帳號枚舉防護（一致訊息＋dummy hash 抹平時間差），但可被無限次爆破真實帳號密碼。

**修補**：新增 `server/utils/rate-limit.ts` 滑動視窗限流，`login.post.ts` 以「IP＋帳號」為 key 計**失敗**次數（成功即清零），15 分鐘內失敗達上限回 `429`。僅計失敗、成功重置，正常使用者不受影響。

### H3 — 跨婚禮刪除接待帳號（IDOR）
`reception-accounts/[accountId].delete.ts` 的 `where` 只比對 `accountId`、**未帶 `weddingId`**。此路由是普通 `auth` 類（非 adminOnly），新人 A 通過自有婚禮的範圍檢查後，即可送 `DELETE /weddings/{A}/reception-accounts/{B 的 accountId}` 刪掉**任意婚禮**的接待帳號（同目錄 PATCH 有正確雙重過濾，唯獨 delete 漏）。

**修補**：`where` 補 `and(eq(accountId), eq(weddingId))`。

### H4 — 匿名者可讀未審核／被退祝福＋退件原因
`blessings/index.get.ts` 分類為 `share`（婚禮簽名即可讀），但回傳該婚禮**全部**祝福，含 `status='submitted'`（未過審、可能含不當內容）、`status='rejected'` 加 `rejectReason`（新人／接待員寫的內部審核理由）與投稿者身分。每位賓客都持有效簽名，等於把「被退留言＋打槍理由」曝給全場。

**修補**：handler 依 `event.context.authUser` 分支——匿名（僅簽名）只回 `status='approved'` 並剔除 `rejectReason`；登入的管理端／接待員維持全量（審核所需）。此判別在 enforced 與 open 模式皆成立（管理端頁登入帶 token → authUser 存在；投影牆匿名頁只帶 `?sig=` → authUser 不存在）。

---

## Medium 風險（已全數修復）

- **M1 `venue-layout.put.ts`**：insert 分支 `values({ weddingId, ...body })` 的展開順序讓 `body.weddingId` 覆蓋 URL 值，可為他人婚禮建立佈局列（跨租戶寫入）。改為顯式白名單欄位。
- **M2 `thank-you-card/public/[guestId].get.ts`**：guest 查詢用裸 `guestId`、未帶 `weddingId`，可跨婚禮枚舉並讀出其他婚禮賓客姓名。補 `weddingId` 過濾。
- **M3 `guests/index.get.ts`**：接待員（RECEPTION_GET 白名單）拿到每位賓客的電話、郵寄地址、LINE id、內部備註、自由問答。報到／發喜餅只需 name/side/category/diet/partySize/childChairCount/tableName/status。改為接待員回精簡子集、`fields=full` 限管理端。
- **M4 輸入驗證**：多處數字欄（`shuttleCount`／`partySize`／`childChairCount`／禮金 `amount`／喜餅與品項金額／桌次 `capacity`）未經整數與範圍檢查即落 integer 欄，可致 `NaN`、浮點、int4 溢位（→ 500）、負值污染，並與座位展開迴圈組成放大式 DoS；`side`／`diet`／`rsvpAttending` 等 enum 欄無執行期白名單。新增 `server/utils/validation.ts`（`assertPositiveInt`／`assertEnum`）並套用。其中 `shuttleCount` 於**未登入可達**的公開 RSVP 端點，優先。
- **M5 `uploads/presign.post.ts`**：持婚禮簽名者可無限索取上傳 URL。已加限流（每 IP＋婚禮每分鐘上限）。R2 presigned PUT 無法在簽名內限制檔案大小（見殘餘風險 R）。
- **M6 `blessings/index.post.ts`**：持婚禮簽名者可帶任意 `body.guestId` 冒名投稿。改為驗證 `guestId` 屬於本婚禮，否則忽略（退回自填姓名模式）。
- **M7 安全標頭**：`nuxt.config.ts` 補 `routeRules` 全站標頭 `X-Frame-Options: SAMEORIGIN`（防點擊劫持）、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`。嚴格 CSP 因可能影響現有 inline 樣式暫緩，列後續。

---

## Low 風險（已修復）

- **L1 `weddings/[weddingId]/index.get.ts`**：`share` 端點對匿名者回傳 `ownerId`（新人帳號主鍵）與 `deletedAt`。匿名時剔除，僅回公開頁所需欄位。
- **L2 `cake-box-distribution.post.ts`**：`cakeBoxTypeId` 未驗存在／歸屬，可指向跨婚禮或幽靈款式。補 `(weddingId, cakeBoxTypeId)` 存在檢查。
- **L3 `thank-you-card/customizations.post.ts`**：`body.guestId` 未驗歸屬（僅資料完整性，因 weddingId 恆為 path 值無跨租戶外洩）。補存在檢查。
- **L4 `__test__/reset.post.ts`**：由 middleware 在 `authMode==='enforced'`（production 預設）時 404。原評估想加碼「非 dev build 一律 404」以防 `NUXT_AUTH_MODE` 誤設 open，但 gate 本身即是 production build 靠 `NUXT_AUTH_MODE=open` 重新啟用 reset 來 seed（`scripts/docker-gate.sh`），任何 build-flag 守衛都無法區分「gate 的 open 生產建置」與「誤設 open 的真實生產」，會一併擋掉 gate 的 reset。且真實生產若誤設 open，全站 auth 都退回預設管理員（比 reset 可達更嚴重），本就不該發生。**故改由部署檢查清單把關 `NUXT_AUTH_MODE` 不得覆蓋為 open，不加 code 守衛。**

---

## 已檢查且確認安全的重點

- **SQL 注入**：全 codebase 僅兩處 raw SQL（`health` 的 `select 1`、`seed.ts` 的 TRUNCATE 用固定 schema 表名），其餘一律 drizzle 參數化。無 `sql.raw(userInput)`、無字串拼接。
- **Open redirect / 路徑跳脫**：`line-login/callback` 導回網址完全由驗證過的 state 組出、不採信 query；`uploads/presign` 的 `kind`（`/^[a-z0-9-]{1,32}$/`）與副檔名白名單、key 用 UUID。
- **時序攻擊**：HMAC 驗證（`guest-link`／`line-login`）與密碼驗證（`password.ts`）皆用 `timingSafeEqual`；登入端點抹平帳號枚舉時間差。
- **密碼**：scrypt 雜湊；全 server 無任何 response 帶出 `passwordHash`。
- **錯誤訊息**：全部 `createError` 用固定中文訊息，無一處回傳 `error.message`／stack／DB 原文。
- **stored XSS**：全前端零 `v-html`，Vue 預設轉義。
- **公開註冊收斂**：`admins` POST 於 enforced 下僅「系統零管理員」首開窗口或已登入管理者可用。
- **租戶隔離**：約 80 個 `weddings/[weddingId]/**` handler 的 UPDATE/DELETE/SELECT 子資源均已正確以 path `weddingId`（或經已驗證關聯）過濾（issue #48 修補留存），僅 H3／M2 兩處殘留、已補。

---

## 接受的殘餘風險（決定記錄）

### R1 — HMAC 簽名連結無過期
`guest-link.ts` 的 `w.`／`g.` 簽名不含時效。**這是刻意的業務約束**：連結由新人人工傳送、需長期有效（婚後謝卡數月內仍要能開），且已印出的實體 QR 立牌無法失效。加 TTL 會讓謝卡連結在婚後失效、實體 QR 報廢，成本不成比例。

- **緩解**：需要整批失效時輪換 `NUXT_GUEST_LINK_SECRET`（所有既有簽名一次作廢，適用「連結外流」事故）。
- **殘餘風險接受**：單一連結外洩後在密鑰輪換前持續有效；影響面限該婚禮的公開／賓客資料，無法跨婚禮、無法取得管理權限。

### R2 — 簽名者可列全婚禮賓客姓名
`guests/display-names` 與 `flowers` 對任一有效簽名回傳全婚禮賓客的 `guestId`＋`name`（花田另含手繪）。**這是投影牆／花田的公開頁設計**（現場需顯示賓客名）。姓名屬低敏感度且本就會在現場公開展示；`guestId` 單獨無法操作（賓客專屬動作需相符 `g` 簽名）。**接受**。

### R3 — in-memory 限流於 serverless 為單實例
`rate-limit.ts` 以行程內 Map 計數。Vercel serverless 多實例、冷啟動會重置，故無法跨實例協調、對分散式慢速爆破防護有限。

- **判斷**：本專案為低併發婚禮 SaaS，單一來源的腳本化爆破是主要威脅面，單實例限流已顯著提高門檻，且不需新增資料表／migration（維持 gate 穩定）。
- **升級路徑**：若實際出現濫用，改為 DB／KV 後端的共享限流（以 `login_attempts` 表或 Upstash Redis）。**目前接受單實例限制**。

### 其他知情項（非缺陷）
- **`rundown-items`（share）**：流程表內部備註（`supplies`／`note`／`roleTasks`）對所有簽名者可見。若日後在備註寫敏感事項（紅包箱交接等），需拆簽名 scope 或收回管理端。目前備註為一般流程資訊，接受。
- **公開寫入無限量**：`rsvp-public`／`blessings` 提交無數量上限，理論上可灌爆待審佇列。已有 presign／登入限流基礎設施，若出現濫用可比照套用。

---

## 部署檢查清單（上線前必確認）

- [ ] `NUXT_JWT_SECRET`、`NUXT_GUEST_LINK_SECRET` 已在 Vercel 設為高熵隨機值（未設會被 H1 守衛擋下無法啟動）
- [ ] `NUXT_AUTH_MODE` 未被設為 `open`（production 預設 enforced，勿覆蓋）
- [ ] `NODE_ENV=production`（Vercel 自動）
