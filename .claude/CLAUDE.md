# wedding-host（婚禮籌備／現場接待管理）

## 技術棧

- **框架**：Nuxt 4（Vue 3 Composition API）+ Pinia（`@pinia/nuxt` auto-import，persistedstate 預設存 **cookie**、SSR 讀得到)
- **UI 庫**：NuxtUI + Tailwind（已鎖 light 單一模式，`colorMode: false`）
- **後端**：Nitro server routes + Drizzle ORM + Postgres（本機 docker-compose，正式站 Neon）
- **測試**：Playwright（主 spec / gate / vibe）+ Vitest（`test/unit/`）
- **型別**：TypeScript strict mode + zod（輸入驗證）
- **Lint**：ESLint + Prettier，另串 `scripts/visual-hierarchy-check.mjs`
- **其他**：jose（JWT）、Sentry、Cloudflare R2（S3 SDK）、LINE Login／Messaging API

---

## 常用指令

```bash
npm run dev          # 開發（predev 會自動 docker compose up -d --wait db）
npm run eslint       # ESLint + 視覺層級檢查 ← 注意不是 npm run lint
npm run typelint     # 型別檢查            ← 注意不是 npm run typecheck
npm run test:unit    # Vitest（test/unit/）
npm run test:e2e     # Playwright 主 spec

npx playwright test --config playwright.gate.config.ts  # 守門：主 spec + vibe spec
sh scripts/docker-gate.sh                               # 同上，改用 production image + ephemeral DB

npm run db:generate      # 由 schema 產 migration
npm run db:migrate       # 套用 migration（預設打本機，見下方 gotchas）
npm run db:studio        # Drizzle Studio
npm run db:create-admin  # 建立管理者帳號
```

完成程式碼修改後必跑 `npm run eslint` + `npm run typelint`，兩者皆綠才算完成（細節見 `rules/code-quality.md`）。

---

## 本機開發 gotchas

- **開發需要 Docker**：`predev` 會起 `wedding-host-db`（Postgres 17，host port 5433）
- **容器名固定**：所有 worktree 共用同一個 `wedding-host-db`。在次要 worktree 操作時帶 `COMPOSE_PROJECT_NAME=wedding-host`，避免另建一份容器
- **跑 E2E 會清空本機 DB**：spec 會打 `server/api/__test__/reset.post.ts`（truncate 全表後回填 seed），手動建的資料會消失。要保留資料就走 `sh scripts/docker-gate.sh`（ephemeral DB，不碰 5433）
- **`db:migrate` 沒帶 DSN 會靜默跑本機**：`drizzle.config.ts` 預設 `postgresql://wedding:wedding@localhost:5433/wedding`。要打正式站必須帶 `NUXT_DATABASE_URL`，否則會回報成功但正式庫毫無變化
- **E2E port 依 worktree 路徑 hash 推導**：同 worktree 每次同 port（server 可重用），不同 worktree 不互撞
- **禁用 `--no-verify`**：唯一例外是 gate 已全綠、push 因 SSH timeout 中斷時重推（`.husky/pre-push` 同此規則）

---

## 框架知識 Skill 與裁決

已安裝 Anthony Fu 的 `vue` / `nuxt` / `pinia` skill（`.claude/skills/`），寫對應程式碼時會自動觸發，提供框架正確語法與踩坑提醒。與本專案慣例衝突時，**一律以下列裁決為準**：

- **Pinia store 採 `@pinia/nuxt` 預設 auto-import** — `app/stores/` 下的 store 直接使用、不需手動 import（與 `pinia` skill 一致）
- **本專案是 Nuxt 4** — `nuxt` skill 基於 3.x（整體相容），目錄結構與設定以 Nuxt 4 官方為準
  - data fetching 兩處需注意：`useFetch`/`useAsyncData` 的 `data` 是 `shallowRef`（深層 mutate 不觸發響應、預設值 `undefined`）；`immediate: false` 時初始 `status` 是 `'idle'` 非 `'pending'`
- **本專案 auth 無 refresh token** — `feature-to-api/references/auth-scaffold.md` 是**新專案 scaffold 用**的範本，教的是 access + refresh 雙 token（`/auth/refresh`、single-flight refresh、401→refresh→retry）。本專案認證是**單一 JWT（7 天）**，`server/api/v1/auth/` 只有 `login.post.ts`，沒有 refresh 端點也不打算加。改既有 auth 時不得照該檔補 refresh 機制——那是憑空造一個不存在的東西。該檔僅在未來 scaffold 全新專案時參考

> 維持與官方同步：
> - 升級框架 major/minor 時，重跑 `npx skills add antfu/skills --skill=vue --skill=nuxt --skill=pinia` 重抓快照
> - 定期回查 antfu 是否已出 **Nuxt 4** 版 skill（目前上游仍為 3.x），有則直接替換以消除版本落差
> - 已對齊：vue skill(3.5) ↔ vue 3.5.x、pinia skill(3.0.4) ↔ pinia 3.0.x；唯 nuxt 落後一個 major

---

## SDD 工作流程

Spec-Driven Development：從 Feature 規格驅動開發。

```
.dsl.feature（業務規格，外部產出，手動放入 spec/gherkin-feature/）
       ↓
/feature-to-flow → .flow.md（business invariant + UX-agnostic E2E 流程）
       ↓
/feature-to-api  → types + mock API
       ↓
/test e2e spec   → .spec.ts（測試合約）
       ↓
/feature-to-ui   → UI 畫面（為通過 spec 而建）
       ↓
/test e2e green  → 修 UI 直到 spec 全過
```

---

## Vibe UI 守則（v2）

**主 spec 真理是 `test/e2e/specs/*.spec.ts`**——跑 `npx playwright test` 就知道有沒踩線。業務合約定義於對應的 `spec/e2e-flows/*.flow.md` 的 **Business Invariants** 段。

修改 `app/pages/`、`app/components/`、`app/layouts/` 時，必須遵守：

- **不得破壞 Business Invariants**：實體必須可被使用者識別（用業務語意如 username、playerName、deviceId）、業務狀態文字必須保留語意（「連線中」「已斷線」「進行中」「已結束」「建立成功」「已刪除」等）、業務操作必須可被觸發（不一定要按鈕，但要有可達路徑）
- **不得修改** `test/e2e/specs/`（主 spec 凍結，SSOT 政策）
- **不得修改** `spec/gherkin-feature/`、`spec/e2e-flows/`（主 spec 來源凍結）
- **vibe 完 commit 前必跑** `npx playwright test --config playwright.gate.config.ts`（綠燈 = vibe 安全，pre-push 跑同一份）
- vibe spec（`test/e2e/vibe/`）不凍結，但刪改去留是使用者的決定——紅燈時列選項詢問，不可擅自刪改

可以自由改：顏色、間距、字體、icon、layout、按鈕位置與形式（toolbar / icon-only / menu）、modal vs inline form、列表呈現（table / card / list）、折疊、動畫、新增 testid（建議 `vibe-*` 前綴）、新增頁面與互動。字級與按鈕尺寸預設值見 `.claude/rules/visual-hierarchy.md`——使用者未明確指示改動時維持預設。使用者要求「好看一點」「有質感」「換風格」時，先讀 `spec/ui-config/creative-direction.md` 確認風格方向再動手；加動畫時遵守其 §4 動效規範。

如果你發現非破壞合約無法達成 vibe 目標，**停下來問使用者**，不要擅自改主 spec。

---

## 可用指令

| 指令 | 用途 | 前置條件 |
|------|------|----------|
| `/new-issue` | 建 GitHub issue（固定四段 body，含驗收標準 checklist）+ 綁 `feature/#N-` linked 分支 | 無 |
| `/verify-ac` | 對照 issue AC 逐條驗收，未過自動修（上限 2 輪），結果勾回 issue | issue 有 `## 驗收標準`、編號可解析 |
| `/commit` | 依 SDD 階段分群產生 Conventional Commits（列草案待確認） | 有工作區改動 |
| `/pr` | push → PR 草案 → `gh pr create`（分支含 `#N` → 自動 Closes #N） | 已有 commit |
| `/sdd-status` | 唯讀盤點 SDD 管線七站進度（每站標完成／部分／未開始＋判定依據），建議下一步 | 無 |
| `/feature-to-flow` | Feature → `.flow.md`（business invariant + UX-agnostic E2E 流程） | `.feature` 已放入 `spec/gherkin-feature/` |
| `/feature-to-api` | Feature → 型別定義 + Mock API | `.flow.md` 已放入 `spec/e2e-flows/` |
| `/feature-to-ui` | Feature → 完整 UI 畫面 | `/feature-to-api` 已完成 |
| `/test e2e` | E2E 測試開發流程 | `.flow.md` 已放入 `spec/e2e-flows/` |
| `/vibe-check` | Gate 守門 — 跑 `playwright.gate.config.ts`（主 spec + vibe spec），紅燈依路徑分流解讀 | vibe 完 UI 後、commit 前 |
| `/vibe-setup` | UI 分層 — 將 vibe diff 分類為 visual / 互動 / 結構，並標記測試 pattern | `/vibe-check` 綠燈 |
| `/vibe-e2e` | 依 pattern 自動生成 `test/e2e/vibe/*.spec.ts`（keep，進守門）並跑，時序敏感產到 `vibe/unstable/` | `/vibe-check` 綠燈 |
| `/nuxt-ui` | 載入 NuxtUI 官方文檔 | 無 |
| `/sdd-review` | 手動審查 git diff 的框架語意慣例與邏輯安全（只查 eslint/typecheck/測試漏網的死角） | 有 .vue/store/server 程式碼改動 |

---

## 規範索引

| 規範 | 檔案 | 載入時機 |
|------|------|----------|
| 程式碼品質驗證 | [rules/code-quality.md](rules/code-quality.md) | 修改 app/、server/ 程式碼時 |
| UI 實作規範 | [rules/ui-conventions.md](rules/ui-conventions.md) | 修改 pages/、components/、layouts/ 時 |
| 視覺層級規範 | [rules/visual-hierarchy.md](rules/visual-hierarchy.md) | 修改 pages/、components/、layouts/ 時 |
| 主 spec 凍結 | [rules/frozen-paths.md](rules/frozen-paths.md) | 修改 test/e2e/specs/、spec/gherkin-feature/、spec/e2e-flows/ 時（hook 強制） |
| Server 安全慣例 | [rules/server-security.md](rules/server-security.md) | 修改 server/**/*.ts 時（hook 強制） |
| 前端安全慣例 | [rules/frontend-security.md](rules/frontend-security.md) | 修改 app/ 頁面、stores、composables、middleware、plugins、nuxt.config.ts 時 |
| 創意方向 | `spec/ui-config/creative-direction.md` | vibe 要求質感/風格/動畫、實作賓客公開頁時讀取 |
| UI 設定 | `spec/ui-config/ui-config.yaml` | UI 實作時讀取 |
| Business Invariants | `spec/e2e-flows/*.flow.md` 開頭段 | Vibe UI 前必讀 |

### Hooks（`.claude/settings.json` 註冊，版控內、對 subagent 同樣生效）

| Hook | 事件 | 作用 |
|------|------|------|
| `hooks/frozen-paths-guard.mjs` | PreToolUse（Edit/Write/NotebookEdit/Bash） | 擋下凍結區**既有檔**的修改；新增全新檔放行。授權通道：`.claude/tmp/frozen-allow.json` |
| `hooks/server-security-guard.mjs` | PostToolUse（Edit/Write） | 編輯 `server/**/*.ts` 時注入安全 8 條摘要；對 `server/api/**` 機械偵測巢狀 IDOR 與 mass assignment。誤報豁免：`.claude/tmp/server-security-allow.json` |

> rules 的 frontmatter `paths` 觸發只在主對話生效、subagent 內不注入，所以凍結與 server 安全兩條靠 hook 當實際防線。
>
> 未回灌 nuxt4-template 的 `framework-skills.md`、`vibe-ui.md`：內容已由本檔「框架知識 Skill 與裁決」「Vibe UI 守則（v2）」兩段涵蓋，且本專案版本較新（多 Nuxt 4 裁決與 vibe spec 去留政策），搬過來只會製造兩份真理。`i18n` 相關 rules 本專案不適用，不搬。

---

## 專案結構

```
app/
├── api/              # *.api.ts — 前端呼叫 API 的唯一入口
├── components/       # Vue 元件
├── composables/      # 共用 composable
├── layouts/          # Layout
├── middleware/       # 路由守衛（auth 等）
├── pages/            # 頁面路由
├── stores/           # Pinia stores
├── types/api/        # API 合約型別（由 /feature-to-api 產出）
└── utils/            # 純函式工具
server/
├── api/              # Nitro 端點（含 __test__/reset.post.ts）
├── db/               # Drizzle schema / migrations / seed
├── middleware/       # 認證、租戶範圍
├── mock/             # Mock 資料（真後端上線後僅殘留部分）
├── plugins/
└── utils/
spec/
├── gherkin-feature/  # .dsl.feature 規格檔
├── e2e-flows/        # .flow.md 測試流程
├── ui-config/        # UI 設定
├── ir/               # 中介表示
└── report/           # route-map.yaml 等報告
test/
├── e2e/specs/        # Playwright 主 spec（凍結）
├── e2e/vibe/         # vibe spec（不凍結）
└── unit/             # Vitest
docs/                 # architecture / security / ops / production-readiness
scripts/              # docker-gate.sh、visual-hierarchy-check.mjs 等
```
