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

npx playwright test --config playwright.gate.config.ts  # 守門全量：主 spec + vibe spec（分級見 /vibe-check）
sh scripts/docker-gate.sh                               # 同上，改用 production image + ephemeral DB（本機選配）

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
- **跑 E2E 會清空本機 DB**：spec 會打 `server/api/__test__/reset.post.ts`（truncate 全表後回填 seed），手動建的資料會消失。**pre-push 的煙霧 spec 也會**：每次 push 程式碼都會清空本機 5433（issue #178 起 pre-push 改用本機 dev server）。要保留資料就走 `sh scripts/docker-gate.sh`（ephemeral DB，不碰 5433）
- **`db:migrate` 沒帶 DSN 會靜默跑本機**：`drizzle.config.ts` 預設 `postgresql://wedding:wedding@localhost:5433/wedding`。要打正式站必須帶 `NUXT_DATABASE_URL`，否則會回報成功但正式庫毫無變化
- **E2E port 依 worktree 路徑 hash 推導**：同 worktree 每次同 port（server 可重用），不同 worktree 不互撞
- **禁用 `--no-verify`**：唯一例外是煙霧已全綠、push 因 SSH timeout 中斷時重推（`.husky/pre-push` 同此規則）

---

## 框架知識 Skill 與裁決

`vue`／`nuxt`／`pinia` skill 與本專案慣例衝突時的裁決（Nuxt 4、withDefaults、auth 無 refresh token、`frontend-design` 不得改色票）見 [rules/framework-skills.md](rules/framework-skills.md)。

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

改 `app/pages/`、`app/components/`、`app/layouts/` 時不得破壞 Business Invariants、不得改凍結區、commit 前必跑 `/vibe-check`；可自由改的範圍與 vibe spec 去留政策見 [rules/vibe-ui.md](rules/vibe-ui.md)。

---

## 收尾與審查

- 動到 app/、server/、.claude/、.github/、.husky/、scripts/、patches/、docs/、根目錄的 Dockerfile／package.json／README.md、任何位置的 osv-scanner.toml 或任何 .sh／.mjs（與 `ledger.sh` L5 同一份 scope）、有實質改動（非純格式）且尚未跑過 `/code-review` 時，在 `/verify-ac` 或發 PR 前**主動**執行（diff 含 `.md` 時另跑 `skills/review-loop/references/doc-impl-check.md` 的專項檢查），不必使用者提醒；放在驗收蓋章之前，避免事後改 code 讓已勾 AC 過期。完整分層見 `ops/judgment-rubrics.md` 第 5 節
- 跑 `/ship` 時 eslint／typelint／`/vibe-check --full`／`/sdd-review`／`/code-review` 由它依 ledger 統一調度並記帳，不必手動逐一叫；手動路徑的義務不變
- PR 預設掛 Copilot 審查（2026-11-09 決定，#208）。`/review-loop` 會自行 commit／push／在 PR 上回覆留言並重新請 review——啟動它就是對這三件事的授權；但它**永不 merge、永不 `--force` push**，要不要 merge 一律由使用者決定

## 可用指令

| 指令 | 用途 | 前置條件 |
|------|------|----------|
| `/new-issue` | 建 GitHub issue（固定四段 body，含驗收標準 checklist）+ 綁 `feature/#N-` linked 分支 | 無 |
| `/verify-ac` | 對照 issue AC 逐條驗收，未過自動修（上限 2 輪），結果勾回 issue | issue 有 `## 驗收標準`、編號可解析 |
| `/commit` | 依 SDD 階段分群產生 Conventional Commits（列草案待確認） | 有工作區改動 |
| `/pr` | push → PR 草案 → `gh pr create`（分支含 `#N` → 自動 Closes #N；預設掛 Copilot） | 已有 commit |
| `/ship` | **收尾一條龍**：六層關卡（紅燈自動修）→ AC 驗收 → commit → PR，只停一次 | 有改動、不在 main |
| `/review-loop` | push 後自動請 Copilot review、輪詢、修「必修」、回覆，直到共識才通知（不 merge） | PR 已開、工作區乾淨 |
| `/pr-feedback` | 爬 PR review 留言，分類報告後就地改（不 commit／push／發言） | PR 已開 |
| `/code-review` | 審本地 diff 抓正確性／重用／簡化／效能 bug（Claude Code 內建） | 有未提交或未合併的改動 |
| `/sdd-status` | 唯讀盤點 SDD 管線七站進度（每站標完成／部分／未開始＋判定依據），建議下一步 | 無 |
| `/feature-to-flow` | Feature → `.flow.md`（business invariant + UX-agnostic E2E 流程） | `.feature` 已放入 `spec/gherkin-feature/` |
| `/feature-to-api` | Feature → 型別定義 + Mock API | `.flow.md` 已放入 `spec/e2e-flows/` |
| `/feature-to-ui` | Feature → 完整 UI 畫面 | `/feature-to-api` 已完成 |
| `/test e2e` | E2E 測試開發流程 | `.flow.md` 已放入 `spec/e2e-flows/` |
| `/vibe-check` | Gate 守門 — 跑 `playwright.gate.config.ts`（預設定向：煙霧＋受影響 spec；`--full` dev 全量），紅燈依路徑分流解讀 | vibe 完 UI 後、commit 前；發 PR 前帶 `--full` |
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
| Vibe UI 守則 | [rules/vibe-ui.md](rules/vibe-ui.md) | 修改 pages/、components/、layouts/ 時 |
| 框架知識 Skill 與裁決 | [rules/framework-skills.md](rules/framework-skills.md) | 每次（無 `paths`；auth、CSS 色票等裁決不限 .vue） |
| 主 spec 凍結 | [rules/frozen-paths.md](rules/frozen-paths.md) | 修改 test/e2e/specs/、spec/gherkin-feature/、spec/e2e-flows/ 時（hook 強制） |
| Server 安全慣例 | [rules/server-security.md](rules/server-security.md) | 修改 server/**/*.ts 時（hook 強制） |
| 前端安全慣例 | [rules/frontend-security.md](rules/frontend-security.md) | 修改 app/ 頁面、stores、composables、middleware、plugins、nuxt.config.ts 時 |
| 創意方向 | `spec/ui-config/creative-direction.md` | vibe 要求質感/風格/動畫、實作賓客公開頁時讀取 |
| UI 設定 | `spec/ui-config/ui-config.yaml` | UI 實作時讀取 |
| Business Invariants | `spec/e2e-flows/*.flow.md` 開頭段 | Vibe UI 前必讀 |

### Hooks（`.claude/settings.json` 註冊，版控內、對 subagent 同樣生效）

| Hook | 事件 | 作用 |
|------|------|------|
| `hooks/frozen-paths-guard.mjs` | PreToolUse（Edit/Write/NotebookEdit/Bash） | 擋下凍結區**既有檔**的修改；新增全新檔放行。以目標檔所在的 worktree 判斷（同 repo 另一個 worktree 一樣擋，共用 `hooks/target-root.mjs`）。授權通道：目標 worktree 的 `.claude/tmp/frozen-allow.json` |
| `hooks/server-security-guard.mjs` | PostToolUse（Edit/Write） | 編輯 `server/**/*.ts` 時注入安全 8 條摘要；對 `server/api/**` 機械偵測巢狀 IDOR 與 mass assignment。誤報豁免：`.claude/tmp/server-security-allow.json` |

> rules 的 frontmatter `paths` 觸發只在主對話生效、subagent 內不注入，所以凍結與 server 安全兩條靠 hook 當實際防線。
>
> `i18n` 相關 rules 本專案不適用，不搬。

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
