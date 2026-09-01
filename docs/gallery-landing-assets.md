# 婚紗相簿頁素材與設計決策（/gallery/[weddingId]）

參考體驗：https://www.adovasio.it/ ——開場描線 loader → 照片蒙太奇 → hero 定格 → 三系列釘住式捲動 → 系列內頁。
本頁與 `/story`、`/invite` 一樣是**單一婚禮的靜態內容，不走 API**（見 `app/composables/useGalleryContent.ts`）。

---

## A. 素材

| 素材 | 路徑 | 說明 |
|---|---|---|
| 婚紗照 33 張 | `public/images/gallery/gallery-01.webp` ~ `gallery-33.webp` | 長邊 1600、WebP q82，平均 159KB |
| 字樣 | `public/images/gallery/Union.svg` | 564×200 單一 fill path（#4A403F）。開場描線與 hero 頁首共用 |
| 背景音樂 | `public/audio/wedding-bgm.mp3` | 沿用 `/story` 同一首，元件也沿用 `MusicToggle` |

### 分組（依照片實際場景判定）

| 系列 | slug | 編號 | 張數 |
|---|---|---|---|
| 山之間 / Among the Hills | `meadow` | 01-05、15-25 | 16 |
| 海與黃昏 / Where the Sun Meets the Sea | `seaside` | 06-09、26-33 | 12 |
| 城市節奏 / Streets in Motion | `city` | 10-14 | 5 |

- hero 固定 `gallery-08.webp`（海邊夕陽），屬 seaside。
- 邊界裁決：04／19／20 是林蔭石板路，但服裝與 A 組同一套，判 meadow；27 是海邊獨照、造型屬 B 組，判 seaside；10 的禮服是灰底黑玫瑰印花，與 11/13/14 同一套，判 city。
- 每張照片的 alt 是實際場景描述（`PHOTO_ALT`），不是流水號。
- **要調整分組或文案**：改 `useGalleryContent.ts` 的 `SERIES_SEEDS`（`nums` 是該系列的照片編號、`showcase` 是 landing 拼貼用的三張、`cover` 是代表圖）與 `PHOTO_ALT`，其餘不必動。

### 仍待補

- `public/og-image.png` 不存在；本頁的 ogImage 已改指 hero 照片，`/story`、`/invite` 仍指向那個缺檔。

---

## B. 結構

```
app/pages/gallery/[weddingId]/index.vue      landing（開場 + hero + 三系列 + 出口）
app/pages/gallery/[weddingId]/[series].vue   系列內頁（slug 不存在 → 404）
app/components/gallery/
  GalleryPreloader.vue     開場疊層（client-only）
  GalleryLogoMark.vue      字樣的手寫揭開（內含 Union.svg 的路徑資料）
  GalleryHero.vue          首屏（四邊大字 + 倒數）
  GalleryCountdown.vue     婚禮倒數（橫排旋轉成直式）
  GallerySeriesShowcase.vue 單一系列的釘住式區塊
  GallerySeriesFlow.vue    系列內頁的單欄照片流
  GalleryLightbox.vue      燈箱（自 GalleryGrid 抽出，兩處共用）
  GalleryGrid.vue          既有的照片格（保留，改用共用燈箱）
  GalleryStickyNav.vue     底部系列導覽膠囊
app/composables/useScrollProgress.ts          捲動進度引擎（全域單例）
```

---

## C. 設計決策記錄

### 1. 捲動動效用 rAF + CSS var，不引 GSAP／Lenis

需求全是「捲動位置 → 0~1 進度 → transform」的純函數：pin 用 `position: sticky`（零 JS），視差與 scroll-grow 各是一個進度值。GSAP 的 timeline scrub 用不上，卻要多背一套動畫心智模型；Lenis 劫持原生捲動，會連帶影響 sticky、鍵盤翻頁與 reduced-motion 的處理路徑。

改為照搬 `InviteStage` 既有慣例：事件只設旗標 → rAF 節流 → **JS 只寫 CSS var、不碰 `style.transform`**。CSS var 也保留升級路徑：日後若真要敘事級捲動，只換「寫 var 的那一側」，CSS 消費端一行不動。

`useScrollProgress` 是**全域單例**：整站一個 rAF loop、一個 IntersectionObserver（`rootMargin: 20%` 控制活性名單），landing 三個區塊與系列頁數十張照片共用，不會各自起 loop。幾何在 resize 時重量測並快取，捲動中不讀 `getBoundingClientRect`。

原本計畫寫的「視差 var 加 lerp 阻尼」實作時拿掉了：視差是 scroll-linked 而非慣性動畫，加 lerp 反而讓畫面落後於手指。直接映射就是對的。

### 2. CSS var 的預設值一律取「構圖中性位」

- `--sp: 0.5`（區塊捲動進度）→ 視差欄停在中段
- `--gp: 1`（距視窗中心）→ 照片全尺寸
- `--load-p: 1`（描線進度）→ 字樣完整
- `data-active="true"`（名字是否就位）→ SSR 預設可見

因此**沒有 JS、或使用者開了「減少動態」時，畫面是完整的靜態版本**，沒有任何元素被 `opacity: 0` 藏死。開場疊層則整個包在 `<ClientOnly>` 內、且 reduced-motion 時直接不渲染。

### 3. Union.svg 的描線：把輪廓本身當筆刷，沿筆順「寫」出來

素材是**輪廓化字形的單一 fill path**，沒有 stroke。演進過兩版：

**第一版（已汰換）**：`mask-image: linear-gradient()` 由左往右直線 wipe。合規、穩定，但那是「一道直邊掃過去」，不是書寫。

**現行版**（`GalleryLogoMark.vue`）：採用手寫動畫的正統做法——**把同一條路徑當成筆刷放進 `<mask>`，用很粗的描邊沿路徑行進方向掃過去**，揭開底下的填色字樣。填色只存在於字的範圍內，所以筆刷溢出邊界不影響結果。三個關鍵：

1. **不能直接對 fill path 下 `stroke-dashoffset`**：那畫的是字的「外框輪廓」，筆劃兩側各走一條線，視覺是雕邊不是書寫。輪廓只能當「筆刷的軌跡」用，不能當可見的線。
2. **方向要反著走**（`stroke-dashoffset` 取負，從路徑末端往回揭）：這條輪廓的起點在字的中段，正著走會從右側先冒出來。實測比對過正向／反向兩種取樣序列，反向才是由左至右照筆順寫出來。
3. **筆刷粗細 30（viewBox 單位）**：24 以下字心會留沒填滿的縫，46 以上會一次揭開旁邊的筆畫（實測 24／34／46 三檔比較）。

另外輪廓末端有一小段落在字的外側，進度前 14% 畫面上看不出變化，故把 0~1 重新映射到 0.14~1，開場不會有一段乾等。

> **`pathLength` 在 Vue 模板裡會失效**（踩過）：SVG 屬性大小寫敏感，`pathLength` 經模板編譯會變成 `pathlength` 而不被認得。當時的症狀很有迷惑性——不是動畫壞掉，而是 `stroke-dasharray="1 1"` 落在長度 3102 的實際路徑上變成 1 單位的密集短點，圓端點又把它們接成實線，看起來就像「一開始就寫完了」。改成 `onMounted` 時用 `getTotalLength()` 量真實長度、以使用者單位下 dasharray。

### 4. 進度是真的，不是假動畫

預載 6 張（蒙太奇 5 張 + hero），`new Image()` 計數，**onerror 也計數**——少一張圖不該讓開場卡在 80%。顯示值取「實際載入比例」與「最短時長 900ms」的較小者：既等圖，快取命中時也不會 0 直接跳 100。另有 5 秒硬上限強制放行。

計數器是三欄直式滾輪，只動 `translateY`。Cormorant 是舊體數字（3、4、9 有下伸部），格高必須留 1.4em 才不會被裁掉；滾動 150ms——進度更新很密，時間長了整段都在滑動中、讀不出數字。

### 5. hero 的交接靠「幾何重合」，不靠量測

疊層最後那張 hero 卡片的**版面盒直接就是最終 hero 的位置**（`position: absolute; inset: var(--gallery-frame)`），開場期間只用 `transform: scale(0.26)` 把它縮回中央當成一疊照片的最後一張，放大即 `scale(1)`。底下 SSR 的 `GalleryHero` 是同一張圖、同一個框（`.gh-root` 的 padding = 同一個 `--gallery-frame`），放大結束時兩者像素級重合，疊層淡出就是無縫定格——不需要任何 FLIP 量測或 JS 幾何計算。

`--gallery-frame` 宣告在頁面根元素上，靠 CSS 自訂屬性的繼承傳給兩個子元件，兩邊不會各寫一份 clamp 而走鐘。

開場期間會 `scrollTo(0, 0)` 並鎖 `body` 捲動：疊層的卡片以視窗為準定位，頁面沒停在最上面就對不齊（例如重整時瀏覽器還原了捲動位置）。

### 6. 動效超出 creative-direction §4「一頁最多一個主動效」——刻意延伸

相簿頁同時有：開場（描線 + 蒙太奇 + hero 放大）、系列區塊的釘住視差與逐字進出、系列內頁的捲動放大。比照 `invite-portal-assets.md` §C-2 的判定，視為**單一敘事語彙**（「翻開一本相簿」）：開場是掀頁、捲動視差與放大是同一語彙的延續。

§4 的三條硬原則未破：

- **reduced-motion**：`GalleryPreloader` 命中即 `emit('done')` 且整個疊層不渲染（實測疊層數 0）；`useScrollProgress` 命中即不啟動，所有 var 維持中性預設。CSS 全域 guard 另行兜底。
- **只動 transform / opacity**：無 layout 屬性 transition、無 `transition-all`。系列內頁的「放大變寬」是 `scale(0.86→1)` 而不是改 `width`，避免逐幀重排。
- **duration 與 ease**：互動 transition 走 150／250／400ms + `--ease-standard`／`--ease-emphasized`；開場的 420ms／900ms／1900ms 是編排級 keyframes，寫在 `<style scoped>`（同 invite 頁 950ms 的先例）。

### 7. 「首屏文字 1 秒內就位」讓位給 cinematic 開場

開場約 3.5 秒（載入 ≥0.9s + 蒙太奇與放大 2.6s），這是使用者明確要求的體驗。配套：

- 右下角常駐「跳過開場」按鈕，Esc 或點按鈕立即結束
- 5 秒逾時硬上限，圖片載不完也會放行
- reduced-motion 與無 JS 直接看到完整靜態頁（見 §2）
- 依使用者決定**每次整頁載入都播**（未做 sessionStorage 記憶）；SPA 內部導航（例如從系列頁按返回）不會重播，因為元件不重新掛載

### 8. 系列名的「交叉淡換」是等效方案，不是逐幀復刻

參考站用單一全域 pin 節點在區塊交界處抽換內容，做出無縫交叉。本頁改為**每個區塊各自 sticky**，靠相鄰兩個 sticky 的自然交接產生「上一組退、下一組進」——狀態複雜度低很多，視覺結果接近。逐字進出由 `--sp` 落在 [0.08, 0.92] 區間切換 `data-active`，delay 用 `calc(var(--i) * 40ms)`。

### 9. hero 的標語拆成四邊大字

標語不放在畫面中央，而是拆成四個字圍在照片四邊：上 `Shine`（與 `Happy` 每 3.4 秒輪換）、左 `in`、右 `your`、下 `Love`。往下捲時四個字各自朝外散開並淡出，照片同時微微推近（`scale(1 + hp*0.06)`）。

- 捲動進度 `--hp` 用 `useScrollProgress` 的 **leave 模式**：滿版 hero 的高度等於視窗高，block 模式沒有可捲行程（`height - viewport = 0`）算不出進度，所以另加一個「已捲掉幾個視窗高」的模式。預設 0＝全部就位。
- **語意**：畫面上的四個字是視覺呈現，`aria-hidden`；完整標語放在 `<h1 class="sr-only">`，螢幕閱讀器與 SEO 讀到的是一句完整的話，不是四個散字。
- 文字輪換是 JS 驅動的（`setInterval`），繞得過 `main.css` 的 CSS guard，故自行 `matchMedia` 判斷 reduced-motion——命中就停在第一個字。

字級用 `clamp(2.25rem, 7vw, 6rem)` 寫在 `<style scoped>`（本檔不在公開頁白名單）。

### 10. 婚禮倒數：橫排再旋轉成直式

`GalleryCountdown.vue` 貼在 hero 右緣，DAY／HR／MIN／SEC 由上往下讀，倒數歸零後整條換成 `We're married!`。

- **排版**是一列橫的再整條 `rotate(90deg)` 立起來。置中不能靠 grid／flex：橫列（約 300px）比右緣窄框（約 50px）寬得多，**溢出時對齊會退回 start，整條會被推出畫面外**（實測 x 落在 1477、視窗只有 1440）。改用絕對定位的置中慣用法 `left/top: 50% + translate(-50%, -50%) rotate(90deg)`——translate 的百分比取元素自身寬高，在旋轉之後作用於外層座標，剛好把旋轉後的中心對回窄框中心。
- **時間只在 mounted 之後才算**：SSR 與首次渲染都不輸出數字，避免 hydration 兩端對不上。
- **無障礙**：每秒跳動的數字若進了無障礙樹會被反覆讀出，故視覺列 `aria-hidden`，另給一句靜態的「距離婚禮還有 N 天」。
- 目標時間 `weddingAt: '2026-11-22T12:00:00+08:00'`（入席時間，見 `useStoryContent` 的 `venue.dateTime`）。

### 11. 版面上的兩個實測修正

- **手機的底部導覽膠囊**與 `MusicToggle`（fixed 右下）會疊在一起：膠囊改 `left: 12px; right: 88px`（不置中）讓出音樂鈕，640px 以上才回到置中。hero 的署名也因此上移到膠囊之上。
- **手機的系列區塊**若沿用桌機「左中文、右英文」的橫向排法，英文會被右側照片整個蓋掉：手機改成中英文疊成一欄靠左、照片讓到右半邊，1024px 以上才橫向展開。
