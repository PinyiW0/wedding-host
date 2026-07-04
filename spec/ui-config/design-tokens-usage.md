# Editorial Luxe — 設計 Token 使用規範

本檔定義既有設計 token（`app/assets/css/main.css` 的 `@theme static`）在頁面中的「使用對照」，目的是消除手寫 class 的漂移（如突然冒出 `bg-zinc-200`、`text-2xl`、`p-8`）。

**所有 token 都已存在，本檔只規範「哪一層用哪一個」。** 修改 `app/pages/`、`app/components/`、`app/layouts/` 時請對照本表，不要繞過系統自創 class。

---

## 1. 文字層級

| 層級 | class | 尺寸 | 用途 |
|------|-------|------|------|
| 頁面 Hero | `font-display text-display-l font-semibold` | 64px | 對外賓客頁大標（RSVP 填寫頁） |
| 頁標題 | `font-display text-h2 font-semibold` | 32px | `PageHeader` 標題 |
| 區塊小標 | `text-overline uppercase text-gold-deep` | 12px | 區塊 eyebrow（搭配金線，見 `PageHeader`） |
| 卡片主文 | `font-display text-body-l font-medium` | 18px | 卡片內主要名稱／標題 |
| 正文 | `text-body` | 15px | 一般內文、表格儲存格 |
| 輔助說明 | `text-caption text-ink-500` | 12px | 次要資訊、欄位說明 |

**禁止**：`text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl`。
**已知特例**（屬刻意設計，保留）：
- 接待頁（`reception/index.vue`）賓客姓名 `text-2xl` — 報到時遠距辨識
- 喜餅頁（`cake-box.vue`）訂單總額 `text-xl` — 關鍵金額強調
- 桌次圖（`seating.vue`）圓圈內桌名 `text-lg` / `text-base` — 資料視覺化的主桌／一般桌相對字級

---

## 2. 間距

- **卡片 padding**：`p-5`（內容卡）、`p-6`（KPI／重點卡）
- **頁面大分區間距**：`space-y-8`（如「進行中 ↔ 回收區」「統計 ↔ 列表」）；避免 `space-y-10` / `space-y-12` 這種過大切割
- **區塊內群組**：`space-y-4` ~ `space-y-6`
- **水平間距**：`gap-3`（緊湊）、`gap-4` / `gap-6`（區塊層級）、`gap-8`（grid 欄間）

---

## 3. 卡片 / 表面色

| 用途 | class |
|------|-------|
| 內容卡 | `rounded-lg border border-line bg-white shadow-sm`（dark: `bg-neutral-900`） |
| 凹陷 well（摘要、額外配發） | `rounded-lg bg-paper` |
| 回收／停用區 | `rounded-lg border border-dashed border-line bg-paper` |
| 頁面底色 | `bg-cream`（layout 已設，頁面不需重設） |

**禁止**：`bg-zinc-*` / `bg-gray-*` / `bg-neutral-100` 當卡片底（一律 `bg-paper`）；`border-gray-*`（一律 `border-line`）。

---

## 4. 狀態徽章

一律使用 `<StatusBadge :color="...">`，顏色來源為 `app/utils/statusMeta.ts`（單一事實來源）。`variant` 一律 `soft`，`size` 預設 `sm`（接待大螢幕可 `md`）。

| 語意 | color | 範例狀態 |
|------|-------|---------|
| 正向 | `success` | 出席、已報到、已通過、已連結、進行中 |
| 警示／待處理 | `warning` | 待回覆／未提交、未報到、待審、受限 |
| 負向 | `error` | 不出席、缺席、已拒絕 |

> ⚠️ **label 是凍結 e2e 合約**（`getByText` 定位）。修改 `statusMeta.ts` 時可調整顏色，但既有狀態文字一字不可改。RSVP 的 `null` 狀態文字因頁面語境而異（管理頁「未提交」、名單頁「待回覆」），由 `rsvpAttendingMeta` 的 `pendingLabel` 參數指定。

---

## 5. 品牌色（金箔）

- **強調線 / icon / active 態**：`text-gold` / `bg-gold` / `text-gold-deep`
- **主要行動按鈕**：`color="primary"`
- ⚠️ 切勿用 `primary` 金色表達「限制／負向」語意（那會讓金色像 VIP 而非警示）——限制／警示用 `warning`，危險用 `error`。

---

## 6. Canvas 繪圖配色（桌次圖下載）

`seating.vue` 的桌次圖下載（`buildChartCanvas`）是 canvas 繪圖，無法用 Tailwind class，改以 `CHART` 常數集中管理，**值對齊 main.css token**，使下載圖與畫面語意色一致：

- 基礎：`CHART.ink`（桌名／主標）、`CHART.inkSoft`（ink-500 副標）、`CHART.inkFaint`（ink-300 舞台）、`CHART.line`（舞台框）
- 餐點分類對齊 DOM 的 `cls` 語意色：素食=success、葷食=info、含素=primary(gold)、空桌=line/ink-300（各取 100 / 600 / 700 階作 fill / stroke / text）

> 新增 canvas 顏色時從 `CHART` 取值，不要再硬寫 hex；分類色須與 `mealCategory()` 的 `cls`（DOM class）保持同語意。
