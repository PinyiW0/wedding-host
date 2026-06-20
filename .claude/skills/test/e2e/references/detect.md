# E2E 自動偵測

## 目標

自動偵測當前 E2E 測試狀態，產出執行計畫，使用者確認後依序執行。目標是 **E2E 業務需求 100% 覆蓋**。

> **入口指令**：`/test e2e`（不帶子指令）
>
> **TDD 定位**：E2E 採用 TDD 流程 — spec 在 UI 之前生成，UI 是為了通過 spec 而建。
> SSoT 方向鎖定：`.flow.md` → `.spec.ts` → UI，下游禁止修改上游。

---

## 偵測流程

```
/test e2e
  ↓
Step 1: 基礎架構檢查
  test/e2e/helpers/ 存在？
  ├─ 否 → 全量模式（需要 setup）
  └─ 是 → Step 2

Step 2: flow vs spec 檔案比對
  掃描所有 .flow.md 和 .spec.ts
  ├─ 有差異 → 產出執行計畫（Step 4）
  └─ 全部同步 → Step 3

Step 3: git diff 偵測實作變更
  檢查 working tree + staged 的 .vue / mock / API 修改
  ├─ 有變更 → 反查影響的 feature → 建議跑 red
  └─ 無變更 → 提示「全部同步，無需操作」

Step 4: 產出執行計畫
  合併 Step 2 + Step 3 結果
  讀取 sync-report.md（若存在）補充分類上下文
  → 向用戶確認後執行
```

---

## Step 1：基礎架構檢查

```bash
# 檢查 helpers 目錄
glob test/e2e/helpers/actions.ts
```

| 結果 | 判定 | 動作 |
|------|------|------|
| 不存在 | **全量模式** | 提示：需依序執行 `setup` → `spec auto` → `green auto` |
| 存在 | 增量模式 | 進入 Step 2 |

### 全量模式輸出格式

```
E2E 偵測結果：全量模式（首次建立）

測試基礎架構尚未建立，需依序執行：

1. /test e2e setup          — 建立 Playwright 環境、helpers
2. /test e2e spec auto      — 為所有 .flow.md 生成 .spec.ts
3. /feature-to-ui           — 建立 UI 頁面（spec 是合約，UI 為通過合約而建）
4. /test e2e green auto     — 跑測試並修復 UI/mock/API 差異

確認開始執行？（將從 step 1 開始）
```

> 使用者確認後，依序呼叫 setup → spec auto。spec auto 完成後提示使用者執行 `/feature-to-ui` 建立 UI，UI 建好後再執行 `/test e2e green auto`。
>
> ⚠️ green 的定位是「最小修復讓測試通過」，**不是從零建立 UI**。若 UI 頁面不存在，必須先用 `/feature-to-ui` 建立。

---

## Step 2：flow vs spec 檔案比對

### 掃描

```bash
# 取得所有 flow 和 spec 檔案
glob spec/e2e-flows/*.flow.md          # 排除 _common.flow.md
glob test/e2e/specs/*.spec.ts
```

### 比對邏輯

對每個 `{NN}-{name}.flow.md`：

```
對應的 spec = test/e2e/specs/{NN}-{name}.spec.ts

1. spec 不存在？
     → 標記「新增」— 需要 spec 生成

2. spec 存在 → 比較檔案修改時間
     flow mtime > spec mtime？
       → 是 → 標記「更新」— 需要 spec 重新生成
       → 否 → 標記「同步」— 無需操作
```

對每個 `{NN}-{name}.spec.ts`：

```
對應的 flow = spec/e2e-flows/{NN}-{name}.flow.md

flow 不存在？
  → 標記「孤兒」— 建議刪除 spec
```

### 檔案時間比較方法

```bash
# 取得檔案修改時間（秒級 Unix timestamp）
stat -f %m spec/e2e-flows/04-建立球隊.flow.md
stat -f %m test/e2e/specs/04-建立球隊.spec.ts
```

> flow 的 mtime **嚴格大於** spec 的 mtime 才標記為「更新」。相等視為同步。

---

## Step 3：git diff 偵測實作變更

> 僅對 Step 2 標記為「同步」的 feature 執行。

### 掃描

```bash
# 取得所有有修改的檔案（working tree + staged）
git diff --name-only HEAD -- 'app/pages/**/*.vue'
git diff --cached --name-only -- 'app/pages/**/*.vue'
git diff --name-only HEAD -- 'server/mock/data/*.ts'
git diff --cached --name-only -- 'server/mock/data/*.ts'
git diff --name-only HEAD -- 'server/api/**/*.ts'
git diff --cached --name-only -- 'server/api/**/*.ts'
```

### 反查邏輯

| 變更檔案 | 影響範圍 | 反查方式 |
|----------|---------|---------|
| `app/pages/**/*.vue` | 對應 feature 的 spec | 從 `route-map.yaml` 反查 features |
| `server/mock/data/*.ts` | **所有** spec | mock 是共用的，無法精確判斷影響誰 |
| `server/api/**/*.ts` | 使用該 API 的 spec | 從 `route-map.yaml` 反查 features |

#### .vue 變更反查

```
對每個修改的 .vue 檔案：
  1. 在 route-map.yaml 的 routes 中找到 page 匹配的路由
  2. 取得該路由的 features 陣列
  3. 從 feature 檔名提取編號（如 07-查詢球員列表 → 07）
  4. 對應到 spec 檔案（07-查詢球員列表.spec.ts）
  5. 標記為「驗證」— 建議跑 red
```

範例：

```
git diff 偵測到：app/pages/players/index.vue 有修改
  ↓
route-map.yaml：/players → features: [07, 08, 09, 10]
  ↓
建議跑 red：07-查詢球員列表、08-新增球員、09-編輯球員、10-刪除球員
```

#### mock data 變更反查

```
git diff 偵測到：server/mock/data/players.ts 有修改
  ↓
mock 資料是所有 spec 共用的，無法精確判斷影響範圍
  ↓
建議跑全量 red：所有已同步的 spec
```

> ⚠️ mock data 變更影響範圍最廣。實體名稱以字串寫死在 `.flow.md`、`.spec.ts`、`mock data` 三層中，改一處可能連鎖影響多個 spec。

#### API 變更反查

```
對每個修改的 API 檔案：
  1. 從檔案路徑推斷 API 路由（如 server/api/players/index.get.ts → /api/players）
  2. 在 route-map.yaml 的 api_contract.endpoints 中找到匹配的端點
  3. 取得關聯的 features
  4. 標記為「驗證」— 建議跑 red
```

### 無變更時

```
E2E 偵測結果：全部同步

所有 .spec.ts 已是最新，未偵測到實作變更。

若有手動修改 UI 或 mock（bug fix），可指定驗證：
  /test e2e red <feature>
  /test e2e green <feature>
```

---

## Step 4：產出執行計畫

### 分類上下文（可選）

若 `spec/report/sync-report.md` 存在，讀取「Feature 變更總覽」表格，為每個 feature 補充分類資訊（build/patch/rebuild/delete）。此資訊僅作為顯示用途，**不影響偵測判定**。

### 執行計畫格式

```
E2E 偵測完成

| # | Feature | 偵測結果 | E2E 動作 | 來源 |
|---|---------|---------|----------|------|
| 1 | 11-調整球員排序 | 孤兒 spec | 刪除 spec | flow 不存在 |
| 2 | 04-建立球隊 | flow 較新 | spec → green | flow vs spec |
| 3 | 07-查詢球員列表 | flow 較新 | spec → green | flow vs spec |
| 4 | 27-匯出訓練報告 | spec 不存在 | spec → green | 新 flow |
| 5 | 03-查詢球隊列表 | .vue 有變更 | red → green | git diff |
| — | 其餘 21 個 | 同步 | 跳過 | — |

建議執行順序：
1. 清理孤兒：刪除 test/e2e/specs/11-調整球員排序.spec.ts
2. 生成/更新 spec：04, 07, 27
3. 跑測試並修復：04, 07, 27（spec → green）
4. 驗證 .vue 變更：03（red → green）

確認執行？
```

### 排序規則

執行計畫的排序依據：

| 優先級 | 動作 | 原因 |
|--------|------|------|
| 1 | 刪除孤兒 spec | 避免跑到已刪除的測試 |
| 2 | spec → green（新增 + 更新） | 主要工作 |
| 3 | red → green（.vue 驗證） | 最小風險，只跑現有測試 |

### 無任何動作時

若 Step 2 + Step 3 都沒有偵測到需要處理的項目：

```
E2E 偵測結果：全部同步 ✅

所有 spec 已是最新，無 .vue 變更。
```

---

## 執行階段

使用者確認後，按計畫依序執行：

### 1. 清理孤兒 spec

```bash
# 確認後刪除
rm test/e2e/specs/{NN}-{name}.spec.ts
```

### 2. 生成/更新 spec

對每個標記為「新增」或「更新」的 feature：

```bash
# 內部呼叫 spec 生成流程（詳見 spec.md）
/test e2e spec <feature>
```

> 若有多個 feature 需要生成，逐一執行。

### 3. 跑測試並修復

對所有需要測試的 feature（新增 + 更新 + 驗證）：

```bash
# 內部呼叫 green 流程（詳見 green.md）
# green 會自動先跑 red 收集失敗
/test e2e green <feature>
```

### 4. 全量煙霧測試（跨 feature 連鎖檢查）

> 個別 feature 的 green 完成後，執行**全部 spec** 的煙霧測試，捕捉跨 feature 連鎖影響。
> 例如：修復 feature 08 的 mock data 可能影響 feature 07 的列表筆數斷言。

```bash
npx playwright test test/e2e/specs/ 2>&1
```

| 結果 | 動作 |
|------|------|
| 全部通過 | 進入步驟 5（完成報告） |
| 有失敗 | 分析失敗的 spec，執行 `/test e2e green <feature>` 修復（僅修 UI/mock/API，禁止改 spec） |

> ⚠️ 煙霧測試失敗時，修復循環最多 3 次。超過則輸出失敗報告，標記為「跨 feature 連鎖影響，待人工確認」。

### 5. 執行完成報告

```
E2E 執行完成

| Feature | 動作 | 結果 |
|---------|------|------|
| 11-調整球員排序 | 刪除 spec | ✅ 已刪除 |
| 04-建立球隊 | spec → green | ✅ 通過（迭代 1 次） |
| 07-查詢球員列表 | spec → green | ✅ 通過（迭代 3 次） |
| 27-匯出訓練報告 | spec → green | ✅ 通過（迭代 2 次） |
| 03-查詢球隊列表 | red → green | ✅ 通過 |

全量煙霧測試：✅ 全部通過（25 specs）
```

---

## 與現有指令的關係

| 指令 | 變化 |
|------|------|
| `/test e2e`（無子指令） | **新增** — 自動偵測入口 |
| `/test e2e setup` | 不變 — 全量模式時由偵測自動觸發 |
| `/test e2e spec <feature>` | 不變 — 偵測後按計畫逐一呼叫 |
| `/test e2e spec auto` | 不變 — 全量模式時使用 |
| `/test e2e red <feature>` | 不變 — .vue 驗證時使用 |
| `/test e2e green <feature>` | 不變 — 偵測後按計畫逐一呼叫 |
| `/test e2e pipeline <feature>` | 不變 — 使用者仍可手動指定 |

> 自動偵測是現有指令的**編排層**，不改變各子指令的行為。
