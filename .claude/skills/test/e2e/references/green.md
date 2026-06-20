# E2E 綠燈（Phase: e2e green）

## 目標

分析紅燈報告的失敗原因，修復 UI / mock / API，讓所有測試通過。

> **綠燈 = 最小修復讓測試通過**。不做額外重構、不加功能，只修必要的部分。
>
> **⚠️ TDD 核心原則**：spec 是從 flow 生成的測試合約，**禁止修改**。所有修復都在 UI / mock / API 層。若 spec 本身有問題，應更新 `.flow.md` 後重新生成 spec。

---

## 指令格式

```bash
/test e2e green <feature>           # 單一 feature（從紅燈修到綠燈）
/test e2e green <start> <end>       # 批次綠燈（多個 feature）
```

---

## 前置條件

| 檢查項 | 說明 |
|--------|------|
| Spec 檔案存在 | `test/e2e/specs/{NN}-{name}.spec.ts` |
| UI 頁面存在 | `app/pages/` 下對應的 `.vue` 頁面已由 `/feature-to-ui` 建立 |
| 紅燈已執行 | 知道哪些測試失敗（會自動執行紅燈） |

> 如果沒有先跑紅燈，green 會自動先執行一次紅燈來收集失敗。
>
> ⚠️ **UI 不存在時禁止執行 green**。green 的定位是「最小修復」，不是「從零建立 UI」。若 `app/pages/` 下缺少對應頁面，應提示使用者先執行 `/feature-to-ui` 建立 UI 後再回來跑 green。

---

## 執行步驟

### Step 1：執行紅燈（自動）

先跑一次測試，收集失敗清單：

```bash
npx playwright test test/e2e/specs/{NN}-{name}.spec.ts 2>&1
```

如果全部通過 → 直接輸出「已是綠燈」並結束。

### Step 2：根因分析（針對每個失敗測試）

對每個失敗的測試，執行以下分析流程：

```
失敗測試
│
├─ 讀取 spec 失敗行 → 確認期望的 testid / 文字 / URL
│
├─ 推斷頁面路徑
│   ├─ page.goto('/teams') → app/pages/teams/index.vue
│   ├─ page.goto('/trainings/1/analysis') → app/pages/trainings/[id]/analysis.vue
│   └─ page.goto('/analysis/1') → app/pages/analysis/[id].vue
│
├─ 讀取對應 UI 檔案的 <template>
│
└─ 比對 spec 期望 vs UI 實際
    ├─ testid 缺失 → 加 data-testid
    ├─ 元素結構不同 → 調整 template
    ├─ 文字不匹配 → 檢查 mock data 或顯示邏輯
    └─ 行為差異 → 檢查事件處理或 API 呼叫
```

### Step 3：決定修復方向（Decision Tree）

```
根因
├─ testid 缺失
│  → 修 UI：在對應元素加 data-testid="xxx"
│  → 原則：最小侵入，只加 attribute，不改結構
│
├─ 元素不存在（頁面缺少功能區塊）
│  → 修 UI：補上缺失的 UI 區塊
│  → 參考：.flow.md 的元素定義表
│  → 注意：用 Nuxt UI 元件（UTable、UCard、UButton...）
│
├─ 文字不匹配
│  ├─ Mock 數據問題
│  │  → 修 Mock：server/mock/data/*.ts
│  │  → 原則：讓 mock 與 spec 預期一致
│  ├─ 格式化問題（小數位、百分比、單位）
│  │  → 修 UI：調整顯示邏輯（toFixed、%、km/h...）
│  └─ API 回傳結構問題
│     → 修 API 或頁面的資料存取路徑
│
├─ 列表行數不對
│  ├─ UTable 佔位行干擾
│  │  → 修 UI：使用 #empty slot 處理空狀態
│  ├─ 篩選邏輯有誤
│  │  → 修 API 或前端篩選
│  └─ Mock 資料筆數不對
│     → 修 Mock data
│
├─ 導航失敗
│  ├─ 路由未跳轉
│  │  → 修 UI：檢查 router.push / navigateTo
│  └─ 等待不足
│     → ⛔ 停止修復。走「上游回報格式」輸出報告，交由使用者決定是否更新 spec.md 規則並重新生成 spec。
│
├─ Playwright 技術問題（hydration / toast 匹配）
│  → ⛔ 停止修復。走「上游回報格式」輸出報告，交由使用者決定是否更新 spec.md 規則並重新生成 spec。
│  → 禁止直接修改 .spec.ts
│
├─ Spec 預期值與業務邏輯不符
│  → ⛔ 停止修復。走「上游回報格式」輸出報告，交由使用者決定。
│  → 禁止直接修改 .spec.ts 或 .flow.md
│
└─ 不確定
   → 不修改，標記為「待人工確認」
```

### Step 3.5：修復方向 Gate（強制檢查）

在寫下任何修改之前，對每個修復方案執行以下檢查。
**任一項為 Yes → 禁止執行，改走「上游回報格式」。**

| 檢查項 | 問自己 |
|--------|--------|
| 改 spec？ | 我是否正在修改 `test/e2e/specs/*.spec.ts`？ |
| 改 flow？ | 我是否正在修改 `spec/e2e-flows/*.flow.md`？ |
| 改預期值？ | 我的修復是為了讓 spec 的 `expect()` 預期值對上 UI，而不是讓 UI 對上 spec？ |
| 改業務邏輯？ | 我是否在改變功能行為（而非修正顯示）？ |

> **方向判定口訣**：green 永遠是「改實作去符合合約」，不是「改合約去符合實作」。

### Step 4：實施修復

**修復優先順序**（低風險 → 高風險）：

1. **加 testid**（最安全）：只加 `data-testid` attribute
2. **修 mock data**（低風險）：調整測試數據
3. **修 API handler**（低風險）：回傳格式、排序、錯誤訊息文字
4. **修 UI 顯示邏輯**（中風險）：格式化、條件渲染
5. **補 UI 區塊**（高風險）：新增模板元素

> **禁止**：修改 `.spec.ts`、修改 `.flow.md`、刪除現有功能。
>
> **API 修改邊界**（什麼算業務邏輯）：
>
> | 可改（顯示層） | 不可改（業務邏輯） |
> |---------------|-------------------|
> | 回傳欄位結構（排序、巢狀）| 過濾規則（角色過濾、狀態過濾、日期過濾）|
> | 錯誤訊息文字 | 權限判斷邏輯 |
> | 分頁參數預設值 | CRUD 行為（建立/更新/刪除的條件）|
>
> 若修復需要改過濾規則或權限判斷 → ⛔ 停止，走「上游回報格式」。

### Step 5：驗證修復

每修完一個失敗測試（或一批相關修復），重新執行：

```bash
npx playwright test test/e2e/specs/{NN}-{name}.spec.ts 2>&1
```

**Trial-and-Error 循環**：

```
修復 → 跑測試 → 還有失敗？
  ├─ 是 → 分析新的失敗 → 修復 → 重跑
  └─ 否 → 綠燈！✅
```

> **最大迭代次數**：5 次（單一 feature 的修復循環）。超過 5 次仍無法全部通過，輸出剩餘失敗報告並停止。
>
> 注意：此限制與 `/test e2e detect` 的全量煙霧測試循環（3 次）不同。煙霧測試是所有 feature 修完後的跨 feature 連鎖影響檢查，範圍更大所以限制更嚴。

### Step 6：輸出綠燈報告

---

## 綠燈報告格式

### 全部通過

```
E2E 綠燈報告：{NN}-{name}

  ✅ 全部通過（{pass} pass, {skip} skip）

  修復摘要：
  1. app/pages/teams/index.vue
     - L15: 加 data-testid="teams-page"
     - L32: 加 data-testid="team-row"
  2. server/mock/data/teams.ts
     - L8: 修正球隊數量為 2

  迭代次數：2（第 1 次 3 fail → 第 2 次 0 fail）
```

### 部分失敗（達到最大迭代）

```
E2E 綠燈報告：{NN}-{name}

  ⚠️ 部分通過（{pass} pass, {fail} fail, {skip} skip）
  已達最大迭代次數（5）

  仍失敗：
  1. ❌ {test name}
     錯誤：{error}
     嘗試過：{修復描述}
     相關 flow：spec/e2e-flows/{NN}-{name}.flow.md > 規則：{rule name}
     相關檔案：app/pages/{page}.vue:L{line}
     建議：{人工處理建議}

  已修復的檔案：
  - app/pages/teams/index.vue（2 處）
  - server/mock/data/teams.ts（1 處）
```

---

## 批次模式

```bash
/test e2e green 01 05    # 連續修復 spec 01 到 05
```

依序處理每個 feature，前一個修完再處理下一個。

批次輸出格式：

```
E2E 綠燈批次報告：01 → 05

  01-使用者登入         ✅ 已是綠燈（無需修復）
  02-使用者登出         ✅ 綠燈（修復 1 處）
  03-查詢球隊列表       ✅ 綠燈（修復 3 處）
  04-建立球隊           ⚠️ 部分失敗（1 fail 待人工確認）
  05-編輯球隊           ✅ 已是綠燈（無需修復）

  統計：4 綠燈 / 1 部分失敗
  修復檔案：5 個
```

---

## 修復規範

### data-testid 加法

```vue
<!-- ❌ 不要改結構 -->
<div>
球隊列表
</div>

<!-- ✅ 只加 testid -->
<div data-testid="teams-page">
球隊列表
</div>
```

### UTable 行 testid

```vue
<!-- 在 UTable 的 row 模板中加 testid -->
<template #row="{ row }">
  <tr data-testid="team-row">
    ...
  </tr>
</template>
```

> 注意：Nuxt UI v3 的 UTable 結構可能需要用 slot 自訂行模板，
> 或在 cell 級別加 testid。先檢查現有 UTable 用法再決定。

### Mock 資料修正

```typescript
// 只修改與 spec 預期不一致的值
// ❌ 不要重寫整個 mock
// ✅ 精確修改不匹配的欄位
```

**修改 mock 時必須維護 SSoT 一致性**（`.feature` Background 是 mock 資料的唯一真實來源）：

| 規則 | 說明 |
|------|------|
| **不改既有實體** | `.feature` Background 定義的實體，欄位值與關聯關係不可變更 |
| **只改補建資料** | 修正對象限於 Phase 1 擴充的補建實體 |
| **不改關聯關係** | 不可變更實體的父子關聯（如 team_id、player_id） |

> ⚠️ 若修 mock 會動到 `.feature` 原始實體，代表問題根因在 spec 或 flow，應優先修正 spec 而非 mock

### 避免的操作

- **禁止** 修改 `.spec.ts`（spec 是從 flow 生成的合約，禁止手動編輯）
- **禁止** 修改 `.flow.md`（flow 是業務需求，下游不可反向修改）
- **禁止** `globalThis.$fetch` 繞過型別檢查
- **禁止** 刪除現有功能來讓測試通過
- **禁止** 用 `test.skip` 跳過失敗測試來「通過」

### 上游回報格式

當判定為「spec 預期值與業務邏輯不符」（無法透過修改 UI/mock/API 解決）時，輸出以下報告並停止該測試的修復：

```
⚠️ 無法透過修改 UI/mock/API 解決：

失敗測試：{test name}
根因：{描述}（例：feature 04 變更了 TeamItem 結構，但 flow 07 的預期值未更新）
相關 flow：spec/e2e-flows/{NN}-{name}.flow.md > {具體段落}
建議修改：{flow 中需要更新的具體內容}

修復流程：
1. 更新 .flow.md
2. /test e2e spec {NN}（重新生成 spec）
3. /test e2e green {NN}（重新修復）
```

---

## 頁面路徑推斷表

| URL 模式 | 頁面檔案 |
|-----------|----------|
| `/` | `app/pages/index.vue` |
| `/login` | `app/pages/login.vue` |
| `/teams` | `app/pages/teams/index.vue` |
| `/players` | `app/pages/players/index.vue` |
| `/trainings` | `app/pages/trainings/index.vue` |
| `/trainings/history` | `app/pages/trainings/history.vue` |
| `/trainings/{id}` | `app/pages/trainings/[id]/index.vue` |
| `/trainings/{id}/analysis` | `app/pages/trainings/[id]/analysis.vue` |
| `/trainings/{id}/pitches/{pitchId}` | `app/pages/trainings/[id]/pitches/[pitchId].vue` |
| `/analysis` | `app/pages/analysis/index.vue` |
| `/analysis/{id}` | `app/pages/analysis/[id].vue` |

---

## Lint Gate（必須通過）

所有修復完成後，**必須執行 lint 修復並確認零錯誤**：

```bash
npm run lint --fix
npm run lint    # 確認 0 errors
```

> **重要**：修改 Vue 頁面或 spec 檔案後可能引入 lint 問題（未使用 import、未使用變數等）。不通過 lint 的程式碼會導致 pre-commit hook 失敗，無法 commit。

---

## 檢查清單

- [ ] `npm run lint` 零錯誤
- [ ] 執行紅燈收集失敗（或確認已全部通過）
- [ ] 每個失敗測試都有根因分析
- [ ] 修復遵循最小侵入原則
- [ ] 修復後重跑測試確認通過
- [ ] 未超過最大迭代次數（5 次）
- [ ] 輸出綠燈報告（含修復摘要）
- [ ] 修復的檔案符合 Nuxt 4 + Nuxt UI 規範
