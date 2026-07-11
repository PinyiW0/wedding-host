# 產品化準備評估與 Roadmap（issue #36）

EverAfter 目前定位為**個人＋朋友使用**。本文件回答一個問題：**如果有一天要商業化，要補什麼、怎麼執行、什麼訊號出現才做**——它同時是未來的執行藍圖，也是架構取捨的紀錄（為什麼現在刻意不做這些事）。

> 最後更新：2026-07-11。系統現況見 [architecture.md](architecture.md)，日常維運見 [ops.md](ops.md)。

**核心論點：商業化不需要重寫架構。** 租戶邊界（`weddingId` 全域分片鍵）與集中授權（`server/utils/route-auth.ts`）從第一天就存在，方案分層、金流、合規都是在這個邊界上**疊加**能力，不是推倒重來。因此下面每一節的形式都是「現況 → 要補什麼 → 怎麼做 → 什麼訊號才做」，決策掛在訊號上，不是掛在想像上。

---

## 1. 現況盤點：已具備的產品化基礎

這些不是規劃，是已經在跑的東西：

| 面向 | 現況 |
|------|------|
| 多租戶資料模型 | 25 張表全部以 `weddingId` 為鍵＋index（shared-schema multi-tenancy，SaaS 標準起手式） |
| 集中授權 | `route-auth.ts` 統一判定三種存取層級（JWT 使用者／HMAC 簽名分享連結／賓客專屬連結）＋ admin、receptionist 角色 |
| 資料庫 | PostgreSQL（Neon）＋ Drizzle migrations，結構有版本控制 |
| 錯誤監控 | Sentry（前後端，DSN 未設自動停用） |
| 物件儲存 | Cloudflare R2 presigned 直傳，未設定退回 dataURL |
| LINE 整合 | Login 綁定＋謝卡 multicast（每批 ≤500、發送前過濾無效 userId） |
| 測試守門 | 94 條 E2E（`playwright.gate.config.ts`）＋ pre-push gate＋CI build |
| 部署 | Vercel SSR＋Docker（本機），`authMode` 雙模式隔離 dev/e2e 與 production |

**刻意沒做的**（也是本文件的目錄）：方案分層、金流、email 驗證／忘記密碼、個資合規文件、背景任務佇列、staging 環境。以下逐節展開。

---

## 2. 方案分層（Plans & Entitlements）——執行規劃

### 2.1 商業模式先行：買斷制，不是訂閱

婚禮是一次性事件，**一場婚禮買斷一次**比月費訂閱更貼合使用情境，也大幅簡化工程：不用處理定期扣款失敗、方案降級退費（proration）、續約提醒。這個決定直接影響金流選型（§3 不需要藍新的定期定額產品）。

方案先切兩層就好，避免過早細分：

| 能力 | Free | Premium（單場買斷） |
|------|------|------|
| 婚禮場數 | 1 場 | 1 場（每場獨立購買） |
| 賓客數上限 | 30 位 | 無上限 |
| 謝卡 LINE 群發 | 不可用 | 可用 |
| 投影／公開頁 | 帶 EverAfter 浮水印 | 無浮水印 |
| 接待員帳號 | 1 組 | 不限 |

> 上表是示意矩陣，實際數字等有定價策略再定。重點是**維度**：數量上限、功能開關、品牌露出，三類就夠。

### 2.2 Entitlement 層設計

Entitlement（權益檢查）是在 API 入口多問一句「你的方案允許這個動作嗎」——就像 `route-auth.ts` 現在問「你有沒有權限碰這場婚禮」一樣，是薄薄一層，不動資料架構。

設計原則：

- **限制矩陣集中一處**：`server/utils/entitlements.ts` 定義 `PLAN_LIMITS` 常數＋`requireEntitlement(wedding, feature)` helper，不把數字散在各 handler
- **統一錯誤語彙**：超限一律回 `403` ＋ 機器可判的 error code（如 `PLAN_LIMIT_EXCEEDED`），前端據此顯示升級 CTA，而不是每個 API 各自發明錯誤格式
- **檢查放寫入端**：只擋「建立第 31 位賓客」「觸發群發」這類寫入動作；讀取不擋（已建立的資料永遠看得到，避免鎖資料勒索感）

### 2.3 實作步驟

1. `weddings` 表加 `plan` 欄位（`text`，default `'free'`）＋ migration；既有朋友的婚禮 backfill 為 `'premium'`
2. 建 `server/utils/entitlements.ts`：限制矩陣常數＋檢查 helper
3. 在受限的寫入 API handler 加檢查（預估 <10 支：賓客建立、謝卡群發、接待帳號建立）
4. 前端：`useEntitlements()` composable 讀 `wedding.plan`，超限操作顯示升級提示；攔 `PLAN_LIMIT_EXCEEDED` 統一導向方案頁
5. E2E：free 方案撞上限 → 看到升級提示 → （§3 完成後）付款 → 解鎖，寫成 spec

**觸發訊號：決定開始收費的那一刻。** 在那之前 `plan` 欄位都不需要存在——這正是租戶邊界已就位帶來的底氣。

---

## 3. 金流：藍新金流（NewebPay）——執行規劃

### 3.1 選型與串接方式

採**藍新 MPG（Multi Payment Gateway）幕前支付**：建立訂單後把加密參數 form POST 到藍新收銀台，使用者在藍新頁面完成付款（信用卡／ATM／超商都吃這一支），藍新再回呼我們。買斷制（§2.1）所以**不需要**「信用卡定期定額」產品線。

串接規格重點：

- 參數以 `TradeInfo`（AES-256-CBC 加密的交易資料）＋`TradeSha`（SHA256 檢查碼）傳遞，金鑰為商店的 `HashKey`/`HashIV`——**只放環境變數**（`NUXT_NEWEBPAY_HASH_KEY` 等），比照現有 R2/LINE 憑證管理
- 回呼有兩條：`ReturnURL`（瀏覽器導回，**只做顯示**）與 `NotifyURL`（server-to-server 幕後通知，**唯一的入帳依據**）
- 測試環境：藍新測試站註冊測試商店取得測試 `MerchantID`／金鑰，端點 `ccore.newebpay.com`，正式為 `core.newebpay.com`——比照 `authMode` 的精神，用環境變數切換、本機未設定時金流功能整段停用

### 3.2 訂單資料表與冪等

新增 `orders` 表（延續現有 schema 慣例）：

```
orders: orderId (= 藍新 MerchantOrderNo，primary key)、weddingId、plan、
        amount、status ('pending' | 'paid' | 'failed')、tradeNo (藍新交易序號)、
        paidAt、rawNotify (jsonb，原始通知存證)、createdAt
```

`NotifyURL` webhook 的處理順序（這裡是金流工程的生死線）：

1. 驗 `TradeSha`——驗不過直接丟棄（防偽造通知）
2. 解密 `TradeInfo`，以 `MerchantOrderNo` 撈訂單
3. **冪等檢查**：訂單已是 `paid` 就直接回 200 結束（藍新會重送通知，重複入帳＝事故）
4. **金額比對**：通知金額 ≠ 訂單金額 → 標記異常、不入帳（金額永遠以 server 建單時為準，不信任何前端值）
5. 更新 `orders.status` → 更新 `weddings.plan` → entitlement 立即生效（同一交易內完成）

### 3.3 流程全景

```
使用者按「升級」 → POST /api/v1/orders（server 建單、算加密參數）
  → 前端 form POST 到藍新收銀台 → 使用者付款
  → 藍新打 NotifyURL（幕後，入帳依據） → 驗簽/冪等/比對金額 → plan 生效
  → 藍新導回 ReturnURL（幕前） → 顯示結果頁（只讀 orders.status，不做任何狀態更新）
```

### 3.4 發票與對帳

- 電子發票走藍新旗下 **ezPay 加值中心** API，付款成功後開立；B2C 存證發票即可，先做「付款成功自動開立」一條路，作廢／折讓初期用 ezPay 後台手動處理
- 對帳：初期用藍新商店後台報表 vs `orders` 表人工核對（每月一次）；退款先手動（藍新後台操作＋手動降 `plan`），有量再 API 化

**觸發訊號：§2 entitlement 層完成、且定價已定。** 順序不能倒過來——先有「付了錢解鎖什麼」，才有「怎麼收錢」。

---

## 4. 認證強化——未來優化方向

**現況**：自建 scrypt 密碼雜湊（`server/utils/password.ts`，Node 內建免依賴）＋ JWT Bearer（`jwt.ts`）＋ LINE Login 綁定＋接待員獨立帳密（`receptionAccounts`）。朋友圈使用完全夠格，且 scrypt＋鹽的選擇是正確的。

**要補的**（缺一不可才能收陌生人的錢）：

- **Email 驗證＋忘記密碼**：需要寄信服務（Resend 或 SES），這是目前完全沒有的能力
- **登入頻率限制**：login endpoint 加 rate limiting（同 IP／同帳號），擋暴力嘗試
- **Token 撤銷**：目前 JWT 到期前無法作廢；補 refresh token 機制或維護撤銷清單，處理「裝置遺失」「帳號被盜改密碼」場景

**方向判斷：屆時評估買而不是做**（Clerk／Supabase Auth／Auth.js）。理由：認證出包是致命傷、又不是本產品的差異化。但有一個保留條件——LINE Login 是台灣婚禮場景的硬需求且已自建可用，遷移時必須確認外包方案能掛 LINE OAuth，否則採混合式（帳密外包、LINE 綁定自留）。

**觸發訊號：第一個「非朋友」的使用者出現。** 朋友忘記密碼可以直接找你，陌生人不行。

---

## 5. 個資保護與合規——未來優化方向

這是本產品**最特殊的風險**：系統存的不是使用者自己的資料，而是**賓客（第三者）的個資**——姓名、電話、飲食禁忌、親屬關係、LINE userId。新人上傳賓客名單時，賓客本人並不知情。台灣個資法之下，商業化前這一節是硬門檻，不是加分項。

**要補的**：

- **隱私權政策＋使用條款**：載明蒐集項目、目的、保存期限，並要求新人（資料上傳者）確認已盡告知義務
- **資料生命週期**（已決策 2026-07：**婚禮結束 12 個月後匿名化、不刪除**）：抹去賓客可識別欄位（姓名、電話、LINE userId 等），保留統計結構（人數、桌次、飲食分佈），讓新人的回顧資料不受影響；schema 已有 `deletedAt` 軟刪除，缺的是到期匿名化的排程任務（Vercel cron＋一支清理 endpoint）；賓客簽名連結的去留是實作時的設計點——連 guestId 一起輪換可讓舊連結失效，只抹欄位則連結仍可開但只見匿名資料
- **當事人權利**：賓客要求查詢／刪除自己資料的處理管道（初期人工信箱即可，但政策要先寫）
- **備份與加密**：Neon 的 PITR（時間點還原）確認開啟並記入 [ops.md](ops.md)；傳輸已是 HTTPS，靜態加密確認雲端方案涵蓋
- **存取軌跡**：admin 代操作（§7）上線時同步加 audit log——誰在什麼時候看／改了哪場婚禮的資料

**觸發訊號：對外開放註冊之前——這節必須先完成。** 它是清單裡唯一「訊號出現再做就太遲」的項目。

---

## 6. 婚禮當天尖峰可靠性——未來優化方向

這個產品的負載模式很極端：**平日趨近於零，婚禮當天中午兩三個小時是生死線**——報到、祝福牆、投影輪播、謝卡群發全擠在同一個時段。掛掉不是「稍後再試」，是毀掉別人的婚禮。

**現況**：謝卡 multicast 已分批（≤500／批）＋發送前過濾無效 userId；圖片走 R2 presigned 直傳不過 server；Neon autoscaling 鎖 0.25CU（省錢設定）。

**要補的**：

- **群發改背景任務**：目前批次發送在同一個請求內同步執行，量大時會撞 serverless timeout。改成 job 佇列（Vercel 環境下評估 QStash／Trigger.dev／Nitro tasks），帶失敗重試與進度回報，`thankYouBatchSends` 表已有存放進度的雛形
- **尖峰前的資源準備**：Neon 0.25CU 是平日設定；建立「婚禮日 runbook」——前一天調升 DB 資源、確認 Sentry 安靜、跑一次 gate。一人團隊的可靠性靠 checklist，不靠值班
- **壓測**：k6 腳本模擬單場尖峰（200 位賓客半小時內報到＋投影頁同時輪詢），實測找出第一個瓶頸再優化，不預先猜
- **投影／祝福牆的讀取效率**：確認輪詢間隔與查詢有走 `weddingId` index，必要時加短 TTL 快取——但等壓測數據說話

**明確不做的**：微服務、讀寫分離、多區部署。單台 Postgres 服務數百場婚禮綽綽有餘，這些是「同時進行的婚禮上百場」才需要面對的題目。

**觸發訊號：同一天出現兩場以上真實婚禮。** 在那之前，單場的量現有架構直接吃得下。

---

## 7. 營運與交付——未來優化方向

**現況**：CI 有 build（`push.yml`）＋ sdd-review；pre-push 跑完整 gate；Sentry 監控；[ops.md](ops.md) 維運手冊。

**要補的**：

- **Staging 環境**：Vercel preview deployment 已是雛形，補一個固定 staging＋獨立 Neon branch 資料庫，讓 migration 先在 staging 跑過再上 production（目前 migration 直上正式站，個人使用可接受、收費後不行）
- **Uptime 監控**：外部探測（UptimeRobot／Better Stack 免費層打 `/api/v1/health`，端點已存在）——Sentry 抓得到錯誤，抓不到「整站沒回應」
- **客服後台**：admin 角色已存在，擴充「跨婚禮查詢＋代操作」能力（賓客名單救援、連結重發），並掛 §5 的 audit log
- **Onboarding**：新註冊使用者一鍵建立範本婚禮（示範賓客／桌次／流程），空白系統是流失的第一名；`server/db/seed.ts` 的種子資料可直接改造成範本
- **結構化 log**：serverless 環境下先靠 Sentry breadcrumb 撐，等有客服需求（「我剛剛按了什麼結果不見了」）再上結構化查詢

**觸發訊號：付費使用者 > 0 → staging＋uptime 先行；第一張客訴 → 客服後台。**

---

## 8. 觸發點總表

執行順序總覽（上面各節的濃縮）。原則：**合規先於收錢，收錢先於擴容。**

| 訊號 | 動作 | 對應章節 |
|------|------|---------|
| 決定開始收費 | 隱私權政策＋條款＋資料生命週期（先）→ 方案分層 → 藍新金流 | §5 → §2 → §3 |
| 第一個非朋友使用者 | Email 驗證／忘記密碼／rate limiting／token 撤銷 | §4 |
| 付費使用者 > 0 | Staging 環境＋uptime 監控 | §7 |
| 第一張客訴 | 客服後台＋audit log | §7、§5 |
| 同一天兩場以上婚禮 | 群發佇列化＋婚禮日 runbook＋壓測 | §6 |
| 同時服務婚禮上百場 | 才回頭談讀寫分離、快取層 | §6（明確不做清單解封） |

沒有訊號出現的項目就維持現狀——**「知道要做什麼而選擇還不做」是這份文件存在的目的。**
