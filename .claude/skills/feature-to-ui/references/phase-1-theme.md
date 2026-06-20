# Phase 1: 基礎設定

## 必讀規範

```
僅需讀取：
- ui-config.yaml > theme.colors（色彩設定）
- ui-config.yaml > colorMode（深淺模式設定）
- ui-config.yaml > project（name, description, locale, favicon）
- ui-config.yaml > meta（keywords, author, og）
```

## 執行步驟

1. **讀取 `ui-config.yaml` 的 `theme.colors`**
2. **建立 app.config.ts**（色彩映射）
3. **建立 main.css**（自訂色階）：
   - 有 `"#hex"` → 用 `@theme static` 寫入 `--color-{名稱}-50~950`
   - 有 `"名稱"` 或空值 → 不產生 CSS
4. **設定 SEO / Meta**（寫入 `nuxt.config.ts` 的 `app.head`）：
   - `project.name` → `<title>`
   - `project.description` → `<meta name="description">`
   - `project.favicon` → `<link rel="icon">`
   - `meta.keywords` → `<meta name="keywords">`（非空值才產生）
   - `meta.author` → `<meta name="author">`（非空值才產生）
   - `meta.og.*` → `<meta property="og:*">`（含 `og:title`、`og:description`、`og:image`、`og:type`）
5. **詢問用戶確認**

## 色彩翻譯規則

### 判斷邏輯

讀取 `ui-config.yaml > theme.colors`，每個顏色依據值的格式決定處理方式：

| 值的格式 | 範例 | main.css | app.config.ts |
|---------|------|----------|---------------|
| `"#hex"` | `"#00ba7b"` | 產生 50-950 色階 | `'{語義色名}'` |
| `"名稱"` | `"emerald"` | 不產生 CSS | `'{Tailwind 色名}'` |
| `""`（空值） | `""` | 不產生 CSS | 預設 Tailwind 內建色 |

### 空值預設對應表

| 語義色 | 預設 Tailwind 內建色 |
|--------|---------------------|
| primary | `green` |
| secondary | `sky` |
| success | `green` |
| warning | `amber` |
| error | `red` |
| info | `blue` |
| neutral | `neutral` |

### 自訂 hex 的產出規則

1. 用 https://uicolors.app 從 hex 產生 50-950 共 11 個色階
2. 寫入 `@theme static { --color-{色名}-50~950 }`
3. 寫入 app.config.ts：`{語義色名}: '{語義色名}'`

**關鍵：CSS 變數名稱必須和 app.config 映射名稱一致。**

### app.config.ts 映射規則（極重要！）

Nuxt UI plugin 會根據 `app.config.ts` 的映射值去尋找 `--color-{value}-{shade}` CSS 變數。
**映射值必須指向一個實際存在的 Tailwind 顏色名稱**，否則元件顏色不會生效。

| ui-config.yaml 值 | main.css 是否有定義色階 | app.config.ts 映射 |
|-------------------|----------------------|-------------------|
| `"#hex"` | 有（`@theme` 定義了 `--color-{名稱}-*`） | `'{語義色名}'`（映射到自訂色） |
| `"red"` | 沒有（沿用 Tailwind 內建） | `'red'`（映射到 Tailwind 內建色） |
| `""` | 沒有（空值 fallback） | 查預設對應表 |

```typescript
// [X] error 沒有在 main.css 定義色階，卻映射到 'error'
// Tailwind 沒有內建叫 'error' 的顏色 → bg-error 無色！
error: 'error',

// [O] 沒有自訂色階 → 映射到 Tailwind 內建色名
error: 'red',
warning: 'amber',
success: 'green',
info: 'blue',

// [O] 有在 main.css 用 @theme 自訂色階 → 映射到自身名稱
primary: 'primary',
secondary: 'secondary',
neutral: 'neutral',
```

> ⚠️ **只有在 `main.css` 用 `@theme` 定義了 `--color-{名稱}-*` 色階的顏色，才能用自身語義名稱映射。沒有自訂色階的語義色，必須映射到 Tailwind 內建色名（如 `red`、`amber`、`green`、`blue`）。**

### NuxtUI 支援的語義色名（只有這 7 個）

`primary` | `secondary` | `success` | `info` | `warning` | `error` | `neutral`

> ⚠️ **禁止使用 `tertiary`、`accent` 等 NuxtUI 不支援的色名**

## Nuxt UI 色彩自動橋接原理

Nuxt UI 的 `colors.js` plugin 會在 runtime **自動處理 light/dark 切換**：

```javascript
// node_modules/@nuxt/ui/dist/runtime/plugins/colors.js

// 1. 映射 Tailwind 色階 → Nuxt UI 色票
":root, :host {
  --ui-color-primary-{50-950}: var(--color-primary-{50-950}, <fallback>);
}"

// 2. Light mode：語義色 = 500 色階
":root, :host, .light {
  --ui-primary: var(--ui-color-primary-500);
}"

// 3. Dark mode：語義色 = 400 色階
".dark {
  --ui-primary: var(--ui-color-primary-400);
}"
```

**因此你只需要定義 `--color-{name}-{shade}`（Tailwind 層），Nuxt UI 會自動：**
- 建立 `--ui-color-{name}-{shade}` 色票（讀取 `--color-{name}-{shade}`）
- 設定 `--ui-{name}` 語義色（light=500, dark=400）
- 設定 `--ui-text-*`、`--ui-bg-*`、`--ui-border-*` 等 neutral 相關變數

> ⚠️ **禁止手動定義 `--ui-color-*`、`--ui-primary`、`--ui-text-*`、`--ui-bg-*` 等變數 — 這些由 Nuxt UI plugin 自動管理，手動覆蓋會造成衝突。**

## 資料流

```
ui-config.yaml              main.css                          app.config.ts
──────────────              ────────                          ─────────────
theme.colors
  primary: "#00ba7b"    →   @theme static {                →   primary: 'primary'
                              --color-primary-50~950
                            }
                                                               ↓ Nuxt UI plugin 自動處理
                                                               --ui-color-primary-*
                                                               --ui-primary (light=500, dark=400)

  success: ""           →   （不需要 CSS）                  →   success: 'green'
                                                               （Nuxt UI 直接讀 Tailwind 內建色）

  info: "blue"          →   （不需要 CSS）                  →   info: 'blue'
                                                               （Nuxt UI 直接讀 Tailwind 內建色）
```

## app.config.ts 範例

```typescript
// app/app.config.ts
// 假設 primary/secondary/neutral 有在 main.css 自訂色階
// success/warning/error/info 沿用 Tailwind 內建色
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',       // 有自訂色階 → 映射到自身名稱
      secondary: 'secondary',   // 有自訂色階 → 映射到自身名稱
      success: 'green',         // 沒自訂 → 映射到 Tailwind 內建色
      warning: 'amber',         // 沒自訂 → 映射到 Tailwind 內建色
      error: 'red',             // 沒自訂 → 映射到 Tailwind 內建色
      info: 'blue',             // 沒自訂 → 映射到 Tailwind 內建色
      neutral: 'neutral',       // 有自訂色階 → 映射到自身名稱
    },
  },
})
```

> **映射規則：有自訂色階 → `'{語義名}'`，沒自訂 → `'{Tailwind 內建色名}'`**

## main.css 範例

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";

/* Tailwind v4 preflight 將 button cursor 設為 default，覆蓋回 pointer */
@layer base {
  button, [role="button"] {
    cursor: pointer;
  }
}

/* 只有 ui-config.yaml 中填入 "#hex" 的顏色才需要產生色階 */
/* 空值或 Tailwind 內建色名不需要產生 CSS */
@theme static {
  /* primary — 青綠 (base: #00ba7b) */
  --color-primary-50: #EFFDF5;
  --color-primary-100: #D9FBE8;
  --color-primary-200: #B3F5D1;
  --color-primary-300: #75EDAE;
  --color-primary-400: #00DC82;
  --color-primary-500: #00BA7B;
  --color-primary-600: #00A155;
  --color-primary-700: #007F45;
  --color-primary-800: #016538;
  --color-primary-900: #0A5331;
  --color-primary-950: #052E16;

  /* secondary — 萊姆綠 (base: #7acc00) */
  --color-secondary-50: #F7FFE0;
  --color-secondary-100: #EEFFB8;
  /* ... 完整 50-950 */
  --color-secondary-950: #1A3300;

  /* neutral — 深藍灰 (base: #314157) */
  --color-neutral-50: #F4F7FA;
  --color-neutral-100: #E8ECF2;
  /* ... 完整 50-950 */
  --color-neutral-950: #0D1117;

  /* success/warning/error/info — 空值，不產生 CSS，沿用 Tailwind 內建 */
}
```

> ⚠️ **禁止手動定義 `--ui-color-*`、`--ui-primary`、`--ui-text-*`、`--ui-bg-*` 等變數**，Nuxt UI 的 `colors.js` plugin 會自動從 `--color-*` 橋接產生這些變數。
>
> 色階產生：https://uicolors.app

## 常見錯誤

```typescript
// [X] 沒有自訂色階卻映射到語義名稱 — Tailwind 沒有 'error' 這個內建色！
error: 'error',        // NuxtUI 去找 --color-error-*，找不到 → bg-error 無色
warning: 'warning',    // NuxtUI 去找 --color-warning-*，找不到 → bg-warning 無色

// [O] 沒有自訂色階 → 映射到 Tailwind 內建色名
error: 'red',          // NuxtUI 去找 --color-red-*，Tailwind 內建有
warning: 'amber',      // NuxtUI 去找 --color-amber-*，Tailwind 內建有
```

```typescript
// [X] app.config 映射名稱和 CSS 變數名稱不一致
primary: 'rose',       // NuxtUI 去找 --color-rose-*，找不到自訂色！

// [O] 自訂 hex 時，映射到自身名稱
primary: 'primary',    // NuxtUI 去找 --color-primary-*，對上自訂色
```

```typescript
// [X] 使用 NuxtUI 不支援的語義色名
tertiary: 'slate',     // NuxtUI 元件沒有 color="tertiary"
accent: 'slate',       // NuxtUI 元件沒有 color="accent"
```

```css
/* [X] 手動定義 --ui-color-* 和 --ui-*（會和 Nuxt UI plugin 衝突） */
:root {
  --ui-color-primary-500: #00BA7B;
  --ui-primary: var(--ui-color-primary-500);
  --ui-text-dimmed: var(--ui-color-neutral-400);
  --ui-bg: white;
}

/* [O] 只定義 Tailwind 層（--color-*），Nuxt UI 自動處理其餘 */
@theme static {
  --color-primary-500: #00BA7B;
}
```
