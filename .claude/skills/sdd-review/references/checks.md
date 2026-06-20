# 檢查項目細則

6 項框架語意慣例 + Nuxt 4 行為 + 邏輯安全的判斷依據。懷疑某項時,才 deep-read 對應的單一 antfu reference。

## 1. 框架語意慣例(6 項)

### 1.1 解構響應式 props

- 症狀:`const { title } = defineProps<...>()` 後直接用 `title`,響應性丟失
- 依據:`skills/vue/references/script-setup-macros.md`
- 建議:用 `props.title`,或 `toRefs`

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
- 依據:`CLAUDE.md` 關鍵規則
- 規則:讀取用 `useFetch`,寫入用 `$fetch`

### 1.6 globalThis.$fetch 繞型別

- 症狀:出現 `globalThis.$fetch` 規避型別檢查
- 依據:`CLAUDE.md` 關鍵規則
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

local 模式做輕量掃,只點出可疑處;pr 模式才完整推敲。

| 項目 | 看什麼 |
|------|--------|
| 授權檢查 | 改/刪/讀他人資源的端點,有沒有驗證操作者擁有該資源(如 deviceId 比對) |
| 敏感資料外洩 | 回傳是否帶出 token、密碼、內部欄位 |
| 輸入驗證 | 直接信任 body/query 拼進查詢或回傳 |

> 安全 finding 一律列「必修」。敏感資料外洩屬高風險,需明確標示。
