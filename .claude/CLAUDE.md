# Nuxt 4 專案模板

## 技術棧

- **框架**：Nuxt 4（Vue 3 Composition API）
- **UI 庫**：NuxtUI
- **測試**：Playwright（E2E）
- **型別**：TypeScript strict mode
- **Lint**：ESLint + Prettier

---

## 框架知識 Skill 與裁決

已安裝 Anthony Fu 的 `vue` / `nuxt` / `pinia` skill（`.claude/skills/`），寫對應程式碼時會自動觸發，提供框架正確語法與踩坑提醒。與本專案慣例衝突時，**一律以下列裁決為準**：

- **Pinia store 採 `@pinia/nuxt` 預設 auto-import** — `app/stores/` 下的 store 直接使用、不需手動 import（與 `pinia` skill 一致）
- **本專案是 Nuxt 4** — `nuxt` skill 基於 3.x（整體相容），目錄結構與設定以 Nuxt 4 官方為準
  - data fetching 兩處需注意：`useFetch`/`useAsyncData` 的 `data` 是 `shallowRef`（深層 mutate 不觸發響應、預設值 `undefined`）；`immediate: false` 時初始 `status` 是 `'idle'` 非 `'pending'`

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

可以自由改：顏色、間距、字體、icon、layout、按鈕位置與形式（toolbar / icon-only / menu）、modal vs inline form、列表呈現（table / card / list）、折疊、動畫、新增 testid（建議 `vibe-*` 前綴）、新增頁面與互動。

如果你發現非破壞合約無法達成 vibe 目標，**停下來問使用者**，不要擅自改主 spec。

---

## 可用指令

| 指令 | 用途 | 前置條件 |
|------|------|----------|
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
| UI 設定 | `spec/ui-config/ui-config.yaml` | UI 實作時讀取 |
| Business Invariants | `spec/e2e-flows/*.flow.md` 開頭段 | Vibe UI 前必讀 |

---

## 專案結構

```
app/
├── components/       # Vue 元件
├── layouts/          # Layout
├── pages/            # 頁面路由
├── stores/           # Pinia stores
└── types/api/        # API 合約型別（由 /feature-to-api 產出）
server/
├── api/              # API 端點
└── mock/             # Mock 資料
spec/
├── gherkin-feature/  # .dsl.feature 規格檔
├── e2e-flows/        # .flow.md 測試流程
├── ui-config/        # UI 設定
└── report/           # route-map.yaml 等報告
test/
└── e2e/specs/        # Playwright 測試
```
