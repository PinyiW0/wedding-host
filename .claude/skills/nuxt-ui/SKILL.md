---
name: nuxt-ui
description: 載入 NuxtUI 官方文檔，用於查詢組件、API 和使用方式
argument-hint: "[component-name]"
---

# NuxtUI 文檔

載入 NuxtUI 官方文檔，用於查詢組件、API 和使用方式。

## 使用方式

```bash
/nuxt-ui                # 載入完整文檔
/nuxt-ui Button         # 查詢特定組件
/nuxt-ui Modal
/nuxt-ui Form
```

## 文檔來源

@https://ui.nuxt.com/llms.txt

---

## 使用指引

當回答 NuxtUI 相關問題時：

1. 從上方文檔中查找相關組件或 API
2. 提供具體的程式碼範例
3. 說明組件的 props、events 和 slots
4. 指出樣式定制選項（config、class）

---

## 常用組件分類

### Layout
- `UApp` - 應用容器
- `UContainer` - 內容容器
- `UCard` - 卡片

### Forms
- `UForm` - 表單
- `UFormField` - 表單欄位
- `UInput` - 輸入框
- `USelect` - 下拉選單
- `UCheckbox` - 核取方塊

### Elements
- `UButton` - 按鈕
- `UBadge` - 標籤
- `UAvatar` - 頭像
- `UIcon` - 圖標

### Overlays
- `UModal` - 對話框
- `UDrawer` - 抽屜
- `USlideover` - 側滑面板
- `UPopover` - 彈出框

### Navigation
- `UTabs` - 頁籤
- `UBreadcrumb` - 麵包屑
- `UPagination` - 分頁

### Data
- `UTable` - 表格
- `UAccordion` - 折疊面板

---

## 快速參考

### Toast

```typescript
const toast = useToast()
toast.add({
  title: '操作成功',
  description: '資料已儲存',
  color: 'success',
})
```

### 表單驗證

```vue
<script setup>
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, '請輸入名稱'),
})
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit">
    <UFormField label="名稱" name="name">
      <UInput v-model="state.name" />
    </UFormField>
  </UForm>
</template>
```

### 表格

```vue
<UTable
  :data="items"
  :columns="[
    { accessorKey: 'name', header: '名稱' },
    { accessorKey: 'status', header: '狀態' },
  ]"
/>
```
