# 框架知識 Skill 與裁決

已安裝 Anthony Fu 的 `vue` / `nuxt` / `pinia` skill（`.claude/skills/`），寫對應程式碼時會自動觸發，提供框架正確語法與踩坑提醒。與本專案慣例衝突時，**一律以下列裁決為準**：

- **Pinia store 採 `@pinia/nuxt` 預設 auto-import** — `app/stores/` 下的 store 直接使用、不需手動 import（與 `pinia` skill 一致）
- **props 預設值一律走 `withDefaults`，不用 Reactive Props Destructure** — 理由：本專案 props 一律 type-based 宣告＋`withDefaults`，解構寫法在 3.4 以下失去響應性，且 eslint `vue/no-setup-props-reactivity-loss` 已開；`vue` skill 快照兩處（`SKILL.md`、`references/script-setup-macros.md`）已加註，重抓快照後要重新套上
- **本專案是 Nuxt 4** — 本地 `nuxt` skill 快照（2026-01-28）基於 3.x（整體相容），目錄結構與設定以 Nuxt 4 官方為準
  - 目錄：Nuxt 4 預設 `srcDir` 是 `app/`，skill `core-directory-structure.md` 的標準結構也以 `app/` 為源碼目錄；該檔另寫「也可放根層（沒有 `app/` 資料夾）」——Nuxt 4 仍相容根層舊結構，但本專案程式碼一律放 `app/`，不要照那句改成根層
  - data fetching 兩處需注意：`useFetch`/`useAsyncData` 的 `data` 是 `shallowRef`（深層 mutate 不觸發響應、預設值 `undefined`）；`immediate: false` 時初始 `status` 是 `'idle'` 非 `'pending'`
  - skill 範例會踩到的：`getCachedData` 在 Nuxt 4 每次 fetch 都會跑並收到 `ctx.cause`，`references/best-practices-data-fetching.md` 的 `getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key]` 疑似會擋掉 refresh（未實測，需看 `ctx.cause`）
  - skill 沒寫到、自己寫時要注意的 Nuxt 4 變更：`pending` 改為 computed，`immediate: false` 時為 `false`；`dedupe` 不再收布林值，改 `'cancel'`／`'defer'`
- **本專案 auth 無 refresh token** — `feature-to-api/references/auth-scaffold.md` 是**新專案 scaffold 用**的範本，教的是 access + refresh 雙 token（`/auth/refresh`、single-flight refresh、401→refresh→retry）。本專案認證是**單一 JWT（7 天）**，`server/api/v1/auth/` 只有 `login.post.ts`，沒有 refresh 端點也不打算加。改既有 auth 時不得照該檔補 refresh 機制——那是憑空造一個不存在的東西。該檔僅在未來 scaffold 全新專案時參考
- **`frontend-design` skill（Anthropic 官方，裝在 `~/.claude/skills/`）不得改動既定色票** — 該 skill 把「暖奶油底（近 `#F4F1EA`）＋高對比襯線＋陶土色點綴」「拉寬全大寫眉標」「中間點資訊列（`A · B · C`）」「近黑 `#111` 代替純黑」「`→` 附在連結文字後」「每區塊 fade-and-slide-up 進場」列為 AI 生成味。本專案的 Editorial Luxe token（`cream #F4EFE6`、Cormorant、`gold`、`ink #111111`）與公開頁既有寫法**六項全中**，但那是已上線、新人看過的既定方向。裁決：
  - 色票與字體家族以 `app/assets/css/main.css` 的 `@theme` 為準，該 skill 不得新增或替換 token
  - 採納範圍限「模板套件感」那一類：眉標、中間點、`→`、每區塊進場動畫、統一圓角卡片格線
  - 改**既有**公開頁的視覺方向前先問使用者；**新**畫面可自由採用該 skill 的主張
  - 它主張的「一個畫面只花一次大膽」與 `spec/ui-config/creative-direction.md` §4「一頁最多一個主動效」同向，可直接套用

## 與官方同步的維護注意

- 升級框架 major/minor 時，重跑 `npx skills add antfu/skills --skill=vue --skill=nuxt --skill=pinia` 重抓快照
- 定期回查 antfu 是否已出 **Nuxt 4** 版 skill（本地快照仍是 3.x；上游 2026-09-25 的新快照已跳到 Nuxt 5.x pre-release `5.0.0-0`，同樣沒有 Nuxt 4 版，不要直接換上），有則直接替換以消除版本落差
- 各快照的產生來源與日期記在 `.claude/skills/{nuxt,vue,pinia}/GENERATION.md`（nuxt 快照 2026-01-28）
- 已對齊：vue skill(3.5) ↔ vue 3.5.x、pinia skill(3.0.4) ↔ pinia 3.0.x；唯 nuxt 本地快照（3.x）落後專案（Nuxt 4）一個 major
