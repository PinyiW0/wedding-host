# Business Invariant Constants 規範

集中管理 Business Invariant 文字的型別常數檔。UI 與主 spec 同 import，由 TypeScript 在 compile time 保證對齊，取代 runtime 文字比對。

## 適用條件

本規範屬於**強建議**，適用於同時滿足以下條件的專案：

- 採用 SDD workflow（`.flow.md` → spec → UI）
- 採用 vibe iteration 工作流（spec 凍結，UI 可自由 vibe）
- 主 spec 的 invariant 字串數量 ≥ 10 個
- IDE 即時 TypeScript checking 為團隊預設工作環境

不滿足以上任一條件時，本規範**可降為參考**，hardcode + [feature-to-ui rules.md `[P5]`](../../feature-to-ui/references/rules.md) 的「禁翻譯 / 禁同義詞」規則仍夠用。

## 動機

`.flow.md` 的 Business Invariants 段定義「不可改可見文字」——這是業務合約。傳統做法靠 spec runtime 跑 `getByText` 驗證，缺點：

- UI 端隨手改字 → runtime 紅燈 → 浪費迭代輪
- spec 因 UI 端混用同義詞被迫用 regex 集合，弱化合約精度
- vibe iteration 時 spec 跑全套很慢，「跑」vs「不跑」皆痛

**結構性預防**：UI 與 spec 都從同份 typed constants import，runtime 漂移從根本消除。

## 檔案位置

| 約定 | 路徑 |
|------|------|
| 預設位置 | `app/constants/invariants.ts` |
| Monorepo / 共用 package | 視專案結構調整，但**單一檔案 SSOT**，不可多份 |

UI 與 spec 都從同一路徑 import。spec 端可能需要設定 path alias（`tsconfig.json` + `playwright.config.ts` 的 resolver）。

## 結構

```typescript
/**
 * Business Invariant text constants.
 * Source of truth: .flow.md Business Invariants section.
 * UI templates and E2E specs MUST import from here; never hardcode literal strings.
 */

export const {GROUP_A} = {
  {STATE_KEY_1}: '{invariant text 1}',
  {STATE_KEY_2}: '{invariant text 2}',
} as const

export const {GROUP_B} = {
  {KEY_1}: '{text 1}',
  // ...
} as const
```

**約定**：

- 用 `as const` 確保字串字面型別（不退化為 `string`）
- 群組用 `SCREAMING_SNAKE_CASE`
- 鍵用 `SCREAMING_SNAKE_CASE`
- 值是字串字面，不轉義、不模板

## 分組原則

依「業務語意層次」分組，**不**依「使用的頁面」分組（避免一個字串跨頁時混亂）。

| 分組類型 | 用途 | 命名範例 |
|---------|------|---------|
| **Status** | 業務狀態詞（連線/離線、進行中/已結束、啟用/停用 等） | `{ENTITY}_STATUS`、`CONNECTION_STATUS`、`ORDER_STATUS` |
| **Feedback** | 操作結果回饋（成功/失敗/處理中）| `FEEDBACK`（含 `CREATE_SUCCESS`、`DELETE_SUCCESS`、`UPDATE_SUCCESS`...）|
| **Empty State** | 空狀態提示 | `EMPTY_STATE`（含 `{CONTEXT}_NO_DATA` 等鍵）|
| **Page / Section identity** | 頁面標題、業務名詞 | `PAGE_TITLE`、`DOMAIN_LABEL` |
| **Error message（業務級）** | UI 端顯示的業務錯誤詞（非 API server 端） | `BUSINESS_ERROR` |

## 該進與不該進

✅ **該進常數檔**：

- `.flow.md` Business Invariants 段明示的「不可改可見文字」
- 跨頁出現、應該保持一致的狀態詞
- 多次出現、避免漂移的 toast / feedback 訊息

❌ **不該進常數檔**：

- **Fixture / mock seed data**（測試用業務資料，屬於 `server/mock/` 範疇）
- **API server error message**（屬於 `server/api/` 的 `createError({ message })` 合約）
- **純 UI label**（按鈕文字、form label、placeholder——這些 vibe 可動）
- **動態組合字串**（如「`已建立 ${n} 筆`」——只把 invariant 部分入常數，數字用模板）
- **單次出現的純裝飾文字**

## 與其他 skill 的銜接

| skill | 行為 |
|-------|------|
| `/feature-to-flow` | `.flow.md` 的 Business Invariants 段定義「該進常數」的清單來源 |
| `/feature-to-api` | 建立 / 維護 `invariants.ts`（與 types、mock 並列） |
| `/feature-to-ui` | UI template **只能** import 常數，不可 hardcode 字面（見 [feature-to-ui rules.md `[P5]`](../../feature-to-ui/references/rules.md)）|
| `/test e2e spec` | spec 內 `getByText` / `toContainText` 字面也**只能** import 常數（見 [spec.md](../../test/e2e/references/spec.md)）|

## 遷移指引（既有專案逐步引入時）

1. **盤點**：grep spec 的 `getByText` / `toContainText` 字面字串、grep UI hardcode 對應字串
2. **分類**：依「該進 / 不該進」清單篩選
3. **設計分組**：依業務語意層次劃分群組
4. **建檔**：建立 `invariants.ts`
5. **改 spec**：assertion 改用常數 import
6. **改 UI**：對應 hardcode 改用常數 import
7. **驗證**：跑 `npx playwright test` 全綠
8. **TS 編譯**：跑 `npx tsc --noEmit` 確認沒有殘留字面 mismatch

## 為什麼放在 feature-to-api 而非 feature-to-ui

`invariants.ts` 是型別合約的一部分（與 `types/api/` 同層次），由 `/feature-to-api` 負責建立與維護。UI 與 spec 是消費端。把規範放在生產端，避免「兩個消費端各自定義」的衝突。
