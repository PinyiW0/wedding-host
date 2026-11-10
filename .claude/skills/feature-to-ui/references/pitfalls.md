# Phase 5 Pitfalls

> Phase 5 開工前讀；每條來自衍生專案實測。第 7、8 條已寫進 Phase 1 步驟，第 9 條已寫進 Phase 3 範本，第 12 條已寫進 Phase 2 範本；留在這裡供 Phase 5 自檢。

## 目錄

1. [送出鈕必須明寫 type="submit"](#1-送出鈕必須明寫-typesubmit)
2. [UInput type="number" 的 role 是 spinbutton](#2-uinput-typenumber-的-role-是-spinbutton)
3. [Radix dialog 開啟時背景整片 inert](#3-radix-dialog-開啟時背景整片-inert)
4. [切換鈕 aria-label 撞到欄位 label](#4-切換鈕-aria-label-撞到欄位-label)
5. [實體名稱只渲染一次](#5-實體名稱只渲染一次)
6. [可空欄位一律 fallback 文字](#6-可空欄位一律-fallback-文字)
7. [Nuxt Icon 必裝本地 collection](#7-nuxt-icon-必裝本地-collection)
8. [自訂 neutral 色不可叫 neutral](#8-自訂-neutral-色不可叫-neutral)
9. [避免巢狀 main](#9-避免巢狀-main)
10. [建立成功後跳到該筆所在分頁](#10-建立成功後跳到該筆所在分頁)
11. [分頁筆數不挑「剛好夠用」的數字](#11-分頁筆數不挑剛好夠用的數字)
12. [公開路由比對禁 startsWith](#12-公開路由比對禁-startswith)

---

## 1. 送出鈕必須明寫 type="submit"

**症狀**：在 `UForm` 裡按送出鈕，表單沒有送出、`@submit` 沒觸發。

**原因**：NuxtUI 4.12 的 `UButton` 把 `type` 傳給 `ULink`，`ULink` 的 `type` 預設是 `"button"`。所以沒寫 `type` 的 `UButton` 渲染成 `<button type="button">`，不會送出表單。原生 `<button>` 沒寫 type 時預設 submit，這條在 `UButton` 不成立。

**做法**：送出鈕一律寫 `type="submit"`。非送出鈕可以不寫；寫 `type="button"` 無害，讀的人一眼看得出不是送出鈕。

```vue
<UButton
  type="button"
  icon="i-heroicons-eye"
  aria-label="顯示"
  @click="showPassword = !showPassword"
/>
```

## 2. UInput type="number" 的 role 是 spinbutton

**症狀**：spec 用 `getByRole('textbox')` 定位數字欄位，找不到元素。

**原因**：`UInput` 的 `type="number"` 渲染出原生 `<input type="number">`，瀏覽器 accessibility tree 給的 role 是 `spinbutton`，不是 `textbox`。

**做法**：需要 textbox 語意的數字欄用 `type="text"` 收字串，送出前用 `Number()` 轉型；payload 型別仍是 number。

```vue
<script setup lang="ts">
const amountStr = ref('')
const amount = computed(() => Number(amountStr.value))
</script>

<template>
  <UInput v-model="amountStr" type="text" />
</template>
```

## 3. Radix dialog 開啟時背景整片 inert

**症狀**：
- (a) Modal 開啟後，spec 對背景元素的 `count()` 這類不重試的斷言量到 0。
- (b) Modal 關閉時關閉動畫還沒結束、節點還沒卸載，下一個斷言撞到殘留的舊節點。

**原因**：NuxtUI Modal 底層 Radix Dialog 開啟時會把背景其餘內容標記 `inert`；預設帶關閉動畫，動畫結束前節點仍留在 DOM。

**做法**：
- (a) 背景元素數量的斷言改用會重試的 `expect(locator).toHaveCount()`，或先 `await expect(dialog).toBeHidden()` 再斷言。
- (b) 所有 Modal 加 `:transition="false"`，關閉即同步卸載。

```vue
<UModal v-model:open="isOpen" :transition="false">
  <template #content>
    <!-- ... -->
  </template>
</UModal>
```

```ts
// 斷言用會重試的 API，不用不重試的 count()
await expect(page.getByTestId('background-item')).toHaveCount(3)
```

## 4. 切換鈕 aria-label 撞到欄位 label

**症狀**：`getByLabel('密碼', { exact: true })` 命中輸入框與切換鈕兩個元素，strict mode violation。

**原因**：切換鈕的 `aria-label` 帶了欄位名稱（如「顯示密碼」）；Playwright 的 `getByLabel` 對任何帶 `aria-label` 的元素都會收單，不限定表單控制項。

**做法**：欄位內的顯示／隱藏鈕 `aria-label` 只用「顯示」「隱藏」，不重複欄位名稱；用 `aria-controls` 指向被切換的 input id（不是 `aria-describedby`——那個屬性應指向描述文字元素，指向 input id 通常無效），再加 `:aria-pressed` 表示切換狀態。同頁有多個密碼欄（如改密碼頁）時，各欄 `aria-controls` 各自指向自己的 input id，`aria-label` 仍不變，靠 `aria-controls` 天然區分是哪一欄。

```vue
<UInput id="password-input" :type="showPassword ? 'text' : 'password'">
  <template #trailing>
    <UButton
      type="button"
      :aria-label="showPassword ? '隱藏' : '顯示'"
      aria-controls="password-input"
      :aria-pressed="showPassword"
      @click="showPassword = !showPassword"
    />
  </template>
</UInput>
```

## 5. 實體名稱只渲染一次

**症狀**：spec 的 `getByText(名稱)` 沒加 `.first()` 卻找到多個元素，strict mode violation。

**原因**：頁面除了 PageHeader 的 `<h1>` 外，其他位置（麵包屑、側欄摘要等）重複輸出同一個實體名稱字串。

**做法**：實體名稱只在 PageHeader 的 `<h1>` 渲染一次，其他位置改用別的描述文字或省略。

```vue
<template>
  <PageHeader :title="site.name" />
  <!-- 其他位置不重複輸出 site.name -->
</template>
```

## 6. 可空欄位一律 fallback 文字

**症狀**：斷言整頁 `getByText('null')` 數量為 0 的 spec 失敗，畫面上真的印出 `null` 或空白。

**原因**：欄位值是 `null`／`undefined` 時，模板直接把該值插進畫面，沒有為未填欄位提供替代文字。

**做法**：可空欄位一律過 `displayOr()` 這類 fallback 函式，轉成固定文字（如「尚未設定」）。`displayOr()` 放 `app/utils/display.ts` 一份共用，不要各頁各造。

```ts
// app/utils/display.ts
export function displayOr(value: string | null | undefined, fallback = '尚未設定'): string {
  // 空字串與全空白也算沒填（API 常用 '' 表示未填）
  return value?.trim() ? value : fallback
}
```

```vue
<span>{{ displayOr(site.note) }}</span>
```

## 7. Nuxt Icon 必裝本地 collection

**症狀**：SSR 輸出的頁面上圖示位置空白，client 端接手後才補上，出現 hydration 警告。

**原因**：`@nuxt/icon` 沒裝對應的本地 icon collection 套件（如 `@iconify-json/heroicons`）時，會退回打 Iconify 線上 API 取圖示；server 端渲染沒有等待網路往返的機制，圖示渲染不出來，client 端再補上就造成 SSR／CSR 輸出不一致。

**做法**：專案用到的每個 icon collection 都裝對應的 `@iconify-json/*` 套件（Phase 1 步驟 3.5 會檢查並安裝）。

```bash
npm i -D @iconify-json/heroicons @iconify-json/lucide
```

## 8. 自訂 neutral 色不可叫 neutral

**症狀**：自訂了 neutral 色階，NuxtUI 元件（卡片底色、次要文字）卻還是內建灰，跟設計稿差幾個色階，肉眼難分。

**原因**：NuxtUI 4.12 的 colors plugin 遇到 app.config 映射值 `'neutral'` 會改讀 `--color-old-neutral-*`（內建灰階），自訂的 `--color-neutral-*` 進不了元件色票。

**做法**：自訂 neutral 另取色名，app.config 映射到那個色名；不要覆寫 `--color-neutral-*`。`text-neutral-*` 會經 `--ui-color-neutral-*` 自動指到新色名。

```css
@theme static {
  --color-ink-900: #1a1a1a;
}
```

```ts
// app/app.config.ts
export default defineAppConfig({ ui: { colors: { neutral: 'ink' } } })
```

## 9. 避免巢狀 main

**症狀**：一個頁面的內容外層出現兩層 `<main>` landmark。

**原因**：layout 的內容容器本身用 `<main>` 包裹 `<slot />`，頁面自己又用 `<main>` 包內容，兩層疊在一起。

**做法**：layout 的內容容器用 `<div>`，`<main>` 留給頁面自己宣告。**本專案例外**：`app/layouts/default.vue`、`guest.vue` 已用 `<main>` 包 slot，所以反過來——頁面最外層一律用 `<div>`，範本裡頁面的 `<main>` 照抄時改成 `<div>`。

```vue
<!-- layout 內容容器 -->
<div class="flex min-h-0 flex-1 flex-col overflow-auto p-6">
  <slot />
</div>
```

## 10. 建立成功後跳到該筆所在分頁

**症狀**：使用者建立新資料後停在原分頁，看不到剛建立的項目。

**原因**：列表建立成功後沒有重新定位到新項目所在的分頁，維持在原本的 `page` 值。

**做法**：建立成功的 callback 內，用新項目在整體資料中的位置算出所在分頁並切過去。

```ts
async function handleCreated(newId: string) {
  await refresh()
  const index = items.value.findIndex(item => item.id === newId)
  if (index >= 0)
    page.value = Math.floor(index / pageSize) + 1 // pageSize 是一般數字（第 11 條）；用 components.md 的 pageSizeStr＋computed 模式時才寫 pageSize.value
}
```

## 11. 分頁筆數不挑「剛好夠用」的數字

**症狀**：pageSize 設成非檔位的數字（例如剛好讓種子資料一頁看完的數字）。

**原因**：把「讓測試一頁看完」當成挑 pageSize 的依據，而非回專案既有設定檔確認；資料超過一頁時，本來就該靠分頁與第 10 條「建立後跳到該筆所在頁」處理。

**做法**：pageSize 讀 `ui-config.yaml > table.pagination.defaultPageSize`，要改也只能選 `pageSizeOptions` 裡的檔位。

```ts
// ui-config.yaml > table.pagination.defaultPageSize: 10
const pageSize = 10
```

```vue
<ListContainer :page-size="pageSize" ... />
```

## 12. 公開路由比對禁 startsWith

**症狀**：middleware 用 `path.startsWith(publicPath)` 比對 route-map 的 `public_paths`，遇到帶動態段的路由（`/users/[id]`）永遠比不中；或反過來 `/admin` 前綴誤放行 `/administrator`。

**原因**：`public_paths` 的值是路由樣板（含 `[id]` 或 `:id` 動態段），不是字面路徑；前綴比對把樣板當字面值。

**做法**：改逐段參數化比對，動態段吃任意非空值。範本在 `phase-2-skeleton.md` 的 `app/utils/route-match.ts`：Auth 白名單用 `matchesRoutePattern`（段數不同不命中），RBAC 黑名單用 `coversRoutePattern`（涵蓋其下子頁）。middleware 明確 import 使用。
