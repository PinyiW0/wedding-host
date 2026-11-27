# 營運手冊（issue #26）

正式站：<https://everafter-iota.vercel.app>（Vercel Hobby，region hnd1）
資料庫：Neon Launch（Singapore，autoscaling 鎖 0.25CU；2026-11-22 事故當天由 Free 升級）｜圖片：Cloudflare R2 bucket `wedding-host`

---

## 錯誤監控（Sentry）

DSN 未設定時 Sentry 完全停用（本機 dev / e2e 零影響），設定後自動啟用：

| 環境變數 | 作用 | 設定位置 |
|---|---|---|
| `NUXT_PUBLIC_SENTRY_DSN` | 前端（瀏覽器）錯誤上報 | Vercel → Settings → Environment Variables |
| `SENTRY_DSN` | 後端（Nitro server）錯誤上報 | 同上（兩個都填同一組 DSN 即可） |

- 建立專案：Sentry 免費方案 → Create Project → 選 Nuxt → 複製 DSN
- **DSN 必須在 build 前設定**（模組依環境變數條件載入，避免拖慢本機 dev／e2e）；設好後重新部署才生效
- Source maps 上傳（讓 stack trace 還原原始碼）目前未啟用；要開啟時在 `nuxt.config.ts` 補 `sentry: { org, project, authToken }` 並設 `SENTRY_AUTH_TOKEN`
- 已知限制：Vercel serverless 上後端自動 instrumentation 有限，後端錯誤以 Nitro 層捕捉為主；前端上報不受影響

## 健康檢查與外部監測

- 公開端點：`GET /api/v1/health` → 正常 `200 { status: 'ok', db: true }`；DB 連不上 `503 { status: 'degraded', db: false }`
- 建議用 [UptimeRobot](https://uptimerobot.com)（免費 50 個 monitor、5 分鐘間隔）監測 `https://everafter-iota.vercel.app/api/v1/health`，關鍵字告警設 `"status":"ok"`
- 婚禮當天前一晚手動打一次確認綠燈

## 外部服務硬上限（issue #230）

做設計決策、估成本時先對這張表（規則見 [`.claude/rules/design-decisions.md`](../.claude/rules/design-decisions.md)）。數字查證日期 2026-11-27；方案或定價變動時連同日期一起更新。

| 服務（方案） | 項目 | 每月上限 | 超過後 | 查用量的位置 |
|---|---|---|---|---|
| Neon（Launch，現用） | 傳輸量（資料庫往外送的位元組） | 每個專案含 500GB | **照用量計費**（每 GB 0.10 美元），不暫停 | Neon Console → Billing／專案 Monitoring |
| Neon（Free，2026-11-22 前） | 傳輸量 | 每個專案 5GB | **資料庫暫停**，到下個計費週期或升級才恢復 | 同上 |
| Neon（Free） | 運算時數 | 100 CU-hours（選型當時查到的數字，本次未重新查證） | 資料庫暫停 | 同上 |
| Vercel（Hobby，現用） | 流量（Fast Data Transfer） | 100GB | **不計費，帳號可能被暫停**，所有部署一起停；多數情況要等 30 天 | Vercel → Usage |
| Vercel（Hobby） | 函式呼叫次數 | 100 萬次 | 同上 | 同上 |
| Cloudflare R2（免費額度） | 儲存（Standard） | 10GB | **照用量計費**（每 GB 0.015 美元） | Cloudflare → R2 → 用量 |
| Cloudflare R2 | 寫入類請求（Class A） | 100 萬次 | 照用量計費（每百萬次 4.50 美元） | 同上 |
| Cloudflare R2 | 讀取類請求（Class B） | 1,000 萬次 | 照用量計費（每百萬次 0.36 美元） | 同上 |
| Cloudflare R2 | 往外傳輸 | 不計費 | — | — |
| LINE 官方帳號（輕用量） | 主動推播則數（push／multicast，則數 = 次數 × 收件人數） | 200 則 | **推播發不出去**，不可加購，要升級方案 | LINE Official Account Manager；程式面 `server/utils/line.ts` 會查 `message/quota` |

- 「超過後」分兩種：**照用量計費**（服務不中斷，帳單變大）與**直接停**（服務中斷）。直接停的那幾項要優先設告警。
- Neon 的傳輸量算的是「資料庫 → 伺服器」這一段，瀏覽器收到的回應大小看不出來；每一輪輪詢的讀出量由 `test/e2e/vibe/perf-polling-db-payload-1.spec.ts` 的預算測試守住。
- 已設告警：Neon 用量通知 5 美元（2026-11-26）。Vercel Hobby 沒有可設金額的告警，婚禮前一週手動看一次 Usage。
- 資料來源：[Neon 方案](https://neon.com/docs/introduction/plans)、[Neon 傳輸量](https://neon.com/docs/introduction/network-transfer)、[Vercel Hobby](https://vercel.com/docs/plans/hobby)、[R2 定價](https://developers.cloudflare.com/r2/pricing/)、[LINE Messaging API 計費](https://developers.line.biz/en/docs/messaging-api/pricing/)。LINE 台灣方案的 200 則來自非官方整理，官方開發者頁面沒有列台灣的數字，以 LINE Official Account Manager 顯示的額度為準。Vercel 的運算時間（Active CPU）上限本次沒有查到官方數字，未列入。

## 婚禮當天處置手冊（issue #230）

先判斷是哪一種狀況，再照對應的步驟做。兩種狀況的第一步相同：開 `https://everafter-iota.vercel.app/api/v1/health`。

| 健康檢查結果 | 狀況 |
|---|---|
| `503`、`db: false` | A：資料庫連不上 |
| `200`、`db: true`，但接待頁跳「資料載入失敗」 | B：接待頁載入失敗 |
| 打不開、逾時，或 Vercel 的錯誤頁 | C：Vercel 端的問題 |

### 狀況 A：資料庫被暫停或連不上

2026-11-22 實際發生過：Neon Free 傳輸量超過 5GB，資料庫被暫停，全站無法登入。

1. 開 Neon Console，看專案狀態與 Billing 的用量。
2. 專案顯示被暫停、用量超過額度 → 在 Billing 升級方案（Free → Launch）。11/22 當天就是這樣恢復的。
3. 再開一次健康檢查，確認回 `200`、`db: true`。
4. 請接待員重新整理接待頁，確認名單出現。
5. 用量不是原因（方案已是 Launch、專案狀態正常）→ 看 Neon 的狀態頁 <https://neonstatus.com>；是服務商故障就改用紙本名單，不要一直重試。
6. 事後查是哪一支端點讀出大量資料：本機跑 `perf-polling-db-payload-1.spec.ts`，並看 Neon Monitoring 的傳輸量曲線從哪一天開始上升。

### 狀況 B：接待頁跳「資料載入失敗」

1. 換一台裝置或無痕視窗開接待頁。只有一台壞 → 那台重新登入；全部都壞 → 往下做。
2. 開瀏覽器開發者工具的 Network，找出回 `500` 或 `403` 的那支請求。
3. `403` → 帳號權限問題。確認登入的是接待帳號、網址的 `weddingId` 是這一場（案例：issue #222）。
4. `500` → 多半是新 migration 沒套用。照下方「常見故障排查」的「某頁一進去就跳『資料載入失敗』」那一列處理。
5. 十分鐘內修不好 → 在 Vercel → Deployments 找上一個正常的 Production 部署，按 Promote to Production（回滾）。回滾不會還原資料庫結構，帶 migration 的版本要先確認舊程式碼能配新結構。

### 狀況 C：Vercel 端的問題

1. 開 Vercel → 專案 → Deployments，看最新的 Production 部署是不是 Ready。
2. 部署失敗 → 對上一個 Ready 的部署按 Promote to Production。
3. 帳號顯示被暫停（超過 Hobby 上限）→ 只能升級 Pro 或聯絡 Vercel；等待期間改用紙本名單。
4. 部署正常但全站打不開 → 看 <https://www.vercel-status.com>。

### 事前準備（婚禮前一天）

1. 打一次健康檢查，確認 `200`。
2. 看 Neon 與 Vercel 的當月用量，用量超過上限的七成就先處理（升級方案，或查是哪裡在耗用）。
3. 在後台 RSVP 頁匯出 CSV、在桌次頁下載桌次圖，印成紙本交給接待組長。
4. 確認接待帳號能登入，接待頁能載入名單。

目前沒有離線備援：資料庫斷線時接待頁不能報到，只能靠紙本名單，事後補登。

## 管理員密碼救援

新人／接待帳號的密碼重設走管理端 UI（`/users`、婚禮內「帳號設定」）。**管理者自己的密碼 UI 改不到**（`/users` 只列新人帳號），忘記密碼或要換密碼時直接改 DB（2026-07 實測流程）：

```bash
# 1) 本機算新密碼的 scrypt 雜湊（與 server/utils/password.ts 同格式）
read -s "PW?新密碼（至少 8 碼）: "; echo
PW="$PW" node -e 'const {randomBytes,scryptSync}=require("node:crypto");const s=randomBytes(16);console.log(`scrypt$${s.toString("hex")}$${scryptSync(process.env.PW,s,64).toString("hex")}`)'
unset PW
```

```sql
-- 2) Neon Console → SQL Editor，貼上整串 scrypt$...（username 大小寫敏感）
update users set password_hash = '貼上雜湊' where username = 'andrea' and deleted_at is null;
-- 顯示 UPDATE 1 = 成功；UPDATE 0 = 沒對到帳號，先 select username from users 確認
```

> `npm run db:create-admin` 只能**新建**管理員（同 username / email 會直接退出，不會覆蓋密碼），適用於全新部署開通或增加第二位管理員；需要 Neon direct（非 pooled）連線字串。`/register` 在正式環境已收斂，系統有管理員後需管理員登入才能再建。

> 登入頁已不提供註冊入口（issue #38，防止誤導）：全新部署的首次開通請直接輸入 `/register` 網址建立第一個管理員——系統無任何管理員時該端點開放，之後自動收斂。

## R2 圖片直傳 CORS

瀏覽器從前端站直傳圖片到 R2 是**跨來源**請求，bucket 必須設 CORS policy 允許來源的 PUT，否則 Console 報 `No 'Access-Control-Allow-Origin'`、圖片一律上傳失敗（issue #50，非程式碼問題）。

設定：Cloudflare → R2 → `wedding-host` → Settings → CORS Policy，貼上 [`r2-cors.json`](r2-cors.json)。**新增前端部署網址（如 Vercel preview）時，把該 origin 加進 `AllowedOrigins` 再重貼。**

跨來源**讀取**也靠同一份設定（`AllowedMethods` 的 `GET`）：故事頁花圈要讀花圖的像素來裁掉空白、後台要把花圖打包下載。來源不在 `AllowedOrigins` 時，花圖仍會顯示，但不會裁切（花看起來偏小），後台下載會跳「花朵下載失敗」。

## 賓客手繪花存 R2（issue #226）

賓客在回覆表單畫的花由伺服器收下後轉存 R2（`weddings/<weddingId>/flower/<uuid>.png`），`guests.flower_drawing` 只存網址。瀏覽器照舊送 PNG dataURL，伺服器檢查格式與大小（上限 300KB）後才寫入。公開回覆頁不帶簽章、拿不到 presigned URL，所以這一種圖不走瀏覽器直傳。

| 環境 | 行為 |
|------|------|
| R2 已設定（正式站） | 轉存 R2，資料庫存 `https://` 網址 |
| R2 未設定、`authMode=open`（本機 dev／E2E） | dataURL 原樣存資料庫 |
| R2 未設定、`authMode=enforced` | 回 503，不讓 base64 進資料庫 |

投影照片與自訂花圖（管理端）在 enforced 環境只收網址，送 `data:` 內容回 400。

賓客重新送出回覆並重畫時，舊的那張圖會留在 R2 沒人引用（不清理；一張約 25KB）。

### 一次性搬移既有花圖

issue #226 上線前落庫的花圖是 base64，要搬一次。**程式先部署、再搬**：新版程式兩種格式都能顯示，順序反過來的話舊版程式仍會把新回覆寫成 base64。

1. 確認正式站已是 #226 之後的版本（Vercel → Deployments → Production 的 commit）。
2. 準備六個環境變數：`NUXT_DATABASE_URL`（Neon 連線字串）與 R2 五項（`NUXT_R2_ENDPOINT`、`NUXT_R2_ACCESS_KEY_ID`、`NUXT_R2_SECRET_ACCESS_KEY`、`NUXT_R2_BUCKET`、`NUXT_PUBLIC_R2_PUBLIC_URL`），值與 Vercel Production 相同。
3. 試跑（只讀資料庫、不寫入；試跑只需要 `NUXT_DATABASE_URL`）：

   ```bash
   NUXT_DATABASE_URL='postgresql://...' node scripts/migrate-flowers-to-r2.mjs
   ```

   確認印出的「資料庫主機」是 Neon（不是 `localhost`），「待搬移」筆數符合預期（2026-11-26 是 38 筆）。
4. 真的搬（六個環境變數都要帶）：

   ```bash
   node scripts/migrate-flowers-to-r2.mjs --apply
   ```

5. 驗證：
   - 腳本最後一行印「仍是 base64 的 0 筆」。
   - 再執行一次 `--apply`，印「待搬移：0 筆」「已搬移：0 筆」。
   - Neon SQL Editor 執行 `select pg_size_pretty(sum(pg_column_size(flower_drawing))) from guests;`，結果應從約 938 kB 降到幾 kB。
   - 開故事頁，花圈的花有顯示、大小與搬移前相同；開後台 RSVP 頁，「下載全部花朵」能下載 zip。

腳本可重複執行：只挑 `data:` 開頭的列，搬過的不會再動。中途中斷直接重跑即可。每一筆寫進 R2 後，腳本先確認公開網址讀得到才改資料庫；第一筆就失敗（金鑰或 `NUXT_PUBLIC_R2_PUBLIC_URL` 帶錯）會直接停下，資料庫不會被改。搬移會把花圖從 Neon 讀出一次（約 1MB 傳輸量）。

## 部署自動 migrate（issue #116、#134）

`vercel.json` 的 `buildCommand` 在 build 前執行 `scripts/deploy-migrate.mjs`，依環境分流：

| `NUXT_DATABASE_URL_MIGRATE` | `VERCEL_ENV` | 行為 |
|---|---|---|
| 有值 | 任意 | 套用 migrations；失敗即中止部署（不會出現「程式碼新、結構舊」的中間態） |
| 未設定／空字串 | `production` | **中止部署**（exit 1），build log 印出缺哪個變數與去哪設 |
| 未設定／空字串 | `preview` 或無（本機 build） | 印訊息跳過，不阻擋部署——preview build 不該碰正式庫 |

Vercel 需設定環境變數 `NUXT_DATABASE_URL_MIGRATE`（**限 Production 環境**）＝ Neon **direct** DSN（pooled 主機名去掉 `-pooler`）。Preview 環境不設。

**確認機制真的有在跑**：Vercel build log 搜 `[deploy-migrate]`——

- `套用 migrations 至部署目標資料庫…` → 正常運作
- `跳過 migrate（VERCEL_ENV=…）` 出現在 **production** build → 不該發生，代表環境變數掉了（#134 後會直接 fail build，不會再靜默通過）

行為分流由 `test/unit/deploy-migrate.spec.ts` 守護，CI 每個 PR 都跑。

回滾注意：drizzle migrations 只前進不回退——帶 DROP 的 migration 合併前先確認影響（同 stacked PR 慣例）。

> 此機制的由來：0008／0009 兩次「部署了程式碼、漏了手動 migrate」事故催生 #116；但 #116 的靜默跳過設計加上 Vercel Production 從未設定該變數，讓機制上線後一次都沒執行過，直到 0010（`gift_categories`）漏套用、婚禮小物頁跳「資料載入失敗」才被發現——於是有了 #134 的 fail-fast。**「機制已上線」不等於「有在跑」，判準永遠是 build log。**

## 常見故障排查

| 症狀 | 原因 | 處置 |
|---|---|---|
| push 到 main 後 Vercel 沒部署 | import 時 clone 出副本 repo，push 不觸發 auto-deploy | Vercel → Settings → Git 重連正牌 repo（檢查部署來源 commit 是否在本 repo） |
| 按 Redeploy 沒帶到新程式碼 | Redeploy 是重部署「該筆」的舊 build | 對最新 main 的 deployment 操作，或 push 空 commit 觸發 |
| 上線後 API 全 500 | secrets 環境變數缺漏或 `.env` 留空值覆蓋預設（如 `NUXT_JWT_SECRET=` 空字串） | 檢查 Vercel env：`NUXT_JWT_SECRET`／`NUXT_GUEST_LINK_SECRET`／`NUXT_DATABASE_URL`；`.env` 範本未填的 secret 必須註解掉不能留空值 |
| DB 連線錯誤 | pooled / direct 用途混用 | runtime 用 Neon pooled URL；migration 與腳本（db:migrate、db:create-admin）用 direct URL |
| 某頁一進去就跳「資料載入失敗」toast | 該頁某支 GET 撞不存在的表或欄位而 500，多半是新 migration 沒套用（如 #134 的 `gift_categories`） | 比對 `ls server/db/migrations/*.sql` 與正式庫 `drizzle.__drizzle_migrations` 筆數，差幾筆就補跑 migrate |
| 部署後名單／清單變空、桌次圖只剩 ID | schema 落後程式碼（自動 migrate 上線前的舊部署，或 build log 中 migrate 失敗） | 查 Vercel build log 的 `[deploy-migrate]` 段；必要時從 origin/main 的 worktree 手動 `NUXT_DATABASE_URL='<direct>' npm run db:migrate`，跑完查 `drizzle.__drizzle_migrations` 筆數複驗 |
| 花圈的花偏小、後台「花朵下載失敗」 | 目前網址不在 R2 CORS 的 `AllowedOrigins` | 見「R2 圖片直傳 CORS」，把來源加進 [`r2-cors.json`](r2-cors.json) 再重貼 |
| 圖片上傳失敗 | R2 四項環境變數不全 | `NUXT_R2_*` 四項 + `NUXT_PUBLIC_R2_PUBLIC_URL` 全填才啟用 presigned 直傳，否則退回 dataURL |
| 圖片上傳失敗、Console 報 CORS（`No 'Access-Control-Allow-Origin'`、`net::ERR_FAILED`） | R2 bucket 未設 CORS policy，跨來源 PUT 被 preflight 擋 | 見上節「R2 圖片直傳 CORS」，套用 [`r2-cors.json`](r2-cors.json) |
| 本機 push 卡 6 分鐘後失敗 | issue #178 前 pre-push 跑 Docker gate 全量，期間 SSH 閒置被 GitHub 斷線（現在只跑煙霧，較少發生） | `~/.ssh/config` 的 `Host github.com` 加 `ServerAliveInterval 60`；push 後以 `git ls-remote` 驗證 |
