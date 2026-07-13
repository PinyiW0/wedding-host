---
paths:
  - "app/**/*.vue"
  - "app/**/*.ts"
  - "server/**/*.ts"
---

# 程式碼品質驗證（強制）

每次完成程式碼修改後（包括新增、編輯、刪除檔案），必須執行：

```bash
npx eslint . --fix && npm run typelint
```

## 執行時機

- 完成一個功能或修改後（不是每改一個檔案就跑一次）
- 在回報「完成」之前
- 在準備 commit 之前

## 處理流程

1. 先執行 `npx eslint . --fix` 自動修正可修正的問題
2. 如果有 ESLint 錯誤無法自動修正，手動修正後重新執行
3. 執行 `npm run typelint` 檢查型別
4. 如果有型別錯誤，修正後重新執行直到通過
5. **兩者都通過後才算完成**

## Hydration 自查

改動 `.vue` 渲染輸出時自查一項：template 是否渲染 server/client 會算出不同值的表達式
（`colorMode.value`、`Date.now()`/`Math.random()`、`window`/`localStorage`、只在 client 成立的 v-if）
→ 包 `<ClientOnly>`（同尺寸 fallback）或移入 `onMounted`。
注意：persist 的 auth 狀態預設存 **cookie**，SSR 讀得到，不屬於 client-only 值。

## 常見問題

| 問題 | 原因 | 解法 |
|------|------|------|
| re-export 找不到型別 | 新增了 API 但沒定義對應型別 | 在 `app/types/api/` 下新增型別定義 |
| import 排序錯誤 | perfectionist 規則 | `eslint --fix` 自動修正 |
| `noUncheckedIndexedAccess` | tsconfig strict 模式 | 使用 `!` 斷言或加 null check |
