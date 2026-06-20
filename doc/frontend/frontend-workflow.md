# 前端工作流程：SDD + AI Codegen + TDD

## 核心理念

Spec-Driven Development（SDD）：規格驅動一切。上游 repo 產出規格，本專案的 AI 生成程式碼，測試守護合約。

```
上游 repo     → EventStorming skill 推導出 .dsl.feature
              → AI 與操作者問答釐清後，從 .dsl.feature 產出 .flow.md
人工銜接      → 將兩份規格檔手動放入本專案的 spec/
本專案 AI     → 依序生成型別、Mock API、測試合約、UI 畫面
品質守護      → Playwright E2E 測試，UI 必須通過 spec 才算完成
```

三個原則：

| 原則 | 說明 |
|------|------|
| 規格是唯一真相 | `.dsl.feature` 由上游 EventStorming skill 推導，`.flow.md` 再由 AI 與操作者問答釐清後從 feature 產出。兩者是本專案所有程式碼的源頭 |
| 合約先行 | 先定義型別和 API 合約，再寫測試，最後才寫 UI |
| 骨架優先 | UI 分階段建構 — 先搭骨架（路由、Layout），再填細節（元件、頁面邏輯） |

---

## 完整流程總覽

```
.dsl.feature + .flow.md（上游 repo 產出，手動放入 spec/）
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Phase A：API 合約（/feature-to-api）                │
│  ┌─────────┐    ┌─────────┐                         │
│  │ Phase 0 │ →  │ Phase 1 │                         │
│  │ 準備工作 │    │ Mock API│                         │
│  └─────────┘    └─────────┘                         │
│  產出：types/api/ + route-map.yaml + mock data + API │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase B：測試合約（/test e2e spec）                  │
│  .flow.md → .spec.ts（Playwright 測試腳本）            │
│  產出：test/e2e/specs/*.spec.ts                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase C：UI 實作（/feature-to-ui）                  │
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐                  │
│  │ 1 │→ │ 2 │→ │ 3 │→ │ 4 │→ │ 5 │                  │
│  │主題│  │骨架│  │排版│  │元件│  │頁面│                │
│  └───┘  └───┘  └───┘  └───┘  └───┘                  │
│  產出：完整的 Nuxt 前端應用                            │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Phase D：綠燈（/test e2e green）                    │
│  跑 E2E 測試 → 修 UI → 重跑 → 直到全過                 │
└─────────────────────────────────────────────────────┘
```

---

## Phase A：API 合約（/feature-to-api）

### 定位

API 合約是整個流程的**基礎建設**。型別定義是所有後續步驟（測試、UI）的共同依據 — 改型別，所有人跟著改。

### Phase 0 — 準備工作

**輸入**：所有 `.dsl.feature` 檔 + `ui-config-pm.yaml`（PM 設定）

**做什麼**：
1. 同步 PM 設定到 `ui-config.yaml`（色彩、Toast、表格等）
2. 掃描所有 `.dsl.feature`，分析功能清單和資料模型
3. 規劃路由結構（哪個 feature 對應哪個頁面）
4. 建立 TypeScript 型別定義（`app/types/api/*.ts`）
5. 產出路由對照表（`spec/report/route-map.yaml`）

**產出**：
```
app/types/api/
├── index.ts              # 統一 re-export
└── {resource}.ts         # 每個資源一個型別檔（如 auth.ts, teams.ts）

spec/report/
└── route-map.yaml        # 路由 ↔ feature ↔ API 端點的對照表（後續所有 Phase 的參照來源）
```

**關鍵規則**：
- 欄位命名 `snake_case`，型別命名 `PascalCase`
- 日期欄位用 `string`（JSON 不支援 `Date`）
- 型別必須建在 `app/types/api/`（Nuxt 4 的 `~` 解析到 `app/`）
- `route-map.yaml` 是後續所有 Phase 的**唯一路由參照來源**

### Phase 1 — Mock API

**輸入**：Phase 0 產出的型別 + route-map + `.flow.md`

**做什麼**：
1. 從 `.feature` Background 提取 mock 資料
2. 交叉比對 `.flow.md` 引用的實體名稱和數值
3. 建立 mock data 檔案（符合 `types/api/` 定義）
4. 建立 API 端點（回傳格式符合合約）

**產出**：
```
server/
├── mock/data/
│   ├── index.ts
│   └── {resource}.ts    # 每個資源一個 mock 檔（列表資料 ≥ 11 筆確保分頁可測）
└── api/
    └── {resource}/
        ├── index.get.ts     # 列表查詢
        ├── index.post.ts    # 建立
        └── ...              # 依 route-map 端點規格建立
```

**關鍵規則**：
- Mock 資料實體名稱優先使用 `.flow.md` 中出現的值（確保 spec 斷言吻合）
- 列表資料 ≥ 11 筆（分頁每頁 10 筆，需 > 1 頁才能測試）
- API 直接回傳 mock data，禁止 `.map()` 挑選欄位
- Server 端 import 用相對路徑，不能用 `~/`

---

## Phase B：測試合約（/test e2e）

### 定位

測試合約是 UI 的**驗收標準**。spec 定義了每個 testid、互動模式、斷言預期。Phase C 的 UI 就是為了通過這些 spec 而建。

### 流程

```
/test e2e setup  → 建立測試基礎架構（helpers、hooks、Playwright config）
/test e2e spec   → .flow.md → .spec.ts（逐一或批次生成）
/test e2e auto   → 自動偵測缺少 spec 的 feature 並生成
```

**產出**：
```
test/e2e/
├── specs/
│   └── {NN}-{功能名}.spec.ts   # 每個 .flow.md 對應一個 spec
└── helpers/                     # 測試工具函式（登入、導航等）
```

**關鍵規則**：
- spec 的 `getByTestId()` 是 UI testid 的**唯一來源**
- 測試步驟使用中文
- 一個 `.flow.md` 對應一個 `.spec.ts`

---

## Phase C：UI 實作（/feature-to-ui）

### 定位

UI 是為了通過 E2E spec 而建。設計理念是「骨架優先，細節後填」，分五個 Phase 逐步建構。

### Phase 1 — 基礎設定（主題 + SEO）

**輸入**：`ui-config.yaml`（色彩、SEO 設定）

**做什麼**：
1. 建立 `app.config.ts` — 色彩映射
2. 建立 `main.css` — 自訂色階（有 `#hex` 的才產生 CSS）
3. 設定 `nuxt.config.ts` — SEO head

**產出**：
```
app/
├── app.config.ts        # NuxtUI 色彩映射
├── assets/css/main.css  # Tailwind + 自訂色階
nuxt.config.ts           # SEO meta
```

**色彩規則**：
| ui-config 值 | main.css | app.config.ts |
|-------------|----------|---------------|
| `"#hex"` | 產生 50-950 色階 | 映射到自身名稱 |
| `"名稱"` | 不產生 CSS | 映射到 Tailwind 內建色 |
| `""` | 不產生 CSS | 映射到預設內建色 |

### Phase 2 — 路由骨架

**輸入**：`route-map.yaml`

**做什麼**：依照路由對照表，建立所有頁面的**空殼**（只有 template 佔位和 testid）。

**產出**：
```
app/pages/
├── index.vue              # 根路由（client-side redirect）
└── {resource}/            # 依 route-map.yaml 規劃建立
    ├── index.vue          #   列表頁空殼（含 testid）
    └── [id].vue           #   詳情頁空殼（若有）
```

**關鍵規則**：
- 根路由 `/` 必建（使用 `navigateTo` redirect，禁止 HTTP redirect）
- testid 若有 `*.elements.md` 以該檔為準
- 一個頁面可對應多個 feature

### Phase 3 — Layout 建置

**輸入**：`ui-config.yaml`（sidebar、colorMode 設定）+ `route-map.yaml`（導航項目）

**做什麼**：建立 `default.vue`（含 Sidebar）和 `auth.vue`（無 Sidebar），更新 `app.vue`。

**產出**：
```
app/layouts/
├── default.vue     # 主 Layout（Sidebar + 內容區）
└── auth.vue        # 認證頁 Layout（置中卡片）
app/app.vue         # 加入 <NuxtLayout> + <UApp>
```

**關鍵規則**：
- 所有設定從 `ui-config.yaml` 讀取（sidebar 收合、深淺模式等）
- Sidebar 導航項目從 `route-map.yaml` 的路由推導

### Phase 4 — 共用元件

**輸入**：`ui-config.yaml`（表格、刪除確認設定）+ `route-map.yaml`（enabled_features）

**做什麼**：建立可複用的共用元件。

**產出**：
```
app/components/common/
├── ListContainer.vue    # 列表頁面容器（含 pagination）
├── ConfirmModal.vue      # 確認對話框（刪除等操作）
├── PageHeader.vue       # 頁面標題區
└── EmptyState.vue       # 空狀態顯示
```

若 `enabled_features` 有啟用額外功能（如 charts、dragAndDrop），同步建立對應 wrapper 元件。

### Phase 5 — 頁面實作

**輸入**：`.spec.ts`（測試合約）+ 型別 + mock API + 共用元件 + `route-map.yaml`

**做什麼**：逐一填充每個頁面的完整功能。**一次只做一個頁面**。

**流程（每個頁面）**：
1. 讀取該頁面相關的所有 `.spec.ts`
2. 讀取 `route-map.yaml` 對應路由的設定
3. 讀取 API 端點原始碼（確認回傳結構）
4. 實作完整頁面功能
5. 執行 lint + typecheck 驗證
6. 輸出確認格式 → **停止，等待用戶回覆**

**關鍵規則**：
- **testid 直接從 `.spec.ts` 的 `getByTestId()` 複製**（不讀 `.flow.md`）
- 禁止定義 local interface，必須 import `~/types/api/`
- 讀取用 `useFetch`，寫入用 `$fetch`
- Pinia store 必須明確 import

---

## Phase D：綠燈（/test e2e green）

### 定位

跑 E2E 測試，找出失敗項目，修 UI 直到全過。

### 流程

```
/test e2e red <feature>    → 跑測試，收集失敗清單
/test e2e green <feature>  → 根據失敗清單修 UI/mock/API
/test e2e green auto       → 自動偵測失敗並逐一修復
```

反覆循環直到所有 spec 通過。修復範圍：
- UI 的 testid 錯誤或缺失
- API 回傳格式與 spec 預期不符
- Mock 資料內容與 `.flow.md` 不一致
- 互動邏輯（表單驗證、分頁、刪除確認等）

---

## SSoT（Single Source of Truth）鏈

每個產出都有明確的真相來源，變更時沿鏈傳播：

```
.dsl.feature（業務規格 — 上游 EventStorming skill 推導）
    │
    ├──→ app/types/api/*.ts（API 合約型別 — 程式碼層面的 SSoT）
    │        │
    │        ├──→ server/mock/data/（mock 資料 — 必須符合型別定義）
    │        ├──→ server/api/（API 端點 — 回傳必須符合合約）
    │        └──→ app/ 元件中的 import（UI 消費型別）
    │
    ├──→ spec/report/route-map.yaml（路由對照 — 所有 Phase 的參照來源）
    │        │
    │        ├──→ app/pages/（頁面結構）
    │        ├──→ app/layouts/（導航項目）
    │        └──→ 後續 Phase 的增量判斷（content_hash）
    │
    └──→ .flow.md（操作流程 — 上游 AI 與操作者問答釐清後從 .dsl.feature 產出）
             │
             └──→ test/e2e/specs/*.spec.ts（測試合約）
                      │
                      └──→ UI 的 testid + 互動模式（Phase 5 的唯一 UI 合約）
```

---

## Sync 模式（增量更新）

Feature 變更時，不需要從頭跑整個流程。Sync 模式透過 `content_hash` 偵測變更，只更新受影響的部分。

### 判斷方式

| 條件 | 模式 |
|------|------|
| `route-map.yaml` 不存在 | 全量模式（首次建立） |
| `route-map.yaml` 存在 | Sync 模式（增量偵測） |

### Sync 流程

```
/feature-to-api 0    → 比對 content_hash → 產出 sync-report.md（變更報告）
/feature-to-api 1    → 讀取報告 → 只處理有變更的型別和端點
/test e2e auto       → 偵測缺少或過期的 spec → 增量生成
/feature-to-ui 2-5   → 讀取報告 → 只處理新增/修改的路由和頁面
```

每個 Phase 進入時，自動讀取 `sync-report.md` 判斷要全量還是增量。

---

## 資料夾結構

```
app/
├── app.config.ts                 # NuxtUI 色彩映射（Phase 1）
├── app.vue                      # 根元件（NuxtLayout + UApp）
├── assets/css/main.css          # Tailwind + 自訂色階（Phase 1）
├── components/
│   └── common/                  # 共用元件（Phase 4 產出）
│       ├── ListContainer.vue    #   列表容器（含 pagination）
│       ├── ConfirmModal.vue      #   確認對話框
│       ├── PageHeader.vue       #   頁面標題區
│       └── EmptyState.vue       #   空狀態顯示
├── layouts/                     # Layout（Phase 3 產出）
│   ├── default.vue              #   主 Layout（含 Sidebar）
│   └── auth.vue                 #   認證頁 Layout（置中卡片）
├── pages/                       # 頁面路由（Phase 2 骨架 → Phase 5 填充）
│   ├── index.vue                #   根路由（client-side redirect）
│   └── {resource}/              #   依 route-map.yaml 規劃建立
│       ├── index.vue            #     列表頁
│       └── [id].vue             #     詳情頁（若有）
├── stores/                      # Pinia stores（依功能需求建立）
│   └── {module}.ts
└── types/api/                   # API 合約型別（Phase A 產出 — SSoT）
    ├── index.ts                 #   統一 re-export
    └── {resource}.ts            #   每個資源一個檔案

server/
├── api/                         # API 端點（Phase A 產出）
│   └── {resource}/
│       ├── index.get.ts         #   列表查詢
│       ├── index.post.ts        #   建立
│       ├── [id].get.ts          #   單筆查詢（若有）
│       ├── [id].put.ts          #   更新（若有）
│       └── [id].delete.ts       #   刪除（若有）
└── mock/data/                   # Mock 資料（Phase A 產出）
    ├── index.ts
    └── {resource}.ts            #   每個資源一個檔案

spec/
├── gherkin-feature/             # .dsl.feature（外部產出，手動放入）
│   └── {NN}-{功能名}.dsl.feature
├── e2e-flows/                    # .flow.md（外部產出，手動放入）
│   └── {NN}-{功能名}.flow.md
├── ui-config/
│   ├── ui-config.yaml            # UI 設定（AI 讀取）
│   └── ui-config-pm.yaml         # PM 設定（Phase 0 同步來源）
└── report/
    ├── route-map.yaml           # 路由對照表（後續所有 Phase 參照）
    └── sync-report.md           # 增量變更報告（Sync 模式產出）

test/e2e/
├── specs/                       # Playwright 測試（Phase B 產出）
│   └── {NN}-{功能名}.spec.ts
└── helpers/                     # 測試工具函式
```

---

## 指令速查

| 指令 | 用途 | 前置條件 |
|------|------|----------|
| `/feature-to-api` | Feature → 型別 + Mock API | `.flow.md` 已放入 `spec/e2e-flows/` |
| `/feature-to-api 0` | 只跑準備工作 | 同上 |
| `/feature-to-api 1` | 只跑 Mock API | Phase 0 完成 |
| `/test e2e setup` | 建立測試基礎架構 | 無 |
| `/test e2e spec` | 生成測試合約 | `/feature-to-api` 完成 |
| `/test e2e auto` | 自動偵測缺 spec 的 feature | 同上 |
| `/feature-to-ui` | Feature → 完整 UI（Phase 1 起） | `/feature-to-api` 完成 |
| `/feature-to-ui 5 <功能>` | 實作指定頁面 | `/test e2e spec` 完成 |
| `/test e2e green` | 修 UI 直到 spec 全過 | UI 實作後 |
| `/nuxt-ui` | 載入 NuxtUI 官方文檔 | 無 |

### 標準開發順序

```bash
# 1. 放入規格檔（上游 repo 產出）
#    手動將 .dsl.feature 放入 spec/gherkin-feature/
#    手動將 .flow.md 放入 spec/e2e-flows/

# 2. 建立 API 合約
/feature-to-api          # Phase 0 + 1

# 3. 生成測試合約
/test e2e setup          # 首次需要
/test e2e auto           # 自動生成所有 spec

# 4. 實作 UI
/feature-to-ui           # Phase 1 → 5

# 5. 綠燈
/test e2e green auto     # 修 UI 直到全過
```

---

## 技術棧

| 項目 | 技術 |
|------|------|
| 框架 | Nuxt 4（Vue 3 Composition API） |
| UI 庫 | NuxtUI |
| 型別 | TypeScript strict mode |
| 測試 | Playwright（E2E） |
| 狀態管理 | Pinia |
| 樣式 | Tailwind CSS v4 |
| Lint | ESLint + Prettier |

### 關鍵技術規則

| 規則 | 說明 |
|------|------|
| `<script setup lang="ts">` | 必用，禁止 Options API |
| Props/Emits type-based 宣告 | 禁止 runtime 宣告 |
| `useFetch` 讀取 / `$fetch` 寫入 | 禁止混用 |
| import `~/types/api/` | 禁止定義 local interface |
| Pinia store 明確 import | 不依賴 auto-import |
| 完成後 lint + typecheck | 必須通過才算完成 |
