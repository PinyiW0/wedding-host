# 系統架構總覽

EverAfter 婚禮管理系統——一人 full-stack 的婚禮 SaaS。本文件描述**目前實際運行的系統架構**（以程式碼為準），開發流程（SDD）另見 `doc/frontend/frontend-workflow.md`，日常維運見 [ops.md](ops.md)，產品化評估與 roadmap 見 [production-readiness.md](production-readiness.md)。

> 最後更新：2026-07-09。repo 名 `nuxt4-template` 為模板出身，產品名為 EverAfter。

---

## 1. 高層架構

Nuxt 4 單體（monolith）：前端 Vue SSR 與後端 Nitro API 同一個應用、同一次部署。資料庫 PostgreSQL，外部服務皆為可選（未設定時自動退回本機相容行為）。

```
        管理者 / 新人 / 接待員                賓客（免登入，HMAC 簽名連結）
              │ JWT Bearer                        │ ?sig= → X-Guest-Sig
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nuxt 4 應用（Vercel SSR）                     │
│                                                                 │
│  app/（Vue 3 + NuxtUI）          server/（Nitro）                │
│  ├─ pages/    後台·接待·公開·投影  ├─ middleware/auth.ts  統一授權  │
│  ├─ api/      client API 包裝層   ├─ api/v1/**          105 支    │
│  ├─ types/api API 合約型別        │   route handler（務實 CRUD）   │
│  └─ stores/   auth（persisted）   └─ db/ Drizzle schema（25 表）  │
└──────────┬──────────────┬──────────────┬──────────────┬─────────┘
           ▼              ▼              ▼              ▼
     PostgreSQL      Cloudflare R2    LINE 平台         Sentry
     （Neon／本機      （圖片 presigned  （謝卡 multicast   （錯誤監控，
      docker 5433）    直傳，可退回      ＋Login 綁定，    DSN 未設即停用）
                       dataURL）        可退回 mock）
```

結構性主軸有兩條，理解它們就理解大半個系統：

- **`weddingId` 是全域分片鍵**：幾乎所有 API 都掛在 `/api/v1/weddings/[weddingId]/` 下，每張表都有 `weddingId` 欄位＋index。它同時是資料分區邊界與授權邊界。
- **雙模式 `authMode`**：`enforced`（production 預設，無 token 401、賓客連結驗簽）與 `open`（dev/e2e 預設，退回預設管理員、免驗簽）。同一套 middleware 依模式切換，是「mock 使用者為何還存在」的原因。

---

## 2. 使用者角色與四種 UI 端

角色為中文字串（存於 DB 與 JWT payload）：

| 角色 | 權限範圍 | 登入來源 |
|------|---------|---------|
| `管理者` | 跨所有婚禮一律放行；唯一能進 `/users`、`/weddings` 列表 | `users` 表 |
| `新人` | 僅能存取自己 `ownerId` 的婚禮 | `users` 表（綁 `weddingId`） |
| `接待員` | 綁定單一婚禮，僅白名單動作（報到、禮金、喜餅發放、審核祝福） | `reception_accounts` 表 |
| 賓客 | 免登入，靠 HMAC 簽名連結取得個人／婚禮層級資料 | 無帳號 |

對應四種 UI 端（layout 區分）：

| 端 | layout | 頁面 |
|----|--------|------|
| 後台管理 | `default`（側邊欄殼層） | `/weddings/[weddingId]/` 下：總覽、賓客、桌次、流程、RSVP×3、喜餅、小物、祝福審核、謝卡、LINE、帳號；全域 `/weddings`、`/users`、`/reception` |
| 賓客公開頁 | `guest`（行動優先，導覽列依簽名等級給項目） | `/rsvp/[guestId]`、`/rsvp/public/[weddingId]`、`/checkin`、`/blessing/`、`/flowers/`、`/thankyou/`、`/schedule/`（賓客版流程）、`/rundown/`（工作人員版流程）、`/guest/[guestId]/bind` |
| 認證 | `auth`（置中卡片） | `/login`、`/register` |
| 投影牆 | `false`（全螢幕） | `/projection/[weddingId]` |

---

## 3. 前端架構（`app/`）

### 3.1 API 合約層（前端的骨幹）

三層疊起來構成「型別即合約」：

```
app/types/api/*.ts   21 個 domain 型別檔 + index.ts barrel
        │              命名慣例：XxxListItem（列表投影）/ XxxBody（request）/ XxxEvent（response）
        ▼
app/api/*.api.ts     per-domain client 包裝（listGuests、createGuest…），路徑內嵌 /api/v1
        │              index.ts barrel，頁面統一 import { … } from '~/api'
        ▼
useHttp()            統一 HTTP 入口（app/composables/useHttp.ts）
                       get     → useFetch（reactive，url 可傳 getter）
                       getOnce → $fetch（一次性，如 Blob 下載）
                       post/put/patch/delete → $fetch
```

`useHttp` 統一注入：`baseURL`（`runtimeConfig.public.apiBase`）、`Authorization: Bearer`（登入才帶）、公開頁自動把 `?sig=` 透傳為 `X-Guest-Sig` header；401 時 `clearAuth()` 導回 `/login`。

規範：**元件內禁止定義 local interface，一律 import `~/types/api/`**；讀取用 `useFetch`（經 `get`）、寫入用 `$fetch`（經 `post` 等）。

### 3.2 狀態管理

Pinia store 只有一個：`app/stores/auth.ts`（`useAuthStore`，setup store），存 `user` + `accessToken`，`pinia-plugin-persistedstate` 持久化到 localStorage。**其餘 domain 狀態不進 store**——各頁面用 client API 直接抓，情境資料用 composable（`useCurrentWedding` 依路由 weddingId 惰性抓婚禮）。

### 3.3 路由守衛

唯一守衛 `app/middleware/auth.global.ts`：

- 僅 client 執行（登入態在 localStorage，SSR 讀不到會誤判）
- 公開頁 pattern 放行 → 未登入導 `/login` → 角色守衛（接待員只留接待台＋祝福審核；`/users` 僅管理者；新人只能進自己的婚禮）
- 根路由 `/` 由 `index.vue` 依角色重導
- 前端守衛只是 UX 層，**真正的授權在後端 middleware**（見 §4.2）

### 3.4 元件與 design token

- `components/common/`（7 個跨頁原子）：`PageHeader`、`EmptyState`、`StatCard`、`StatusBadge`、`ConfirmModal`、`ListContainer`、`FileUpload`；根層放綁定業務、後台＋公開頁共用的複合元件（`RsvpForm`、`ThankYouCardPreview`、`GuestLinkCenter`…）。auto-import 無目錄前綴（`pathPrefix: false`）。
- 設計系統 "Editorial Luxe"（米色 cream＋墨黑 ink＋金箔 gold），token 定義在 `app/assets/css/main.css` 的 `@theme static`：品牌色（`cream`/`paper`/`line`/`ink-*`/`gold-*`）、字體（`font-display` = Cormorant、內文 Inter + Noto Sans TC，`@nuxt/fonts` 自我托管）、自訂字級（`text-display-xl` ~ `text-caption`、`text-overline`）。
- 換皮策略：保留 NuxtUI 7 個語意色名稱、只換底層色階，既有 class 自動套用。設定來源為 `spec/ui-config/ui-config.yaml`。
- 狀態文字與顏色的 SSOT：`app/utils/statusMeta.ts`。視覺層級規範見 `.claude/rules/visual-hierarchy.md`。

### 3.5 即時與上傳

- 投影即時推送：`useProjectionChannel()` = `BroadcastChannel` + 短輪詢 fallback（不換 WebSocket/SSE，決策見下節）
- 圖片上傳：`useImageUpload()` — R2 已設定走 presigned 直傳，否則 fallback dataURL 存 DB（本機／e2e）

#### 接待台即時性（維持 5 秒短輪詢，不做推播）

接待台曾標記「M0 換 SSE/WebSocket」，2026-07-13 trade-off 分析後**結論：維持 5 秒短輪詢，不做推播**（issue #77）。未來重新評估前先讀這節，別把 SSE 當技術欠債。

- Vercel serverless 長連線 = function 持續計費＋時長上限強制斷線，SSE 變成偽輪詢；WebSocket 不支援
- neon-http driver 無常駐連線，聽不了 Postgres LISTEN/NOTIFY，推播需外掛 pub/sub 服務（新依賴＋費用）
- 實際負載：一場婚禮 1-3 台接待機，輪詢每 5 秒 7 個小請求（賓客／狀態／喜餅款式／指派／不發放／桌次／座位；座位已批次化），成本趨近零；體感上 5 秒內同步已足夠
- 未來若成真多場次、數十台裝置同時在線：優先評估 Supabase Realtime / Pusher 免費層，而非自建 SSE

---

## 4. 後端架構（`server/`）

### 4.1 風格：務實派 CRUD

**route handler 直接操作 DB**，無 application/domain/infrastructure 分層、無 service/repository。每支 handler 的標準形狀：

```
import type 拉 app/types/api 合約型別（型別即合約）
getRouterParam / readBody 取輸入
useDb() Drizzle 查詢 + 就地 DTO 映射
業務規則以 inline if + createError 表達（如「不可重複報到」→ 409）
setResponseStatus(201) / 回傳 XxxEvent
```

橫切關注點（認證、授權）全數上移到 middleware，handler 普遍 20–50 行。`server/utils/` 是共用函式庫而非「層」。

> `doc/backend/backend-architecture.md` 描述的 Event Sourcing + Decider 架構是**模板遺留文件，不代表本專案**。本專案的架構決定是務實派 CRUD＋事件語意（回傳型別叫 `XxxEvent`，但持久化是直接 UPDATE，沒有 event store）。

### 4.2 路由組織與授權

- 一律 `/api/v1/` 前綴，Nitro file-based routing（`*.get.ts` / `*.post.ts`…），共 105 支 handler。POST 兼作動作端點（`check-in`、`approve`、`merge`），PUT 用於整批覆寫設定。唯一例外：`/api/line-login/callback` 刻意放在 v1 之外——OAuth callback 需向 LINE console 登錄固定 URL，不隨 API 版本演進。
- `server/middleware/auth.ts` 統一把關，流程：
  1. `classifyRoute()`（`server/utils/route-auth.ts`）將路由分類為 `public / share / guest / auth`
  2. 解析 Bearer token → 回查 `users` 或 `reception_accounts`（已刪帳號視為無效）
  3. `assertWeddingScope()` 婚禮範圍授權 + `assertRouteRole()` 角色授權（管理者放行、`adminOnly` 擋新人、接待員限白名單正則）
  4. `enforced` 下無效 token 回 401；`open` 下退回預設管理員（相容 e2e）
- 授權矩陣的基底來自 `spec/ir/ir-export.json` 的 authMatrix。

### 4.3 賓客簽名連結（guest-link）

`server/utils/guest-link.ts`，HMAC-SHA256（secret = `NUXT_GUEST_LINK_SECRET`），`timingSafeEqual` 防時序攻擊。兩種格式：

| 格式 | 綁定 | 用途 |
|------|------|------|
| `w.<digest>` | weddingId | 婚禮分享連結（公開 RSVP、流程表、花田、投影） |
| `g.<guestId>.<digest>` | weddingId + guestId | 賓客專屬連結（個人 RSVP、謝卡、自助報到、祝福） |

簽名**不含過期時間**（謝卡等連結需婚後長期有效），要全面失效就輪換 secret。賓客簽名可通行婚禮層級的分享資料，反之不可。`enforced` 下匿名路由必須帶 `X-Guest-Sig` header 或 `?sig=`。

### 4.4 其他 server utils

| 檔案 | 職責 |
|------|------|
| `jwt.ts` | `jose` HS256，payload `{ userId(sub), role, weddingId }`，預設 7d |
| `password.ts` | Node 內建 scrypt，格式 `scrypt$<salt>$<hash>`，零外部依賴 |
| `r2.ts` | R2 presigned PUT（10 分鐘），`isR2Configured()` 未設退 dataURL |
| `line.ts` | LINE Messaging API：單推＋multicast 群發（≤500/批、去重、過濾非真實 userId 格式）＋當月推播額度查詢；未設 token 維持 mock 行為 |
| `line-login.ts` | LINE Login OAuth（賓客綁定）：authorize URL、state HMAC 簽名（綁 weddingId＋guestId、10 分鐘時效防 CSRF）、code 換 token 取 userId；未設 channel ID/secret 時 bind 頁維持 mock 綁定 |
| `auth.ts` | `getRequestUser()`、`assertWeddingAccess()`（handler 內二次確認） |
| `couple-account.ts` | 婚禮綁定新人帳號的存在／占用檢查 |

### 4.5 mock 的現況

`server/mock/data/`（16 檔）在 M0-b 之後角色收斂為：**DB 的初始 seed 資料源**（`server/db/seed.ts` 使用），API handler 一律讀寫 Postgres、不再 mutate 這些陣列。唯二例外：`MockUser` interface 仍是 middleware 的 user 型別、`getMockCurrentUser()` 仍是 open 模式的 fallback 使用者——mock 尚未完全退場。

---

## 5. 資料層

### 5.1 Schema 設計原則（`server/db/schema.ts`，25 張表）

務實派取捨，全部為了與既有 mock/API 合約無縫銜接：

- **文字 PK 沿用 mock id 格式**（如 `guest-001`），handler 產生；另有 `seq` identity 欄位僅供排序
- **時間一律存 ISO 字串**（`text`），與 API JSON 一致，省掉序列化邊界
- **刻意不宣告 FK 約束**：級聯／孤兒語意由 handler 掌控（對齊 mock 行為）
- 巢狀結構走 `jsonb`（`rsvp_form_configs.questions`、`rundown_items.roleTasks`…）
- `weddingId` 非 PK 者一律建 index

表清單（皆以 `weddingId` 邏輯外鍵串連）：

| 領域 | 表 |
|------|----|
| 帳號 | `users`、`reception_accounts` |
| 婚禮 | `weddings`（softDelete：`deletedAt`） |
| 賓客 | `guests`、`guest_categories`（複合 PK） |
| 座位/場地 | `seating_tables`、`seats`、`venue_layouts`、`venue_markers`、`etiquette_settings`、`etiquette_warnings` |
| 喜餅 | `cake_box_types`、`cake_box_assignments`、`cake_box_exclusions`、`cake_box_extra_orders` |
| 禮品/祝福 | `gift_items`、`blessings` |
| 流程 | `rundown_roles`、`rundown_items` |
| 設定/整合 | `rsvp_form_configs`、`line_oas`、`thank_you_templates`、`thank_you_customizations`、`thank_you_batch_sends`（謝卡群發紀錄：成敗人數、sentAt、sentBy）、`projection_settings` |

### 5.2 連線與 migration

- `server/db/index.ts`：單例 `useDb()`，依 host 自動選 driver——`*.neon.tech` 走 `neon-http`（serverless），其他走 `node-postgres`。`casing: 'snake_case'` 映射欄名。**neon-http 不支援 `db.transaction()`**，handler 一律單一查詢。
- `ensureDbReady()` 僅在 dev 自動 migrate＋空庫 seed；production 靠部署階段 `npm run db:migrate`（用 Neon direct URL，runtime 用 pooled URL——兩者不可混用，見 ops.md）。
- Migration 由 drizzle-kit 產出（`server/db/migrations/`），`npm run db:generate` / `db:migrate` / `db:studio`。

---

## 6. 測試與品質守門

品質保證主力是 Playwright E2E（unit test 僅 `test/unit/useHttp.spec.ts` 一支煙霧測試）。

### 6.1 兩層 E2E

| 層 | 目錄 | 性質 |
|----|------|------|
| 主 spec（凍結合約） | `test/e2e/specs/`（19 檔，`00-auth` ~ `18-invitations`） | SSOT，不得修改；業務合約定義於對應 `spec/e2e-flows/*.flow.md` 的 Business Invariants |
| vibe spec | `test/e2e/vibe/`（25 檔：interaction / persistence / structure） | 不凍結，刪改由使用者決定；時序敏感者隔離到 `vibe/unstable/`（不進守門，目前為空） |

### 6.2 三份 Playwright config

| config | testDir | 用途 |
|--------|---------|------|
| `playwright.config.ts` | `test/e2e/specs` | base：worktree 路徑 hash 出確定性 port（3100–3499，多 worktree 不互撞）、`workers: 1`、`NUXT_AUTH_MODE=open` 起 dev server；設 `E2E_BASE_URL` 時改打外部 container |
| `playwright.gate.config.ts` | specs＋vibe（排除 unstable） | **守門唯一入口**：`/vibe-check`、pre-push、未來 CI 都跑這份 |
| `playwright.vibe.config.ts` | 只跑 vibe | vibe 迭代用 |

### 6.3 守門機制

- **pre-push hook**（`.husky/pre-push`）：只動文件類檔案則跳過；Docker 可用時走 `scripts/docker-gate.sh`——build production image → 起 ephemeral Postgres → migrate → 起 app container（open 模式）→ 打 gate config；不可用則 fallback 本機 dev server。紅燈依路徑分流：`specs/` 紅 = 破壞 invariant（不可改 spec），`vibe/` 紅 = 修 UI 或由使用者決定改 spec。
- **commit-msg**：commitlint（Conventional Commits）。
- **GitHub Actions**：`pull_request.yml` / `push.yml` 跑 `generate` + `eslint`（e2e 目前只在本機 gate 跑）；`sdd-review.yml` 在 PR 動到 `app/**`、`server/**` 時用 claude-code-action 跑 `/sdd-review` 留言。`blob_storage_website*.yml` 是模板遺留的 Azure 靜態部署，與本專案 SSR 部署無關，可忽略或移除。
- **e2e 專用端點**：`server/api/__test__/reset.post.ts`（truncate＋seed，僅 open 模式）。

---

## 7. SDD 規格體系（`spec/`）

程式碼由規格驅動產生，spec/ 是上游真相（流程詳見 `doc/frontend/frontend-workflow.md`）：

```
spec/gherkin-feature/*.feature（57 檔，上游 codegen 產出，勿手改）
        │  /feature-to-flow
        ▼
spec/e2e-flows/*.flow.md（19 檔）── Business Invariants ＝ 業務合約
        │  /test e2e spec                    │
        ▼                                    ▼
test/e2e/specs/*.spec.ts（凍結）      app/types/api + server/api（/feature-to-api）
        │  /feature-to-ui
        ▼
app/pages（為通過 spec 而建）
```

- `spec/report/route-map.yaml`：路由 ↔ 頁面 ↔ API 端點 ↔ 型別的總對照表（`/feature-to-api` Phase 0 產出，含 content_hash 供增量同步）。注意實作端點已多於 route-map 收錄（dashboard-stats、venue-markers、signed-links 等延伸端點）。
- `spec/ir/ir-export.json`：領域 IR（actors、aggregates、authMatrix——後端 RBAC 的來源）。
- `spec/ui-config/`：UI 風格規範（`ui-config.yaml`）＋ 5 個 HTML 設計參考。
- 無 OpenAPI（`spec/api/` 不存在），API 合約以 route-map + flow.md + `app/types/api/` 為準。

---

## 8. 環境與部署

### 8.1 環境變數（runtimeConfig）

| 變數 | 作用 | 未設定時 |
|------|------|---------|
| `NUXT_AUTH_MODE` | `enforced` / `open` | production 預設 enforced，其他 open |
| `NUXT_JWT_SECRET`、`NUXT_GUEST_LINK_SECRET` | JWT／賓客簽名 | 上線必填；**不可留空字串**（會覆蓋預設） |
| `NUXT_DATABASE_URL` | Postgres 連線 | 預設本機 docker（localhost:5433） |
| `NUXT_LINE_CHANNEL_ACCESS_TOKEN` | LINE 推播 | 留空＝mock 行為 |
| `NUXT_LINE_LOGIN_CHANNEL_ID`、`NUXT_LINE_LOGIN_CHANNEL_SECRET` | LINE Login OAuth（賓客綁定） | 留空＝bind 頁維持 mock 綁定 |
| `NUXT_LINE_LOGIN_REDIRECT_URI` | OAuth callback 網址（LINE console 需登錄一致） | 未設＝以請求 origin 推導（本機用）；正式環境建議明確指定 |
| `NUXT_R2_*` 四項＋`NUXT_PUBLIC_R2_PUBLIC_URL` | 圖片 presigned 直傳 | 不全＝dataURL 模式 |
| `NUXT_PUBLIC_SENTRY_DSN`、`SENTRY_DSN` | 前／後端錯誤上報 | 留空＝Sentry 完全停用（連模組都不載入） |
| `NUXT_PUBLIC_API_BASE` | API base | 預設空字串（`/api/v1` 內嵌在 client 層） |

設計哲學：**所有外部依賴都有本機退路**——不設任何變數就能 `npm run dev` 跑起完整系統（`predev` 自動 `docker compose up db`，dev 自動 migrate＋seed）。

### 8.2 環境對照

| | 本機 dev / e2e | 正式（issue #9） |
|---|---|---|
| 部署 | `nuxt dev`（predev 拉起 docker db） | Vercel（Git 整合 auto-deploy，region hnd1；repo 內無設定檔） |
| DB | Postgres 17 docker（port 5433） | Neon Free（Singapore，runtime 用 pooled、migration 用 direct） |
| 圖片 | dataURL 存 DB | Cloudflare R2 presigned 直傳 |
| authMode | open | enforced |
| 監控 | 無 | Sentry ＋ `/api/v1/health`（UptimeRobot） |

Dockerfile（多階段 SSR build → `node .output/server/index.mjs`）目前主要供 **docker-gate 測試**重用，也可作自架備援。正式環境首位管理員用 `npm run db:create-admin` 開通（production 不 seed 示範資料）。

---

## 9. 文件索引

| 文件 | 內容 | 時效性 |
|------|------|--------|
| 本文件 | 系統執行期架構 | 以 2026-07 程式碼為準 |
| [ops.md](ops.md) | 營運手冊：監控、密碼救援、故障排查 | 現行 |
| `doc/frontend/frontend-workflow.md` | SDD 開發流程（feature → flow → api → spec → ui） | 現行（部分規則以 `.claude/CLAUDE.md` 為準，如 Pinia auto-import） |
| `doc/backend/backend-architecture.md` | Event Sourcing + Decider 架構 | ⚠️ 模板遺留，**非本專案實況**（實際為務實派 CRUD，見 §4.1） |
| `.claude/CLAUDE.md`、`.claude/rules/` | 開發規範（Vibe 守則、視覺層級、程式碼品質） | 現行 |
| `spec/e2e-flows/*.flow.md` | 各模組 Business Invariants | 凍結（SSOT） |
