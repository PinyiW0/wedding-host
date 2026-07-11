# 創意方向規範

> **定位**：`visual-hierarchy.md` 的姊妹篇——它管後台（安靜工作），本檔管品牌表達與公開頁（大聲說話），是同一套 token 的兩種音量。
> **消費點**：vibe 階段使用者要求「好看一點／有質感／換風格」時（`rules/vibe-ui.md` 指讀）＋實作公開頁（`app/pages/(public)/`）時。

> **本專案校準（wedding-host）**：
> - 視覺層級規範在 `.claude/rules/visual-hierarchy.md`（issue #19 客製版）；本檔提及 `visual-hierarchy.md` 時以該檔為準。
> - 公開頁不採 `(public)` route group，判定對齊 `app/middleware/auth.global.ts` 的 `PUBLIC_PATTERNS` 中賓客面向路徑（rsvp／checkin／blessing／guest／flowers／thankyou／projection／rundown）；`scripts/visual-hierarchy-check.mjs` 的 `PUBLIC_DIRS` 已同步此清單。login／register 屬後台入口，維持後台規則。
> - §2 的 preset 程序已完成：品牌 token 為 Editorial Luxe（gold／ink／paper／cream，Cormorant 襯線），定義於 `main.css` 既有 `@theme`，不需再走選版程序。

## 0. 分層決策（架構前提）

- **品牌恆定層全域唯一**：色彩、字體家族、圓角、陰影等 token 由 `main.css` 的 `@theme` 與 `app.config.ts` 定義，前後台共用。前台不另設色板——「前台調性與後台一致」是架構保證，不是使用者選項。
- **表達層分治**：後台依 `visual-hierarchy.md` 的音量使用 token；公開頁依本檔 §3。兩者引用同一組 token，只是尺寸與用量不同。
- **a11y 硬規則永不解禁**：`focus-visible` 焦點指示、狀態不可只靠顏色、label 必須存在（可 `sr-only`）——任何風格、任何頁面無例外。

## 1. 風格語彙 preset（vibe 創意指引）

使用者說「好看一點」但未指方向時：**先以一句話確認方向**（列出下表選項）；無從確認時依「氛圍關鍵詞／適用場景／不適用」欄從品牌語境推導，仍無法判定才預設 **Editorial Luxe**。preset 是形容詞→設計決策的翻譯表，不是硬規則——命中的傾向優先採用，與層級規則衝突時，後台以 `visual-hierarchy.md` 為準、公開頁以本檔 §3 為準。

| preset | 氛圍關鍵詞 | 字體傾向 | 圓角／陰影 | 配色傾向 | 適用場景 | 不適用 |
|--------|-----------|---------|-----------|---------|---------|--------|
| **Editorial Luxe** | 留白、儀式感、雜誌、精緻 | serif display 標題＋sans 內文 | 圓角極小（`rounded-sm` 以下）；幾乎無陰影，靠留白與細邊框分層 | 暖白底、墨黑文字、單一金屬飾色（低飽和） | 婚慶、精品、作品集、品牌官網 | 資料密集工具、高頻操作介面 |
| **Minimal Tech** | 冷靜、精準、工程感 | 幾何 sans；數據配 mono | 圓角中等（`rounded-md`）；陰影淡 | 冷灰階＋單一高飽和主色（藍／紫） | SaaS、開發工具、產品官網 | 情感訴求、婚慶精品類 |
| **Bold Contrast** | 張揚、活力、街頭 | 重字重 sans、超大 display | 圓角兩極（pill 或直角）；粗邊框替代陰影 | 高飽和撞色、大面積色塊、可用黑底 | 活動頁、新品發表、年輕品牌 | 信任敏感（金融／醫療）、資訊密集 |
| **Soft Neutral** | 溫暖、親和、安心 | 圓潤 sans | 圓角大（`rounded-lg`~`2xl`）；柔和擴散陰影 | 低飽和暖色、奶油底、粉彩輔色 | 健康、教育、社群、生活服務 | 需要權威感或硬科技感的場景 |

## 2. 主題 token preset

沿用字級三層規則的程序：**token 先在 `@theme` 具名定義才可使用**。

1. 模板 `main.css` 保持素體（兩行 `@import`＋reduced-motion guard＋motion token，皆屬恆定層）——品牌 preset 不預先入庫，只放本檔。
2. 選定 preset 後：`@theme` 區塊貼進 `main.css` → `app.config.ts` 映射語意色名 → `ui-config.yaml > theme.colors` 記錄色碼來源。
3. **preset 是全站一次性選擇**：前後台一起生效，不得前台一套、後台一套。
4. **合格條件：後台套上仍安靜可用**。preset 只改 token 值（色板、字體、圓角），不改 `visual-hierarchy.md` 的任何層級規則；套用後至少開一個後台頁面確認對比與可讀性。

### 完整範例：Editorial Luxe

```css
/* main.css —— 兩行 @import 之後貼上 */
@theme static {
  /* 字體家族：display 供公開頁大標，sans 為全站內文 */
  --font-display: "Playfair Display", "Noto Serif TC", serif;
  --font-sans: "Inter", "Noto Sans TC", sans-serif;

  /* 主色 brass（50~950 全階，uicolors.app 產生） */
  --color-brass-50: #faf7ef;
  --color-brass-100: #f2ead6;
  --color-brass-200: #e4d3ab;
  --color-brass-300: #d4b779;
  --color-brass-400: #c79f54;
  --color-brass-500: #b98d43;
  --color-brass-600: #9e7036;
  --color-brass-700: #7f552e;
  --color-brass-800: #68462b;
  --color-brass-900: #573b27;
  --color-brass-950: #311e12;
}

:root {
  --ui-radius: 0.125rem; /* 圓角收斂：精品感靠直線與留白 */
}
```

```ts
// app.config.ts —— neutral 用內建 stone（暖灰），依 ui-config.yaml 慣例不需產 CSS
export default defineAppConfig({
  ui: { colors: { primary: 'brass', neutral: 'stone' } },
})
```

### 其餘 preset 起點（依同程序產生完整色階）

| preset | primary 傾向 | neutral | --ui-radius | 字體 |
|--------|-------------|---------|-------------|------|
| Minimal Tech | 內建 `indigo` 或高飽和自訂藍 | `zinc` | `0.375rem` | 幾何 sans＋`--font-mono` 數據 |
| Bold Contrast | 高飽和自訂色（洋紅／橙） | `neutral` | `9999px`（pill）或 `0` | 重字重 sans |
| Soft Neutral | 內建 `rose` 或低飽和自訂暖色 | `stone` | `0.75rem` | 圓潤 sans |

## 3. 公開頁視覺模式

適用範圍：`app/pages/(public)/` 下所有頁面（Nuxt route group，不影響 URL）。`scripts/visual-hierarchy-check.mjs` 僅對此路徑放行 display 級規則；行銷頁放在其他路徑**不會**獲得解禁。

### Hero 結構（由上而下）

1. **eyebrow（可選，非預設）**：需要時沿用後台眉標 class（色可換 primary）——別每區塊都掛，滿版 eyebrow 是 AI 模板味（見下方清單）
2. **display 大標**：`text-5xl`~`text-7xl`（指 `lg:` 後尺寸；行動基準縮一~兩級、可低至 `text-4xl`），可配 `font-light`＋`tracking-tight`（僅拉丁字，CJK 不收字距）；`font-display` 僅在已套 preset 定義 `--font-display` 後可用——素體狀態下該 class 靜默失效，未套 preset 時省略
3. **副標**：`text-lg`~`text-xl text-neutral-500 dark:text-neutral-400`，最多兩行
4. **CTA 一主一次**：主 `size="xl"` solid、次 `size="xl"` outline／ghost；不得兩顆都 solid

### Section 節奏

- 一個 section 一個重點；垂直留白 `py-16 lg:py-24`；內容寬度約 `max-w-6xl mx-auto px-6`（hero 亦沿用此留白與寬度）
- 相鄰 section 以背景交替分段（白 ↔ 淺灰 ↔ primary 大面積），不靠分隔線
- primary 大面積底的配套：文字用 `text-white`／`text-primary-100`，主按鈕反轉為白底 primary 字並補 `focus-visible:ring-white`；CTA「一主一次」規則在此同樣適用
- section 標題 `text-3xl`~`text-4xl`（公開頁常規，後台仍禁）；hero 之外不再出現 `text-5xl` 以上

### 解禁分界表

| 規則 | 後台（visual-hierarchy.md） | 公開頁（本檔） |
|------|---------------------------|---------------|
| `text-5xl`~`7xl` | 禁止 | hero display 大標可用 |
| `font-light` | 禁止 | 僅 `text-5xl` 以上 display 字可配 |
| UButton `xl` | 幾乎不用 | hero／CTA section 可用 |
| primary 大面積背景 | 禁止（primary 只點綴） | hero 底、CTA section 可用 |

### 仍然禁止（公開頁無解禁）

- 任意值字級（`text-[64px]`）——需要新尺寸走 §2 的 `@theme` 具名 token 程序
- `text-8xl`／`9xl`（viewport 溢出與斷行風險）
- 裸 `outline-none`、狀態只靠顏色、placeholder 取代 label（§0 的 a11y 三條）
- 公開頁的表單與內文區塊仍照 `visual-hierarchy.md` 層級——解禁只針對 display 表達，不解除內文可讀性

### AI 模板味（避免——「一眼 AI」的來源；gradient text 由 lint 強制，其餘靠自覺）

- gradient text（`bg-clip-text` 漸層字）、紫→藍漸層背景
- 每個 section 都掛 eyebrow、01/02/03 編號區塊標記、一模一樣的三欄 icon 卡片 grid
- 未指定方向時慣性選 Inter＋紫色系——先走 §1 推導，不吃預設審美

## 4. 動效

- **節制原則**：後台幾乎不動——hover/focus 用 `transition-colors`／`opacity` 級即可，無裝飾動畫；公開頁可敘事，一頁最多一個主動效（hero 進場或一段 scroll 敘事——同語彙的進場算同一個，hover 微互動不計）
- **豁免**：功能性載入回饋（spinner／skeleton，依 `ui-config.yaml > button.loading`／`loading.skeleton`）屬狀態傳達非裝飾，不受節制限制
- **三條硬原則**：
  1. 尊重 `prefers-reduced-motion`——全域 guard 已內建於 `main.css`，自訂動畫不得繞過
  2. 只動 transform 與 opacity；禁對 layout 屬性（width/height/top/left/margin…）做 transition，含 `transition-all`（lint 強制）
  3. duration 只用內建三檔（`duration-150/250/400`），easing 用 `ease-standard`／`ease-emphasized` token（已內建於 `main.css`）；任意值（`duration-[…]`）lint 強制禁止
- **公開頁進場模式**：進場 stagger（列表逐項延遲，遞延在 `<style>`／JS 層以 `calc()` 實作、step 60~90ms，不用 `delay-[…]` class）、scroll 觸發一次性不重播、hover 微互動（scale ≤1.05）；進場不得阻擋閱讀——首屏文字 1 秒內就位、預隱藏元素在無 JS 時必須仍可見

## 5. 外部資源升級路徑（指路不預裝）

本檔管地基與邊界；要更深的品味或能力時呼叫外部資源。兩條鐵律：**外部建議與本檔／`visual-hierarchy.md`／lint 硬規則衝突時，本地贏**；外部選出的風格落地一律走 §2 token 程序。

| 情境 | 資源 |
|------|------|
| 要 Awwwards 級品味、反 AI 味深審 | `pbakaus/impeccable`（Claude Code plugin） |
| 要 4 組 preset 以外的風格／色板／字體型錄 | `nextlevelbuilder/ui-ux-pro-max-skill` |
| 要敘事級捲動動畫（超出 CSS transition） | GSAP＋`greensock/gsap-skills`（含 Nuxt 4 專章），仍守 §4 硬原則 |
| 純視覺靈感 | 21st.dev／Awwwards（React 元件不可直搬，Vue 重實作） |
