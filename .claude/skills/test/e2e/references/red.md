# E2E 紅燈（Phase: e2e red）

## 目標

執行指定 feature 的 `.spec.ts`，收集失敗測試，輸出結構化診斷報告。

> **紅燈 = 確認測試會失敗**。如果所有測試都通過，表示這個 feature 不需要修復。

---

## 指令格式

```bash
/test e2e red <feature>           # 單一 feature
/test e2e red <start> <end>       # 批次紅燈（多個 feature）
```

---

## 前置條件

| 檢查項 | 檔案 | 不存在時 |
|--------|------|---------|
| Spec 檔案 | `test/e2e/specs/{NN}-{name}.spec.ts` | 提示先執行 `/test e2e spec {NN}` |
| Playwright | `playwright.config.ts` | 提示先執行 `/test e2e setup` |

---

## 執行步驟

### Step 1：定位 spec 檔案

根據 `<feature>` 參數（編號或名稱）找到對應的 `.spec.ts`：

```
test/e2e/specs/{NN}-{name}.spec.ts
```

### Step 2：執行 Playwright 測試

```bash
npx playwright test test/e2e/specs/{NN}-{name}.spec.ts 2>&1
```

> **重要**：必須等待完整執行結果，不中斷。

### Step 3：分析測試結果

解析 Playwright 輸出，分類每個測試：

| 狀態 | 說明 |
|------|------|
| PASS | 測試通過 |
| FAIL | 測試失敗（需修復） |
| SKIP | `test.skip`（預期跳過） |

### Step 4：對每個 FAIL 測試進行根因分析

依序讀取以下資訊：

1. **錯誤訊息**：Playwright 的錯誤（Timeout、locator not found、text mismatch...）
2. **失敗行數**：`.spec.ts` 的具體斷言行
3. **對應 UI 檔案**：從測試的 `page.goto()` 路徑推斷頁面檔案

根因分類（Decision Tree）：

```
錯誤訊息
├─ "Timeout" / locator not found（getByRole / getByText / findEntity）
│  → 根因：語意 anchor 缺失（UI 缺 accessible name / role / 可見文字）
│  → 修復範圍：app/pages/ 或 app/components/（補語意標籤、aria-label、可見文字）
│  → 僅當 spec 用的是 flow 授權的 fallback testid 且 UI 缺該 testid → 補 data-testid
│
├─ "Expected to find element ... but found 0"
│  → 根因：元素不存在（功能區塊未實作或結構差異）
│  → 修復範圍：頁面模板（template 區塊）
│
├─ "Expected 'XXX' to contain text 'YYY'"
│  → 根因：文字不匹配
│  → 可能原因：
│     ├─ Mock 資料與預期值不一致 → 修 mock（spec 凍結，對不上時走上游回報）
│     ├─ API 回傳格式不同 → 修頁面顯示邏輯
│     └─ 數值格式化差異 → 修頁面（toFixed、%、單位）
│
├─ waitForApiCall / waitForRequest timeout（API spy 未捕捉到請求）
│  → 根因：UI 未發出預期 API 呼叫
│  → 可能原因：
│     ├─ 事件未接（按鈕沒綁 handler）→ 修事件處理
│     └─ 呼叫的 endpoint / method 與合約不符 → 對照 app/api/*.api.ts 修呼叫
│
├─ "Expected URL to match"
│  → 根因：導航未完成
│  → 可能原因：
│     ├─ 操作未觸發路由跳轉 → 修事件處理
│     └─ 疑似 spec 等待策略不足 → **不改 spec**（凍結），標記為「spec 問題」走上游回報
│
├─ "Expected to have count N but found M"
│  → 根因：列表行數不對
│  → 可能原因：
│     ├─ UTable 產生佔位行 → 標記「spec 問題」（spec 應以 findEntity / role+name 定位實體，不裸數 row）
│     ├─ 篩選邏輯有誤 → 修 API 或前端篩選
│     └─ Mock 資料筆數不對 → 修 mock data
│
└─ 其他
   → 記錄原始錯誤訊息，人工判斷
```

### Step 5：輸出診斷報告

---

## 診斷報告格式

```
E2E 紅燈報告：{NN}-{name}

  總計：{total} 測試
  ✅ 通過：{pass}
  ❌ 失敗：{fail}
  ⏭️ 跳過：{skip}

  失敗清單：

  1. ❌ {test.describe} > {test name}
     行數：spec.ts:L{line}
     錯誤：{error message（簡化）}
     根因：{語意 anchor 缺失 / 元素不存在 / 文字不匹配 / API spy 未觸發 / ...}
     修復：{app/pages/xxx.vue 補 accessible name（aria-label / 可見文字）/ 修改 mock data / ...}

  2. ❌ ...

  修復範圍摘要：
  - app/pages/sites/index.vue（3 處語意 anchor 缺失）
  - server/mock/data/sites.ts（1 處數值不匹配）
```

---

## 批次模式

```bash
/test e2e red 01 05    # 連續跑 spec 01 到 05
```

批次輸出格式：

```
E2E 紅燈批次報告：01 → 05

  01-{feature-A}       ✅ 全部通過（3 pass, 5 skip）
  02-{feature-B}       ❌ 1 fail / 2 pass / 1 skip
  03-{feature-C}       ❌ 3 fail / 1 pass / 0 skip
  04-{feature-D}       ❌ 2 fail / 1 pass / 1 skip
  05-{feature-E}       ✅ 全部通過（2 pass, 1 skip）

  失敗統計：6 fail / 9 pass / 8 skip（共 23 測試）

  需修復的 feature：02, 03, 04
```

---

## 全部通過時

如果所有測試都通過：

```
E2E 紅燈報告：{NN}-{name}

  ✅ 全部通過（{pass} pass, {skip} skip）
  此 feature 不需要綠燈修復。
```

---

## Playwright 規則參考

Playwright 語法規則的權威來源為 [spec.md](spec.md) >「Playwright 必遵守規則」。

> 如果發現 spec 違反這些規則，在報告中標記為「spec 問題」而非「UI 問題」。

---

## 檢查清單

- [ ] spec 檔案存在
- [ ] Playwright 成功執行完畢
- [ ] 每個 FAIL 測試都有根因分析
- [ ] 修復範圍摘要列出所有需修改的檔案
- [ ] 批次模式輸出匯總報告
