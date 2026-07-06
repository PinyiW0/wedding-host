# 視覺層級規範（issue #19）

修改 `app/pages/`、`app/components/`、`app/layouts/` 時遵守。核心原則：**一個畫面只有一個主焦點**——標題層級不重複，空狀態永遠最低調。

## 字級層級（由高到低）

| 層級 | 用途 | Class | 每頁數量 |
|------|------|-------|---------|
| 主標題 | 頁面唯一大標 | 管理頁用 `PageHeader`（`font-display text-h2` + eyebrow）；公開賓客頁用 `font-display text-display-l` | **一頁一個** |
| 區塊標題 | 頁內分區 | `text-overline uppercase text-gold-deep`（可配 `h-px bg-line` 分隔線） | 不限 |
| Modal / Slideover 標題 | 覆蓋層標題 | `text-body-l font-semibold text-ink dark:text-paper`（**不用 font-display，不用 text-h2**） | — |
| 卡片 / 項目標題 | 列表項、卡片 | `text-body font-medium` 或 `text-body-l font-semibold` | 不限 |
| 空狀態 | EmptyState 元件 | `text-body text-ink-500`（元件內建，**無 icon、無大字、透明底**——背景一律跟頁面底色走，不自帶底色）；複雜多區塊 layout 加 `bordered`（虛線細框標出區塊邊界）；撐滿容器時外部傳 `class="flex-1"` | 最低層級 |

## 數值展示（非標題，不受上表限制）

- 統計卡數值（StatCard、儀表板、採購參考）：`font-display text-h2 font-semibold` 允許——數值是資料不是標題
- 純裝飾大字（序號錨點、謝卡簽名）：允許，但需降低透明度或用於獨立卡面

## 禁止

- 頁內 section 標題用 `font-display text-h2`（會與 PageHeader 主標同級互搶）
- Modal 標題用 `text-h2`（統一 `text-body-l font-semibold`）
- EmptyState 加大字、icon 或裝飾（它的職責是安靜地說「沒資料」，不是搶焦點）
- 一個畫面出現兩個以上 `font-display` 大字標題

## 文字與配色層級

沿用 `feature-to-ui/references/rules.md`：主要文字 `text-ink dark:text-paper`、次要文字 `text-ink-500 dark:text-neutral-400`、輔助說明 `text-ink-300`；金色（`text-gold-deep`）只用於 overline 眉標與強調，不做大面積標題色。
