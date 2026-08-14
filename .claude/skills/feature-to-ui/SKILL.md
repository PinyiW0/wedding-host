---
name: feature-to-ui
description: 根據 .feature 檔搭配 NuxtUI 產生完整 UI 畫面（分階段：骨架優先，細節後填）。Use when 需要從 .dsl.feature 規格檔產生前端介面、Layout、共用元件或頁面實作。
argument-hint: "[phase]"
context: fork
agent: general-purpose
---

# Feature to UI 工作流程

根據 .feature 規格檔，使用 NuxtUI 產生完整的前端介面。

> **前置條件**：`/feature-to-api` 必須先執行完畢（types + mock API 已建立）。

## 定位（TDD 流程）

UI 是為了通過 E2E spec 而建。在 TDD 流程中，UI 在 spec 之後實作：

```
/feature-to-api → types + mock API
                      ↓
/test e2e spec  → .spec.ts（測試合約）
                      ↓
/feature-to-ui  → UI（為通過 spec 而建）  ← 你在這裡
                      ↓
/test e2e green → 修 UI 直到 spec 全過
```

## Workflow

```mermaid
flowchart LR
    P1[Phase 1: 基礎設定] --> P2[Phase 2: 路由骨架]
    P2 --> P3[Phase 3: Layout]
    P3 --> P4[Phase 4: 共用元件]
    P4 --> P5[Phase 5: 頁面實作]
```

## 使用方式

```bash
/feature-to-ui              # 從 Phase 1 開始
/feature-to-ui 1            # Phase 1: 基礎設定
/feature-to-ui 2            # Phase 2: 路由骨架
/feature-to-ui 3            # Phase 3: Layout 建置
/feature-to-ui 4            # Phase 4: 共用元件
/feature-to-ui 5 <功能名>   # Phase 5: 頁面實作（必須指定功能，一次一頁）
```

## 全量模式 vs Sync 模式

自動偵測當前狀態，決定執行模式：

| 條件 | 模式 | 說明 |
|------|------|------|
| `spec/report/route-map.yaml` **不存在** | 提示先執行 `/feature-to-api` | 前置條件未滿足 |
| 頁面 `.vue` 尚未建立 | **全量模式** | 從零建立所有 UI |
| 頁面 `.vue` 已存在 + `sync-report.md` **存在** | **Sync 模式** | 增量更新受影響的 UI |
| 頁面 `.vue` 已存在 + `sync-report.md` **不存在** | **全量模式（續建）** | 見下方說明——這是多頁專案的常態，不是異常 |

> **「`.vue` 已存在 + 無 `sync-report.md`」是最常見的重跑情境，不要誤判成 Sync**：Phase 2 一次就建好**所有**頁面空殼，且 Phase 5 規定一次只做一頁、每頁完成後停下等確認——所以從 Phase 5 第一頁起，目標頁的 `.vue` 就必然已存在（空殼），`sync-report.md` 則從未產生（它只在 `/feature-to-api` 走 Sync 模式時才生）。這格是常態，不是異常。
>
> 此格的正確行為：**當全量模式續建**——只做本次指定的目標（該 Phase／該功能頁），其餘頁面一概不動。判準看**目標頁是否已實作**，不是「檔案是否存在」：
>
> | 目標頁狀態 | 行為 |
> |---|---|
> | Phase 2 空殼（只有語意結構 + `Phase 5 實作` 註解） | **直接實作填充**，不必問——這正是 Phase 5 的職責 |
> | 已有實作內容 | **停下來問**使用者要跳過／增修／重建，不可默默覆蓋 |
> | 不存在 | 依 route-map 建立 |

### Sync 模式運作方式

1. 讀取 `spec/report/sync-report.md`（由 `/feature-to-api` Phase 0 產出）
2. 按標記執行：
   - Phase 2：只建立新增路由的空殼頁面
   - Phase 5：按 build（新增）/ patch（修改）/ rebuild（重大變更）分別處理

### Sync 模式注意事項

- sync 模式下 Phase **必須按順序執行**，不可跳過有「執行」建議的 Phase
- Phase 1/3/4 在 sync 模式下**通常可跳過**（除非 sync-report 指出需要）
- 刪除項目**不會自動執行**，需使用者手動處理

---

## 現有 Feature 檔案

!`ls -1 spec/gherkin-feature/*.feature 2>/dev/null || echo "(無)"`

---

## Phase 概覽

| Phase | 名稱 | 輸出 | 必讀規範 |
|-------|------|------|----------|
| 1 | 基礎設定 | app.config.ts, main.css, nuxt.config.ts（SEO head） | [phase-1](references/phase-1-theme.md) |
| 2 | 路由骨架 | 所有 pages/*.vue 空殼（語意結構，**不含 testid**） | [phase-2](references/phase-2-skeleton.md) + [rules.md `[P2]`](references/rules.md) |
| 3 | Layout 建置 | layouts/*.vue | [phase-3](references/phase-3-layout.md) + [rules.md `[P3]`](references/rules.md) + visual-hierarchy.md |
| 4 | 共用元件 | components/common/*.vue（+ additionalFeature 元件） | [phase-4](references/phase-4-components.md) + [features.md](references/features.md)（若有） + [rules.md `[P4]`](references/rules.md) + visual-hierarchy.md + frontend-security.md |
| 5 | 頁面實作 | 逐一填充 pages 內容 | [phase-5](references/phase-5-pages.md) + [page-builder.md](references/page-builder.md) + [rules.md `[P5]`](references/rules.md) + visual-hierarchy.md + frontend-security.md（選讀：components.md、features.md） |

**設計理念**：骨架優先，細節後填。每個 Phase 只載入必要的規範，避免 context 過載。`app/types/api/` 作為 API 合約的單一真相來源（由 `/feature-to-api` 建立）。`route-map.yaml` 作為路由與 feature 對照的單一真相來源。**Phase 5 以 `.spec.ts` 為唯一 UI 合約**（語意 anchor——role、accessible name、label——依 spec 的 `getByRole`/`getByLabel` 提供；`getByTestId` 之處 testid 逐字複製；不讀 `.flow.md`）。

---

## 必讀文件

### 核心規範（按需讀取）

- **[rules.md](references/rules.md)** - 共用規則權威來源（配色、視覺層級指引、類型、API、Pinia、Layout 規範）。**testid 命名規範不在此**——SSOT 是 [`feature-to-flow/references/testid-conventions.md`](../feature-to-flow/references/testid-conventions.md)，rules.md 只給本 skill 的遵守要點與指讀
- ⭐ **`.claude/rules/frontend-security.md`** - 前端安全慣例（XSS／敏感資料存放／client 信任邊界）。本 skill 跑在 fork context，paths 規則不會自動注入——Phase 4/5 產元件與頁面前必須主動讀取
- **references/phase-N-*.md** - 各 Phase 的執行步驟與模板（**每個 Phase 開始前讀取對應的 phase 檔**）
- [page-builder.md](references/page-builder.md) - DSL 解析 + 表單範本（Phase 5 需要）
- [components.md](references/components.md) - 元件使用規範（Phase 4, 5 需要）

### 條件式跨切面關注點（依 route-map 決定，**不自行偵測**）

`/feature-to-api` Phase 0 已把偵測結果寫進 `spec/report/route-map.yaml`，本 skill **一律讀該區塊套用，不從 `.feature` 散文重新偵測**（避免上下游漂移）。五個關注點各有消費點：

| route-map 區塊 | 有此區塊時，本 skill 要做什麼 |
|---|---|
| `api_contract.path_prefix` | API 路徑對照見 [rules.md](references/rules.md)「API」段 |
| `auth` | Phase 2 建 `auth.global.ts` 守門（[phase-2-skeleton.md](references/phase-2-skeleton.md) 步驟 2）——**不可默默跳過** |
| `rbac` | Phase 2 建 `rbac.global.ts` 守門（同上 步驟 2.5）＋ Phase 5 角色可見性（[rules.md](references/rules.md)） |
| `realtime` | **Phase 5 實作前先執行 `/realtime` 載入該領域知識**，依其鐵律實作連線生命週期／重連補抓／store 集中／`onUnmounted` cleanup。**不可憑記憶自行寫 EventSource / WebSocket** |
| `streaming` | **Phase 5 實作前先執行 `/streaming` 載入該領域知識**，依其鐵律實作播放器掛載／錯誤自救與看門狗／teardown。**不可憑記憶自行寫 hls.js / video 掛載** |

> 無對應區塊 = 該關注點本專案不做，跳過（中立預設）。偵測規則與判準一律回到 `/feature-to-api` 的 [phase-0-prep.md](../feature-to-api/references/phase-0-prep.md)「偵測索引」，本 skill 不重述。


### E2E 測試合約（Phase 2, 5 需要）

- `test/e2e/specs/*.spec.ts` - **Phase 5 的唯一 UI 合約**（locator、互動模式、斷言預期全在這裡），也是 testid 的唯一來源
- Phase 2 **不需要 testid 來源**——骨架只給語意結構（`<main>` + `<h1>`），testid 一律留到 Phase 5 依 spec 逐字複製

> ⚠️ Phase 5 的 locator 合約以 v2 語意優先：spec 的 `getByRole`/`getByLabel`/`getByText` 對應 UI 要提供的 **accessible name / label / 可見文字**；
> spec 用到 `getByTestId` 之處 testid **逐字複製**、spec 沒用到就不加。不讀 `.flow.md`，消除版本不同步的問題。

### 專案設定

@spec/ui-config/ui-config.yaml（完整規範）

@.claude/rules/visual-hierarchy.md（視覺層級：文字/顏色層級、載體字級、按鈕尺寸，Phase 3-5 適用）

### NuxtUI 文檔

執行 `/nuxt-ui` 載入官方文檔（Phase 3, 4, 5 需要）

---

## 快速指引

### Phase 1-2：基礎骨架

1. **Phase 1**：設定色彩主題 + SEO/Meta（app.config.ts + main.css + nuxt.config.ts）
2. **Phase 2**：建立所有頁面的空殼（只有 template 佔位）

### Phase 3-4：架構元件

3. **Phase 3**：建立 Layout（default.vue, auth.vue）
4. **Phase 4**：建立共用元件（ListContainer, ConfirmModal 等）

### Phase 5：功能實作

5. **Phase 5**：逐一實作每個頁面的完整功能（一次只做一個頁面，確認後才做下一個）

---

## 自動執行規則

- 執行 `/feature-to-ui`（無參數或參數為 `1`）時，**直接開始 Phase 1**
- **前置檢查**：確認 `spec/report/route-map.yaml` 和 `app/types/api/` 存在，若不存在則提示「請先執行 `/feature-to-api`」

---

## 注意事項

- **Phase 5 額外前置條件**：`/test e2e spec` 必須先完成（`.spec.ts` 是 Phase 5 的唯一 UI 合約，locator 合約見上方「E2E 測試合約」段）
- **每個 Phase 完成後，告知用戶下一步應執行的指令**（如「下一步：`/feature-to-ui 5`」），不要用「要我繼續嗎？」的問法
- **Phase 5 一次只做一個頁面。每個頁面完成後輸出確認格式，然後立即停止回應，等待用戶回覆後才處理下一個頁面**
- **Phase 5 所有頁面處理完成後（不論 build/patch/rebuild），結尾必須提示：「下一步：`/test e2e green auto`」**
- **每個 Phase 開始時只讀取該 Phase 的 phase 檔 + rules.md**
- 禁止自行決定網站名稱、色彩等設定，所有設定從 `ui-config.yaml` 讀取
- Phase 5 禁止定義 local interface，必須 import `~/types/api/`
- Phase 5 每個功能必須先讀取 API 原始碼、共用元件、store
