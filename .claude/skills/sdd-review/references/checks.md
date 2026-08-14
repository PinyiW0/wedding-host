# 檢查項目細則

6 項框架語意慣例 + Nuxt 4 行為 + 邏輯安全的判斷依據。懷疑某項時,才 deep-read 對應的單一 antfu reference。

## 1. 框架語意慣例(6 項)

### 1.1 解構 props 傳出 scope

- 前提:Vue 3.5+(本專案)解構 `defineProps` 保留響應性,`const { title } = defineProps<...>()` 同檔內直接使用是推薦寫法,**不報**
- 症狀:解構值**傳出 `<script setup>` scope** 才丟響應性——watch source 未包 getter(`watch(title, ...)`)、或把值直接傳入 composable(`useFoo(title)`)
- 依據:`skills/vue/references/script-setup-macros.md`(defineProps 一節,3.5+ 解構含預設值為推薦寫法)
- 建議:傳出 scope 時包 getter:`watch(() => title, ...)`、`useFoo(() => title)`;需 ref 用 `toRef(() => title)`

### 1.2 非必要的深層響應式

- 症狀:大型物件/陣列、僅整體替換,卻用 `ref` 造成深層追蹤開銷
- 依據:`skills/vue/references/core-new-apis.md`
- 建議:改 `shallowRef`

### 1.3 解構 store 漏 storeToRefs

- 症狀:`const { count } = useFooStore()` 解構 state/getters,響應性丟失
- 依據:`skills/pinia/references/core-stores.md`
- 建議:`const { count } = storeToRefs(store)`;action 才可直接解構

### 1.4 store 在 module scope 呼叫

- 症狀:在元件 setup / 函式外的 module 頂層呼叫 `useFooStore()`,SSR 會跨請求汙染
- 依據:`skills/pinia/references/advanced-ssr.md`
- 建議:移到函式內呼叫

### 1.5 讀寫沒分離

- 症狀:寫入(POST/PATCH/DELETE)用了 `useFetch`,或讀取在事件中用 `$fetch` 混用
- 依據:`.claude/rules/code-quality.md`(讀寫分離與型別安全)
- 規則:讀取用 `useFetch`,寫入用 `$fetch`

### 1.6 globalThis.$fetch 繞型別

- 症狀:出現 `globalThis.$fetch` 規避型別檢查
- 依據:`.claude/rules/code-quality.md`(讀寫分離與型別安全)
- 規則:禁止,改用 typed `$fetch`

## 2. Nuxt 4 行為(nuxt skill 為 3.x,以下以 Nuxt 4 為準)

antfu nuxt skill 整體相容 Nuxt 4,唯 data fetching 有兩處過時,易誤導:

### 2.1 useFetch/useAsyncData 的 data 是 shallowRef

- 症狀:深層 mutate `data.value.list.push(x)` 期待畫面更新
- Nuxt 4:`data` 預設 `deep: false`(shallowRef),深層修改不觸發響應;預設值是 `undefined` 非 `null`
- 建議:整體替換 `data.value = [...]`,或確需深層響應時加 `{ deep: true }`

### 2.2 immediate: false 的初始 status 是 idle

- 症狀:用 `status === 'pending'` 判斷「尚未載入」
- Nuxt 4:`immediate: false` 時初始 `status` 是 `'idle'`,要 `execute()` 後才變 `'pending'`
- 建議:未載入用 `status === 'idle'` 判斷

## 3. 邏輯安全(僅 diff 動到 server/ 時)

判準 SSOT:`.claude/rules/server-security.md`(8 條,每條對應 wedding-host 實戰漏洞),本節只列查法。
八類全屬便宜檢查(讀檔+比對),local 模式全跑;pr 模式加深推敲。

| 類別 | 怎麼查(具體步驟) |
|------|------------------|
| 巢狀 scope(IDOR) | 從 handler 檔案路徑列出全部 path 參數 → 逐一對照查詢條件;缺任一父層參數即必修 |
| 兄弟一致性 | diff 動到某 handler 時 `ls` 同目錄兄弟檔(GET/PATCH/DELETE),比對 scope 過濾條件是否逐字等價——**唯一需看 diff 以外檔案的檢查**(wedding-host 的 DELETE 漏洞只看單檔看不出來) |
| mass assignment | grep diff 中 `...body`/`Object.assign` 是否流入寫入語句(push/insert/欄位更新);寫入是否逐欄白名單手構 |
| 輸入驗證 | 寫入 handler 是否經 `readValidatedBody`+schema;數字欄有無 `.int()` 與範圍、enum 欄有無白名單 |
| 身分自報 | body/query 中的 `xxxId` 是否被當操作者身分使用(身分只能來自 auth context/簽名憑證) |
| 投影與分級 | 回傳是否白名單挑欄位;password/token/內部備註/審核理由是否外洩;公開端點是否只回已發布資料 |
| 密鑰 | diff 中的字面 secret、dev 預設值成為 production fallback |
| 錯誤訊息與存在性 | grep diff 中 `createError`:`statusMessage` 是否為固定訊息(不夾 stack/DB 原文/內部細節);歸屬檢查失敗是否回 404 而非 403(不讓外人探測資源存在) |

> 安全 finding 一律列「必修」。敏感資料外洩屬高風險,需明確標示。

## 4. 邏輯安全(前端,僅 diff 動到 app/ 或 nuxt.config.ts 時)

判準 SSOT:`.claude/rules/frontend-security.md`(5 條,對應 OWASP 常青項),本節只列查法。
三類全屬便宜檢查(grep diff),local 與 pr 模式同深度。

| 類別 | 怎麼查(具體步驟) |
|------|------------------|
| XSS sink | grep diff 中 `v-html` → 追內容來源,含任何使用者輸入且無 sanitize 即必修;動態 `:href`/`:src` 綁使用者提供的 URL → 查有無 protocol 白名單 |
| 敏感資料存放 | grep diff 中 `localStorage.setItem`/`sessionStorage.setItem` → 查存入值是否 token/個資(auth 一律走 cookie persist) |
| client bundle 外洩 | diff 新增 `runtimeConfig.public` 欄位或 `NUXT_PUBLIC_*` 環境變數 → 查值是否機敏(public 會打包進 client bundle) |

> 授權邊界(入口隱藏/middleware 只是 UX,授權必在 server)的查法歸 §3 管;前端安全 finding 同列「必修」。
