# 營運手冊（issue #26）

正式站：<https://everafter-iota.vercel.app>（Vercel Hobby，region hnd1）
資料庫：Neon Free（Singapore，autoscaling 鎖 0.25CU）｜圖片：Cloudflare R2 bucket `wedding-host`

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

## 部署自動 migrate（issue #116）

`vercel.json` 的 `buildCommand` 在 build 前執行 `scripts/deploy-migrate.mjs`：

- `NUXT_DATABASE_URL_MIGRATE` **有值** → 對該 DB 套用 migrations；失敗即中止部署（不會出現「程式碼新、結構舊」的中間態）
- **未設定**（preview／本機 build）→ 印訊息跳過，不阻擋部署

Vercel 需設定環境變數 `NUXT_DATABASE_URL_MIGRATE`（**限 Production 環境**）＝ Neon **direct** DSN（pooled 主機名去掉 `-pooler`）。Preview 環境不設，preview build 就不會動到正式庫。

回滾注意：drizzle migrations 只前進不回退——帶 DROP 的 migration 合併前先確認影響（同 stacked PR 慣例）。此機制根治 0008／0009 兩次「部署了程式碼、漏了手動 migrate」事故。

## 常見故障排查

| 症狀 | 原因 | 處置 |
|---|---|---|
| push 到 main 後 Vercel 沒部署 | import 時 clone 出副本 repo，push 不觸發 auto-deploy | Vercel → Settings → Git 重連正牌 repo（檢查部署來源 commit 是否在本 repo） |
| 按 Redeploy 沒帶到新程式碼 | Redeploy 是重部署「該筆」的舊 build | 對最新 main 的 deployment 操作，或 push 空 commit 觸發 |
| 上線後 API 全 500 | secrets 環境變數缺漏或 `.env` 留空值覆蓋預設（如 `NUXT_JWT_SECRET=` 空字串） | 檢查 Vercel env：`NUXT_JWT_SECRET`／`NUXT_GUEST_LINK_SECRET`／`NUXT_DATABASE_URL`；`.env` 範本未填的 secret 必須註解掉不能留空值 |
| DB 連線錯誤 | pooled / direct 用途混用 | runtime 用 Neon pooled URL；migration 與腳本（db:migrate、db:create-admin）用 direct URL |
| 部署後名單／清單變空、桌次圖只剩 ID | schema 落後程式碼（自動 migrate 上線前的舊部署，或 build log 中 migrate 失敗） | 查 Vercel build log 的 `[deploy-migrate]` 段；必要時從 origin/main 的 worktree 手動 `NUXT_DATABASE_URL='<direct>' npm run db:migrate`，跑完查 `drizzle.__drizzle_migrations` 筆數複驗 |
| 圖片上傳失敗 | R2 四項環境變數不全 | `NUXT_R2_*` 四項 + `NUXT_PUBLIC_R2_PUBLIC_URL` 全填才啟用 presigned 直傳，否則退回 dataURL |
| 圖片上傳失敗、Console 報 CORS（`No 'Access-Control-Allow-Origin'`、`net::ERR_FAILED`） | R2 bucket 未設 CORS policy，跨來源 PUT 被 preflight 擋 | 見上節「R2 圖片直傳 CORS」，套用 [`r2-cors.json`](r2-cors.json) |
| 本機 push 卡 6 分鐘後失敗 | pre-push Docker gate 期間 SSH 閒置被 GitHub 斷線 | `~/.ssh/config` 的 `Host github.com` 加 `ServerAliveInterval 60`；push 後以 `git ls-remote` 驗證 |
