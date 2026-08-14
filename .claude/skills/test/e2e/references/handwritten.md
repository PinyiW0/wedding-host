# E2E Handwritten（Phase: e2e handwritten）

## 目標

針對 vibe 視覺/互動細節產出**手寫**測試，**diff-driven**：依使用者目前的 UI 變動範圍寫測試，與 flow 生成的 spec 嚴格分離。

| 類別 | 位置 | 來源 | 可改？ |
|---|---|---|---|
| spec | `test/e2e/specs/` | flow.md 生成 | ❌（合約） |
| handwritten | `test/e2e/handwritten/` | UI diff 推導 | ✅（隨 vibe 演進） |

## 指令格式

```bash
/test e2e handwritten              # 自動：working tree + HEAD~1 累積 UI diff
/test e2e handwritten <path>       # 指定範圍，如 app/pages/accounts/index.vue
/test e2e handwritten --since main # 對 main 抓累積 diff
```

## 前置條件

| 檢查項 | 不存在時 |
|---|---|
| `test/e2e/helpers/` | 提示先 `/test e2e setup` |
| 有任何 UI diff（working tree 或最近一次 commit） | 提示「無 UI 變動，無需手寫測試」 |

---

## 執行步驟

### Step 1：抓 UI 變動（working tree + HEAD~1 都掃）

```bash
git diff HEAD~1 -- app/pages app/components app/layouts
git diff -- app/pages app/components app/layouts
git diff --cached -- app/pages app/components app/layouts
```

合併三者並去重，得到「自上一個 commit 起的累積 UI 變動」。

### Step 2：分類每個 hunk

| hunk 變動 | 分類 | 動作 |
|---|---|---|
| 新增/刪除 `data-testid` | **vibe-test 候選** | 鎖該 testid 出現/消失 |
| 新增條件渲染 `v-if`、`v-show` | **vibe-test 候選** | 觸發條件後斷言可見性 |
| 改 `class` 影響 hover/focus/transition | **vibe-test 候選** | 互動後斷言 `data-state` / `class` |
| 新增 `@click`、`@keydown`、`@hover` | **vibe-test 候選** | 模擬事件 + 斷言副作用 |
| 改 `:data-*` 綁定（如 `:data-loading`、`:data-state`） | **vibe-test 候選** | 觸發 → 屬性值斷言 |
| 改文字、icon、color、間距 | **跳過**（純展示） | 視覺回歸交給人眼 |
| 改 `<script>` 業務邏輯 | **轉介給 spec** | 提示「應由 flow 涵蓋」 |
| import / 排序 / 格式 | **跳過** | 無意義 |

### Step 3：與既有 spec 去重

讀 `test/e2e/specs/*.spec.ts`，列出所有已斷言的 testid 集合。
若候選的 testid/行為已在 spec 出現 → 標記「跳過（spec 已涵蓋）」。

### Step 4：提案 → 等使用者確認（**強制**）

輸出格式：

```
偵測到 N 處值得鎖定（從 X 處變動中過濾）：

[1] app/pages/accounts/index.vue:312
    新增 @keydown.esc="closeModal" 於 account-create-modal
    建議測試：accounts | esc 關閉建立帳號 modal

[2] app/components/WatchCard.vue:45
    新增 :data-state="loading ? 'loading' : 'idle'"
    建議測試：watch-card | loading 狀態屬性

[3] app/pages/watch/[watchId].vue:528
    sighting-favorite-button 新增 :data-favorited
    跳過：04-watch.spec.ts:56 已涵蓋

要產出 [1][2] 嗎？(y / n / 1,2 / 選擇)
```

使用者確認後才動筆。

### Step 5：產出 / 合併檔案

**同頁同檔多個 describe**：對同一頁的多個變動，**合併到單一 `.spec.ts`**，用多個 `test.describe` 區分主題。

檔名規則：`test/e2e/handwritten/<page-slug>.spec.ts`

- `page-slug` 從變動檔路徑推：
  - `app/pages/accounts/index.vue` → `accounts`
  - `app/pages/watch/[watchId].vue` → `watch-detail`
  - `app/components/WatchCard.vue` → `watch-card`
  - `app/layouts/default.vue` → `default-layout`

若檔已存在：**新增 describe，不覆寫**現有的。

範本：

```typescript
// test/expect 走 ../helpers（掛 hydration 守門 fixture），不直接 import @playwright/test
import { expect, login, resetMockData, test } from '../helpers'

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
})

test.describe('accounts | esc 關閉建立帳號 modal', () => {
  test('開啟 modal 後按 Esc 關閉', async ({ page }) => {
    // Given —— 語意 locator：按鈕用 role+name、modal 用 dialog role
    await login(page, 'admin', 'admin888')
    await page.goto('/accounts', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /新增帳號/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // When
    await page.keyboard.press('Escape')

    // Then
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})

test.describe('accounts | <下一個主題>', () => {
  // ...
})
```

---

## 鐵則

1. **diff 沒動的不寫**：避免膨脹，handwritten 只反映「最近 vibe 的足跡」
2. **spec 已測的不寫**：去重
3. **純展示變動不寫**：色、文字、icon、間距不該綁死，會卡死後續微調
4. **業務邏輯變動不寫**：回報「這應改 flow.md 重生 spec」，handwritten 不補救
5. **同頁同檔**：合併到單一 .spec.ts，多 describe，便於檢視
6. **語意 locator 優先，testid 是 fallback**：先用 `getByRole` + accessible name、`getByLabel`、可見文字；只有語意無法消歧時才用 testid，且**限用主 spec 合約白名單內既有的 testid**，不自創（自創 = 孤兒，見 `vibe-e2e/SKILL.md` 的 `orphan-testid`）。規範 SSOT 見 [testid-conventions.md](../../../feature-to-flow/references/testid-conventions.md)。禁止用 class / CSS selector 定位（那才是真的會被 vibe 改壞的東西）
7. **不要動 spec/flow**：和 green phase 一樣，這是合約

---

## 完成輸出

```
E2E Handwritten 已建立 / 更新：
- test/e2e/handwritten/accounts.spec.ts（新增 2 個 describe）
- test/e2e/handwritten/watch-card.spec.ts（新檔，1 個 describe）

跳過（spec 已涵蓋）：
- sighting-favorite-button data-favorited → 04-watch.spec.ts:56

純展示變動（不鎖）：
- accounts 列表 hover 顏色從 neutral-50 → primary-50

下一步：
- npx playwright test test/e2e/handwritten/
- 紅燈：直接調 UI 或測試本體（不像 spec 是合約）
```

---

> ⚠️ **執行範圍**：`test/e2e/handwritten/` 不在任何 playwright config 的 testDir / gate 範圍內（設計如此）——只能手動 `npx playwright test test/e2e/handwritten/` 執行，pre-push gate 不會跑它。

---

## 與 spec 的分工速查

| 情境 | 寫在哪 |
|---|---|
| acc-001 應出現在列表 | spec |
| 列表 hover 變色 / 動畫 | **跳過（純展示）** |
| 刪除帳號回 toast「刪除成功」 | spec |
| Esc 關閉 modal | **handwritten** |
| Modal 內 autofocus 第一個 input | **handwritten** |
| 修改密碼成功後 modal 應關閉 | spec |
| 按鈕 `:data-loading` 在送出中為 true | **handwritten** |
