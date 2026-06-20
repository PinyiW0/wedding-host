# Phase 5: 頁面實作

> ⚠️ **核心規則：一次只做一個頁面**
>
> Phase 5 **嚴禁在一次回應中處理多個頁面**。每個頁面必須走完完整流程（讀 spec → 對照表 → 實作 → 品質檢查 → 確認），
> 輸出確認格式後 **立即停止回應，等待用戶回覆後才處理下一個頁面**。
>
> 禁止行為：
> - 一次回應中連續實作多個頁面
> - 自動判斷「確認 OK」後繼續下一個頁面
> - 把多個頁面的確認合併在同一次回應中
>
> 正確行為：
> - 實作一個頁面 → 輸出確認格式 → **停止回應**
> - 用戶回覆後 → 開始下一個頁面

---

## 必讀規範

```
必須讀取：
- test/e2e/specs/{NN}-{name}.spec.ts（該頁面相關的所有 spec — testid、互動、斷言的唯一來源）
- ui-config.yaml > form（表單設定）
- ui-config.yaml > toast（通知設定）
- ui-config.yaml > colorMode（深淺模式）
- spec/report/route-map.yaml > 對應路由的 features_used（此頁面使用的 additionalFeature）
- page-builder.md（DSL 解析 + 表單範本 + 列表範本 + Command → 元件對照）
- features.md（僅 features_used 有值時需讀取，了解對應元件的使用方式）
- rules.md [P5] 段落（配色、對比色、Zod v4、Nuxt UI 類型、表單型別安全、API、第三方 import、Pinia Store、testid）

⚠️ 必須先掃描 API 端點結構：
執行 glob server/api/**/*.ts 取得實際 API 路徑列表

選讀（僅在需要時查閱）：
- 該功能對應的 .dsl.feature（查驗證規則邊界值，如「1-50 字元」）
- components.md（列表佈局範本、#empty slot 用法、拖曳排序、UCard ui props 等編碼慣例。元件 props/slots 已可從 .vue 原始碼讀取，不需重複查閱）

Sync 模式額外讀取：
- spec/report/sync-report.md（變更報告，決定每個頁面的執行模式）

執行 /nuxt-ui 載入組件文檔（若尚未載入）
```

> **設計理念**：Phase 5 的目標是「讓 .spec.ts 通過」。spec 已包含所有 testid（`getByTestId()`）、
> 互動模式（`.click()`, `.fill()`）、斷言預期（`toContainText()`, `toHaveCount()`）。
> 直接從 spec 抄 testid，不存在「兩個版本不一致」的問題。

---

## 前置檢查（Phase 5 Gate）

Phase 5 開始前，**必須確認 `.spec.ts` 存在**：

```bash
glob test/e2e/specs/*.spec.ts
```

- 若 `test/e2e/specs/` 下無任何 `.spec.ts` → 提示「請先執行 `/test e2e auto` 生成測試合約」並停止
- 若指定功能（如「球隊」）對應的 spec 不存在 → 提示「請先執行 `/test e2e spec <feature>` 生成該功能的測試合約」並停止

> **理由**：Phase 5 以 `.spec.ts` 為唯一 UI 合約。沒有 spec 就無法確保 testid 和互動模式正確。

---

## 模式判斷

Phase 5 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量 build** | 所有頁面從零實作（下方「全量模式執行步驟」） |
| `sync-report.md` **存在** | **增量模式** | 讀取「頁面實作指令」表格，按標記執行 ↓ |

### 增量模式 — 頁面執行標記

| 標記 | 模式 | 行為 |
|------|------|------|
| 新增 | **build** | 從零生成（同全量模式流程） |
| 修改 | **patch** | 讀現有程式碼 → 改動清單 → 確認 → Edit（見下方 patch 流程） |
| 重大變更 | **rebuild** | 重新生成但參考舊程式碼樣式（見下方 rebuild 流程） |
| 刪除 | **delete** | 確認後移除相關程式碼（見下方 delete 流程） |
| 無變化 | **skip** | 跳過 |

### 增量模式 — 刪除確認步驟（Phase 5 最先執行）

> ⚠️ **Phase 5 增量模式開始時，必須先處理刪除項目，再處理 build/patch/rebuild。**
>
> ⚠️ **刪除 ≠ 只刪型別和端點**。若被刪 feature 的 UI 程式碼在共用頁面上，**必須 patch 該頁面移除相關功能**，否則 UI 殘留已刪功能的程式碼，呼叫不存在的 API 導致執行時錯誤。E2E spec 也已刪除，無法捕捉此類回歸。

1. **讀取 sync-report 的「待刪除項目」區塊**
2. **分析被刪 feature 的 UI 影響**（⚠️ 關鍵步驟）
   - 讀取被刪 feature 的原始 `.dsl.feature`（若已刪除，從 sync-report 的說明和 route-map 歷史推斷功能）
   - 識別該 feature 貢獻的 UI 功能類型（如拖曳排序、批次操作、特定按鈕等）
   - 確認受影響的頁面（從 sync-report 的「影響頁面」欄位取得）
   - 讀取該頁面的現有程式碼，定位被刪 feature **專屬**的程式碼：
     - 第三方 import（如 `vuedraggable`）
     - 變數和 ref（如 `dragList`）
     - 函式和 handler（如 `handleDragEnd`）
     - template 區塊（如 `<Draggable>` 元件、sort handle 按鈕）
     - CSS class（如 `cursor-grab`）
   - **判斷標準**：該程式碼是否被頁面上其他 feature 使用？若僅被刪除的 feature 使用 → 列入待刪清單

3. **若有待刪除項目 → 向用戶確認**，格式如下：

   ```
   以下 Feature 已刪除，對應的程式碼需要清理：

   | 類型 | 項目 | 說明 |
   |------|------|------|
   | 頁面 UI | /players 排序功能 | 移除 vuedraggable import、dragList ref、handleDragEnd、<Draggable> 元件 |
   | 型別 | SortPlayersBody | 僅被 Feature 11 使用 |
   | API 端點 | PUT /api/players/sort | 僅被 Feature 11 使用 |
   | 欄位 | PlayerItem.sort_order | 排序功能移除後不需要 |

   確認要刪除以上項目嗎？（可逐項選擇保留或刪除）
   ```

   > 「頁面 UI」類型必須列出**具體要移除的程式碼項目**（import、ref、函式、模板區塊），不可只寫「移除排序功能」。

4. **用戶確認後執行刪除**：
   - **頁面 UI**（⚠️ 必須執行，不可跳過）：
     - 讀取頁面 `.vue` 原始碼
     - 逐一移除步驟 2 列出的 import、變數、函式、template 區塊（使用 Edit）
     - 若移除 `<Draggable>` 等元件，需替換為等效的靜態元素（如 `<tbody>` + `v-for`）
     - 執行 TypeCheck 確認無型別錯誤
   - 型別：移除 interface/type 定義及 re-export
   - API 端點：刪除對應的 `server/api/*.ts` 檔案
   - Mock 資料：移除相關函式和資料
   - **route-map.yaml**：移除對應的 feature 參照和 `api_contract` 條目（避免下次 sync 重複偵測）

5. **將受影響的共用頁面加入「頁面實作指令」**
   - 標記為 `patch`，說明為「刪除 Feature {NN} 的 UI 殘留程式碼」
   - 這確保後續的 E2E green 流程會跑該頁面剩餘 feature 的 spec，驗證無回歸

6. **用戶拒絕（或部分保留）→ 跳過被拒絕的項目，繼續後續流程**
7. **刪除完成後，進入正常的 build/patch/rebuild 流程**

---

## 全量模式執行步驟

1. **讀取該頁面相關的 `.spec.ts`**（核心輸入）
   - 掃描所有 `getByTestId('xxx')` → 提取完整 testid 清單
   - 掃描 `.fill()`, `.click()`, `selectOption()` → 了解互動模式
   - 掃描 `toContainText()`, `toHaveCount()`, `getByText()` → 了解斷言預期和錯誤訊息
   - 掃描 `test.skip()` 註釋 → 了解哪些情境無需 UI 實作
2. **⚠️ 強制前置讀取（每個功能都必須執行！）**
   - **掃描 API 結構**：`glob server/api/**/*.ts`
   - **讀取該頁面用到的 API endpoint 原始碼**：確認回傳格式、query/body 參數
   - **讀取該頁面用到的 `types/api/` 型別定義**：頁面必須 import 使用，禁止定義 local interface
   - **讀取該頁面用到的共用元件原始碼**（`app/components/common/*.vue`）：確認 props、slots、events 簽名
   - **讀取 Pinia store 原始碼**（若頁面需要）：確認 store 提供的方法和屬性
3. **⚠️ 實作前對照表（必須在寫 code 之前輸出！）**
   - 從 spec 的 `test.describe` / `test()` 標題提取 Scenario 清單
   - 比對 spec 互動模式 → UI 元件（**必須**查 [page-builder.md](page-builder.md) Command 對照表）
   - 產出「Spec → UI 對照表」，格式如下：

   ```
   Spec → UI 對照表（/players）：
   | Spec Scenario | 互動模式 | UI 元件 | testid |
   |--------------|---------|---------|--------|
   | 查詢球員列表 | locator('tbody tr') | UTable + 搜尋框 | player-list, player-search |
   | 新增球員 | fill() + click(submit) | Modal + 表單 | player-create, player-form-modal |
   | 編輯球員 | clear() + fill() | Modal + 表單（預填） | player-edit, player-name |
   | 刪除球員 | click(delete) + confirm | 確認 Modal | player-delete, confirm-ok |
   | 調整球員排序 | dragTo() | vuedraggable | player-sort-handle |
   ```

   > ⚠️ **此表是 code review 用的 checklist**：實作完成後，逐列打勾確認。若表中任何 Scenario 沒有對應 UI，必須補做。

4. **實作頁面**（基於步驟 1-3 的 spec 分析和讀取的實際程式碼）
   - 所有 `data-testid` **直接從 spec 的 `getByTestId()` 複製**，確保完全一致
   - **逐一檢查步驟 3 對照表，確保每個 Scenario 都有對應的 UI 實作**
   - **⚠️ build 模式（fallback 防漏）：檢查 Layout 導航是否已包含此路由**。Phase 3 應已處理導航同步，此處僅做最終確認。讀取 `app/layouts/default.vue`，確認 `navigation` 陣列是否有此頁面的連結。若無 → 加入導航項目（label、icon、to）
   - 若 spec 資訊不足以判定驗證邊界值（如「字長 1-50」），再查閱 `.dsl.feature` 的 Rule
5. **⚠️ 功能覆蓋驗證（必須執行！）**
   - 拿步驟 3 的對照表，逐列標記 OK 或 FAIL
   - 若有任何 FAIL → 補做後重新驗證
   - 檢查 Mock 資料量是否 ≥ 11 筆，不足則補建
6. **⚠️ 規範合規檢查（必須執行！）**
   - testid 是否全部對應 spec 的 `getByTestId()` 呼叫
   - 型別是否從 `types/api/` import（禁止定義 local interface）
   - 深淺模式是否正常（禁止寫死顏色值）
7. **若步驟 5-6 發現缺漏 → 修復後重新驗證**
8. **⚠️ 程式碼品質檢查（必須執行）**
   - 依序執行以下指令，針對本次新增或修改的檔案：
   ```bash
   npx eslint app/pages/xxx.vue --fix          # ESLint 檢查 + 自動修復
   npx prettier --write app/pages/xxx.vue      # Prettier 格式化（含 Tailwind class 排序）
   npm run typelint                             # TypeCheck 型別檢查
   ```
   - 有錯誤 → 修復後重新執行，直到全部通過
   - **三項全部通過才可進入下一步**
9. **向用戶確認（必須使用下方結構化格式，包含步驟 3 的對照表）**
10. **⚠️ 輸出確認格式後立即停止回應，等待用戶回覆後才處理下一個頁面**

## 每個功能必讀資源 Checklist

> 每個功能開始實作前，必須讀取以下資源：
> - **核心輸入**：`test/e2e/specs/{NN}-{name}.spec.ts`（testid + 互動 + 斷言，Phase 5 的唯一 UI 合約）
> - **共用規範**：rules.md、page-builder.md
> - **共用元件**：`app/components/common/*.vue`（讀原始碼即可，不需 components.md）
> - **API 總覽**：`glob server/api/**/*.ts`
> - **該功能專屬**：API endpoint 原始碼、`types/api/` 型別、Pinia store（若需要）
> - **選讀**：`.dsl.feature`（驗證邊界值）、`components.md`（編碼慣例/範本）、`features.md`（additionalFeature 用法）

## 實作順序建議

1. 認證（登入/登出）
2. 主要 CRUD（球隊 CRUD）
3. 關聯資料（球員管理）
4. 進階功能

## 單一功能完成後的確認格式（必須使用）

> ⚠️ 若覆蓋表有任何 FAIL，**必須先修復再向用戶確認**。

```
「XXX」功能已完成

已建立/修改：
- `app/pages/xxx.vue`
- ...

Scenario 覆蓋：
| Scenario | 對應 UI | 狀態 |
|----------|---------|------|
| 查詢球員列表 | UTable + 搜尋框 | OK |
| 建立球員 | Modal + 表單 | OK |
| 調整球員順序 | vuedraggable | OK |
| 刪除球員 | 確認 Modal | OK |

資料驗證：
- Mock 資料：12 筆（≥11 OK）
- API 路徑：全部確認 OK
- testid：對應 .spec.ts OK

品質檢查：
- ESLint：通過
- Prettier：通過
- TypeCheck：通過

下一個頁面：`/feature-to-ui 5 {頁面名}`
```

> ⚠️ **最後一個頁面確認時**：將結尾替換為「Phase 5 全部完成。下一步：`/test e2e green auto`」
>
> ⚠️ **輸出以上確認格式後，必須立即停止回應。禁止在同一次回應中繼續處理下一個頁面。**

## 頁面實作範本

詳見 [page-builder.md](page-builder.md)

---

## Patch 模式流程（sync 增量修改）

> 適用於 sync-report 標記為「修改」的頁面。目標：**最小化改動，保留現有程式碼**。

### 步驟

1. **讀取 sync-report 中該頁面的變動項**
   - 確認哪些 feature 有變更、變更內容是什麼
2. **讀取受影響的 `.spec.ts`**（重新生成的 spec，包含更新後的 testid 和斷言）
3. **讀取現有 `.vue` 原始碼**
4. **讀取相關資源**（types/api、API 端點、共用元件、store）
5. **定位驗證**（確認 patch 目標程式碼存在）
   - 針對每個預計修改的區塊，用 Grep 確認現有程式碼中存在預期的目標（如 schema 變數名、函式名、template 區塊）
   - 找到 → 繼續 Edit
   - 找不到 → **自動升級為 rebuild**，向用戶說明原因
   - 常見定位目標：`const schema = z.object`、`function openCreate`、`<UFormField label=`、`data-testid=`
6. **逐項 Edit**（使用 Edit tool，不 Write 整個檔案）
7. **⚠️ 程式碼品質檢查（必須執行）**
   - 依序執行以下指令，針對本次修改的檔案：
   ```bash
   npx eslint app/pages/xxx.vue --fix
   npx prettier --write app/pages/xxx.vue
   npm run typelint
   ```
   - 有錯誤 → 修復後重新執行，直到全部通過
8. **完成後確認**（一次確認即可）

   ```
   Patch 完成：/teams

   受影響的 Features：
   - 04-建立球隊.dsl.feature（修改：新增 description 欄位）

   修改摘要：
   - [template] 建立表單 Modal → 新增 description 輸入欄位（UTextarea）
   - [script] handleCreate 函式 → body 物件新增 description 欄位

   Scenario 覆蓋（含未變更 feature）：
   | Scenario | 狀態 | 備註 |
   |----------|------|------|
   | 查詢球隊列表 | OK 未動 | 03 無變化 |
   | 建立球隊 | OK 已更新 | 新增 description |
   | 刪除球隊 | OK 未動 | 05 無變化 |

   品質檢查：
   - ESLint：通過
   - Prettier：通過
   - TypeCheck：通過

   下一個頁面：`/feature-to-ui 5 {頁面名}`
   ```

   > ⚠️ **最後一個頁面確認時**：將結尾替換為「Phase 5 全部完成。下一步：`/test e2e green auto`」
   >
   > ⚠️ **輸出以上確認格式後，必須立即停止回應。禁止在同一次回應中繼續處理下一個頁面。**

8. **功能覆蓋驗證**（含未變更 feature 的 Scenario 確認，確保 patch 沒有破壞既有功能）

### Patch 注意事項

| 情況 | 處理 |
|------|------|
| patch 找不到預期的程式碼位置 | 在改動清單中標記「⚠️ 無法定位，建議改用 rebuild」，用戶確認 |
| 手動改過的 Vue 被 patch | patch 只 Edit 受影響部分，不動其他程式碼，手動修改保留 |
| 多 feature 對應同一頁面，只有部分改 | patch 只改受影響的區塊，確認清單列出「不影響的部分」 |

---

## Rebuild 模式流程（sync 重大變更）

> 適用於 sync-report 標記為「重大變更」的頁面。目標：**完整重寫，但保持原有風格**。

### 步驟

1. **讀取現有 `.vue` 程式碼**，記錄風格特徵：
   - 排版慣例（縮排、空行風格）
   - 命名慣例（變數名、函式名風格）
   - 元件使用方式（slot 寫法、props 傳遞風格）
   - 自訂邏輯（手動加的額外功能）
2. **向用戶確認覆蓋範圍**（列出步驟 1 記錄的自訂邏輯摘要）：
   ```
   Rebuild 將覆蓋：/teams

   偵測到的自訂邏輯（將被覆蓋）：
   - handleExport() 函式（手動新增的匯出功能）
   - 自訂的 CSS class .team-highlight

   （若無自訂邏輯則顯示「無自訂邏輯，可直接覆蓋」）

   確認後開始 rebuild？
   ```
3. **按 build 模式完整走一遍**（讀 spec → 對照表 → 實作 → 驗證），確認格式同 build 模式
4. **生成時參考舊程式碼風格**，保持一致
5. **整檔覆蓋**（Write），因為變更幅度太大，Edit 反而容易出錯
6. **最後一個頁面確認時**：結尾替換為「Phase 5 全部完成。下一步：`/test e2e green auto`」

### Rebuild 注意事項

| 情況 | 處理 |
|------|------|
| 手動改過的 Vue 被 rebuild | rebuild 會整頁覆蓋，手動修改消失（**預期行為**，應回推 SDD 修正 feature） |
| 想保留手動修改 | 應使用 patch 模式，或先將手動修改回推到 .feature |
