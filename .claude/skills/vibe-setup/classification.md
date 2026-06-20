# Vibe 分類規則（共用）

> 這份規則由 `vibe-setup` 與 `vibe-e2e` 共用。改 grep pattern 或 sub-pattern mapping 只改這裡，兩個 skill 行為自動同步。

## 優先序

對每個 diff hunk 依序判斷：**結構新增 → 互動行為 → 純 visual（fallback）**。

命中前一類就停，不再往下檢查。

---

## 1. 結構新增（最高優先）

命中以下任一 grep pattern → 歸「結構」：

```
# 新語意區塊（新增的開頭標籤）
^\+\s*<(section|article|header|footer|aside|main)\b

# 狀態 UI（loading / error / empty）的 v-if
v-if\s*=\s*["']\s*(loading|isLoading|pending|fetching)
v-if\s*=\s*["']\s*(error|isError|hasError|failed)
v-if\s*=\s*["']\s*!?\s*(items|data|list|results)\.(length|value)

# 狀態 UI 元件
^\+\s*<(UAlert|USkeleton|UProgress|UEmpty|UCard)\b
```

進一步標記 sub-pattern：

| 命中 | sub-pattern |
|---|---|
| `loading/isLoading/pending/fetching` 條件 / `USkeleton` / `UProgress` | `loading-state` |
| `error/isError/hasError/failed` 條件 / `UAlert` | `error-state` |
| `!items.length` 等空集合條件 / `UEmpty` | `empty-state` |
| `<section/article/header/footer/aside/main>` 新增 | `new-region` |
| `<UCard>` 新增（且非上述狀態 UI 情境）| `new-region` |

---

## 2. 互動行為

未命中結構、但命中以下任一 → 歸「互動」：

```
# Vue 指令 / 事件
^\+.*\bv-if\s*=         # 結構優先吃掉，這裡剩下的是一般條件渲染
^\+.*\bv-show\s*=
^\+.*\bv-else
^\+.*@(click|mouseenter|mouseleave|focus|blur|input|change|keydown)\b

# 響應式狀態翻轉
^\+.*\b(ref|reactive)\s*\(\s*(true|false)\b
^\+.*\.value\s*=\s*!
^\+.*\b(open|expanded|collapsed|visible|active)\b.*=\s*(true|false)

# 互動元件
^\+\s*<(UTabs|UCollapsible|UAccordion|UModal|UPopover|UDrawer|UTooltip)\b
```

進一步標記 sub-pattern：

| 命中 | sub-pattern |
|---|---|
| `UTabs` 或 `tab-*` 命名 ref | `tab` |
| `UCollapsible` / `UAccordion` / `open/expanded/collapsed` ref + toggle | `toggle` |
| `UModal` / `UDrawer` / `UPopover` / `visible/open` ref + toggle | `modal-toggle` |
| `v-if` / `v-show` 為一般條件變數（非 loading/error/empty）| `conditional-render` |
| `@mouseenter` / `@mouseleave` / hover class | `hover` |
| 其他 `@click` 改變狀態 | `interaction` |

---

## 3. 純 visual（fallback）

跑完結構 + 互動都沒命中 → 歸「visual」。

正面 sanity check（這些 + 行應該占多數）：

```
^\+.*\b(class|:class)\s*=                       # className 變化
^\+\s*<\w*Icon\b                                 # icon 元件
^\+\s*import\s+\{[^}]+\}\s+from\s+["']lucide-vue-next  # icon import
```

---

## 4. 邊界 case 人工判斷

grep 抓不出的，Claude 看上下文：

| 情況 | 怎麼判 |
|---|---|
| `v-if="loading"` 包在原本就有的 `<section>` 裡 | 結構優先；但若 loading UI 原本就在、只是改 className，降回 visual |
| `@click` 從 A 按鈕搬到 B 按鈕（行為不變）| 視同 visual（建議仍跑主 spec confirm，但這由使用者決定） |
| 新 import 但 template 沒實際使用 | 略過該 hunk |
| `ref(false)` 是常量初始值不是互動狀態 | 看後續有沒有 toggle / template binding，沒有則略過 |
