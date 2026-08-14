# OpenAPI Codegen（型別來源強化，OpenAPI 模式專用）

> 適用：`spec/api/api-spec.yml` 存在（OpenAPI 模式）。
> Feature 推導模式（無 spec）→ 維持手寫型別，本檔不適用。
>
> 核心理念：合約底層型別「機器產、不漂移、零 runtime」；view 型別 / 命名仍**手寫**疊在其上
> → 兩全：底層與後端對齊、語意可讀。codegen 是 OpenAPI 模式的「型別產生工具」，
> **不取代手寫 view 型別、不綁 envelope**。
>
> ⚠️ **本檔範例的領域一律假想**：用 notes 領域（notebooks / notes / members / tags / attachments，沿用 [phase-1-5-client-api.md](phase-1-5-client-api.md) 的領域宣告），**與本 repo dogfood spec（`spec/api/api-spec.yml`）零撞名**。理由：範例若與「在本 repo 跑 `/feature-to-api` 應得的正確產出」同形，讀者無從分辨哪句是示意、哪句是答案，照抄即產出憑空欄位。實際型別一律以 `route-map.yaml > api_contract` 與重生後的 `_schema.d.ts` 為準。
>
> **唯二例外——刻意保留真名，因為它們是「契約本身」而非領域範例**：
> - **envelope 契約**：`SuccessEnvelope` / `PaginatedSuccessEnvelope` / `ErrorEnvelope`。`useHttp` 的拆封行為就綁在這個形狀上（見 `openapi-conventions.md § 3`）——改名會讓範例與實際 composable 對不上。
> - **auth 契約**：`TokenPairData` 與 `POST /api/v1/auth/login`。刻意沿用通用登入慣例、不改端點名。（`phase-1-5-client-api.md` 也用同一個端點，但該檔的領域聲明**尚未**寫明這條例外、目前仍概括地說「不是本專案的實際端點」——那句對其登入範例而言為偽，補聲明追蹤見 issue #103 §8。）

---

## 1. 三軸獨立（先釐清，避免綁死）

envelope（runtime 拆封）⊥ OpenAPI（型別來源）⊥ codegen（工具）。三者正交，四種組合都能跑：

| 組合 | 說明 |
|------|------|
| envelope + codegen | 主力（對齊團隊後端） |
| envelope + 手寫 | 無 spec、後端是 envelope |
| 裸 schema + codegen | 有 spec、後端裸回 |
| 裸 schema + 手寫 | 最簡專案 |

> 選 envelope 不等於選 codegen；選 codegen 也不強制 envelope。codegen 只是「有 OpenAPI 來源時，
> 用工具產底層型別」這一件事。

---

## 2. 分層驗證（型別來源 / 回應驗證 / 表單驗證 / server 輸入驗證）

| 層 | 邊界 | 用什麼 | 為何 |
|----|------|--------|------|
| 合約型別 | API request/response shape | **codegen（openapi-typescript）** | 機器產不漂移、零 runtime、無痛 |
| 回應 runtime 驗證 | 後端 → 前端 | 預設**不做**（後端是 SSoT + 有測試）；要才 zod-parse | 加 runtime 重量、投報率低 |
| 表單輸入驗證 | 使用者 → 前端（**含跨欄位**） | **手寫 zod**（NuxtUI `<UForm :schema>`） | OpenAPI 無法表達跨欄位；confirmPassword 根本不在 API body |
| **server 寫入輸入驗證** | 使用者 → server | **必做**：`readValidatedBody` + 手寫 zod（`server/validation/`；界限從 OpenAPI `minimum`/`maximum`/`enum`/`format: int32` 萃取） | 表單擋不住直打 API 的請求；這層會存活進真 server，mock 期就要對（範本見 [phase-1-mock-api.md](phase-1-mock-api.md)） |

> ⚠️ 「回應 runtime 驗證預設不做」**≠ server 不驗輸入**——前者是「前端要不要驗後端的回應」，
> 後者是「server 要不要驗使用者的 body」，後者必做（wedding-host 實戰：數字欄 NaN／int4 溢位／負值直落資料層）。

- **不選 zod-codegen**（openapi-zod-client / typed-openapi）：generated zod 仍無法表達跨欄位（沒省到手寫），
  又給合約層加 runtime 重量——zod 的價值在表單層，不在合約層。
- **表單 schema 是 API body 的超集**：`confirmPassword` 是 UI-only、不在 API body → 本就該手寫、不可能 codegen。
  跨欄位驗證三個常見坑：
  1. `.refine` 忘了帶 `path: ['confirmPassword']` → 錯誤掛 root、UForm 不顯示（最常見）。
  2. `.refine()` 後變 `ZodEffects`、不能再 `.pick` / `.extend` → 先組好 object 再 refine。
  3. 即時驗證時機 → 用 UForm `validate` prop 做跨欄位（schema 管單欄、`validate` 函式管跨欄位）。

---

## 3. gen:api 用法

```bash
npm run gen:api
# = openapi-typescript spec/api/api-spec.yml -o app/types/api/_schema.d.ts
```

- `app/types/api/_schema.d.ts` 是**機器產、進版控、不手改**（檔頭已標 `Do not make direct changes`）。
- PR 的 `_schema.d.ts` diff 本身就是「API 合約改了什麼」的 review 物件。
- **重生時機**：首次進 OpenAPI 模式、每次後端更新 `api-spec.yml`（見 § 6 Sync）。
- 無 `spec/api/api-spec.yml` 時不要跑（Feature 推導模式維持手寫，§ 開頭已述）。
- **檔名統一 canonical `api-spec.yml`（連字號）**：後端若交付 `api_spec.yml`（底線）等別名，
  feature-to-api Phase 0 前置步驟會自動 `mv` 成連字號 canonical（見 [phase-0-prep.md](phase-0-prep.md)「定位並正規化 spec 檔名」），之後 `gen:api` 才找得到來源。
  **限制**：此正規化在 skill 流程內執行；不透過 skill、直接手跑 `npm run gen:api` 而當下只有別名版，仍會「找不到來源」——先手動 `mv`，或先跑一次 feature-to-api。
- 來源是 **OpenAPI 3.1 也 OK**：openapi-typescript v7 支援；3.1 的 `type: [string, 'null']` 會產 `string | null`、
  `enum` 產 literal union、`allOf` 產交集，皆自動處理。

---

## 4. View 型別 alias（手寫，疊在 `_schema` 上）

view 型別有**兩種來源**，依後端有沒有把該 shape 取名而定（實測真實後端：**回應多半具名、request body 多半內聯**）：

```typescript
// app/types/api/notebooks.ts —— view 型別（手寫 alias，命名照 openapi-conventions.md § 1）
import type { components, paths } from '~/types/api/_schema'

type Schemas = components['schemas']

// (A) 回應：data 是具名 schema（$ref: NotebookResponse）→ 一行 alias（enum union / string|null / 陣列自動繼承）
//     alias 名照 openapi-conventions.md § 1 的 XxxListItem / XxxDetail / XxxEvent，不要直接叫 Notebook——
//     「列表項」與「寫入回應」多半是不同的具名 schema、欄位也不同，各自 alias 才不會混用。
export type NotebookListItem = Schemas['NotebookResponse']
export type NotebookCreatedEvent = Schemas['NotebookCreatedResponse']
export type TokenPair = Schemas['TokenPairData'] // auth 契約，屬檔頭宣告的例外（真名）

// (B) request body：後端常把 body 內聯在 paths（無具名 schema）→ 從 paths 萃取（或 body 很小時直接手寫）
export type CreateNotebookBody = paths['/api/v1/notebooks']['post']['requestBody']['content']['application/json']
export type LoginBody = paths['/api/v1/auth/login']['post']['requestBody']['content']['application/json'] // auth 契約，同上
```

- **先判斷有沒有具名 schema**：`components['schemas']` 有 → 走 (A) 一行 alias；只在 `paths` 內聯 → 走 (B) `paths[...]` 萃取。
  別假設 request body 一定有具名 schema（多數後端只命名 response）。
- **命名仍照 `openapi-conventions.md § 1`**（`XxxListItem` / `XxxDetail` / `XxxBody` / `XxxEvent`），
  alias 只是把後端 schema 名「翻譯」成前端語意名。
- **列表 envelope**（`data: { items: [...] }`）：view 型別取 **item 的具名 schema**（`Schemas['NoteResponse']`）。
  泛型 `PaginatedSuccessEnvelope.data.items` 在 codegen 是 `Record<string, never>[]`（無型別），**不可拿它當 item 型別**；
  `useHttp` 會把分頁攤平成 `T[]`（見 `openapi-conventions.md § 3`）。
- **改 spec → 重生 `_schema` → 具名 schema 改名 / 刪欄 → 此 alias 編譯紅燈**，下游 client / page 連帶紅燈
  → 早期發現（這正是 codegen 的價值，見 § 6）。
- 下游（`app/api/*.api.ts`、store、page）一律 import 這些 **view 型別**，不直接 import `_schema`，
  保留命名語意與替換彈性。

---

## 5. 合約 unit test（守 client × 型別 × mock）

延續 `test/unit/useHttp.spec.ts` 模式（`@nuxt/test-utils` 的 `registerEndpoint` + vitest），對每個資源測三件事：

1. **client function 打對 URL + method**（runtime：`registerEndpoint` 攔截，斷言回傳）
2. **回傳型別 = view alias**（type-level：賦值給 alias 即受 `typelint` 守護）
3. **mock 回傳符合 schema**（mock 賦值給 view alias，欄位不符 → `typelint` 紅燈）

```typescript
import type { NotebookCreatedEvent, NotebookListItem } from '~/types/api/notebooks'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createNotebook, listNotebooks } from '~/api/notebooks.api'

// 本例假想的 spec 有兩個具名 schema（列表項與寫入回應本就是不同型別、欄位可以不同，見 openapi-conventions.md § 1）：
//   NotebookResponse        required = notebookId / title / ownerName / archivedAt  → alias NotebookListItem
//   NotebookCreatedResponse required = notebookId / title                           → alias NotebookCreatedEvent
// 下方每個 mock 各自對齊「自己那個」schema——範例自己漂移就是在教漂移（見 (3)）。
describe('notebooks 合約', () => {
  // get 系 client 回 AsyncData（useFetch），必須在 setup context 內呼叫 → 用 mountSuspended，
  // 不可在測試頂層 `await listNotebooks()`（會噴 "useFetch must be called within setup"）。
  it('listNotebooks 打 GET /api/v1/notebooks，分頁 envelope 拆封後回 NotebookListItem[]', async () => {
    // (3) mock 賦值給 view alias → 欄位漂移即 typelint 紅燈
    const mock: NotebookListItem[] = [{ notebookId: 'nb-001', title: '專案筆記', ownerName: '陳小明', archivedAt: null }]
    // ⚠️ 分頁端點的 mock 要包成 data.items（PaginatedSuccessEnvelope），別寫成扁平 data。
    //    但要知道「為什麼」——**不是**因為扁平會壞。useHttp 對兩者的處理沒有任何可觀測差異
    //    （見 app/composables/useHttp.ts:47-79）：
    //      · isSuccessEnvelope 只看 success===true && 有 data → 扁平照樣被拆封；
    //      · isPaginatedData 對陣列回 false → 直接回 body.data，與分頁攤平後一樣是裸 T[]；
    //      · _meta 只由「body 有沒有 meta」決定，與 data 是不是分頁形狀**正交**
    //        （扁平帶 meta 也會有 _meta；SuccessEnvelope 本身就允許 meta）。
    //    所以扁平 mock 會完全正常地通過下方兩個斷言，typelint 也綠（兩者都是 T[]）。
    //    這正是危險所在：**沒有任何機制抓得到「mock 的 envelope 形狀與 spec 不符」**——測試不會紅、型別不會紅。
    //    只能靠紀律守：mock 的職責是鏡像契約，不是讓斷言過。spec 說分頁就照分頁形狀寫，
    //    meta 也照 PaginatedSuccessEnvelope 帶齊（它的 meta 是 required；形狀屬 envelope 契約，見檔頭例外，別自己編欄位）。
    registerEndpoint('/api/v1/notebooks', () => ({
      success: true,
      data: { items: mock },
      meta: { pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
    }))

    const Comp = defineComponent({
      async setup() {
        const { data } = await listNotebooks()
        return () => h('div', JSON.stringify(data.value))
      },
    })
    const wrapper = await mountSuspended(Comp)
    expect(wrapper.text()).toContain('專案筆記') // (1) URL 對 + envelope 已被 useHttp 拆封
    expect(wrapper.text()).not.toContain('success')
  })

  // post / getOnce 系 client 回 Promise（$fetch），可在測試頂層直接 await。
  // 動作端點回的是非分頁 SuccessEnvelope → mock 就是扁平 data，不包 items（與上面的分頁端點對照）。
  it('createNotebook 打 POST /api/v1/notebooks，回 NotebookCreatedEvent', async () => {
    const created: NotebookCreatedEvent = { notebookId: 'nb-001', title: '專案筆記' }
    registerEndpoint('/api/v1/notebooks', { method: 'POST', handler: () => ({ success: true, data: created }) })

    const res = await createNotebook({ title: '專案筆記', ownerName: '陳小明' })
    expect(res).toEqual(created) // (2) method 對 + envelope 拆封
  })
})
```

> 重點（dogfood 實測）：`get` 系 client（`useHttp().get`）回 `AsyncData`、只能在 setup 內呼叫 → 測試用
> `mountSuspended` 包元件；`post` / `getOnce`（`$fetch`）回 `Promise` → 可直接 `await`。

- **型別層紅燈**靠 `npm run typelint`（spec 一改、alias 一爆，連鎖到此檔）；**runtime 行為**靠 vitest。
- 工具鏈本身的煙霧測試見 `test/unit/codegen.spec.ts`（不依賴專案生成碼，守 `openapi-typescript` 不腐化）。

---

## 6. 接進 feature-to-api（Phase 0 / Sync）

### Phase 0（OpenAPI 模式）

`phase-0-prep.md`「OpenAPI 模式執行步驟」第 3 步改為：

1. 先跑 `npm run gen:api` 重生 `app/types/api/_schema.d.ts`。
2. 從 `_schema` 的具名 schema **派生 view 型別 alias**（§ 4），而非逐欄手抄 YAML → TS。
3. 命名、null、enum 仍照 `openapi-conventions.md § 1-2`。

### Sync 模式（spec 變更）

`phase-0-sync.md` OpenAPI 來源變更時：

```
spec/api/api-spec.yml 變更
→ npm run gen:api          （重生 _schema，決定性、與 spec 永遠同步）
→ npm run typelint         （breaking change → 所有用到處編譯紅燈）
→ 依紅燈逐點修 view alias / client / page（codegen 只定位、不改寫呼叫端）
→ 重跑 typelint 到綠
```

> **「自動修復」的誠實版本**：自動的只有「重生 `_schema`」。breaking change（改名 / 刪欄位）的呼叫端修復
> **不自動**——這是刻意的：要編譯器尖叫，不要它默默編過（默默編過 = 把真實破綻藏起來，更危險）。
> codegen + `typelint` 紅燈 + AI 逐點修，就是逼近「自動修復」的正解，機制已全備（hash diff、sync-report、合約測試）。

---

## 7. spec 變更迭代流（SDD 右分支）

後端更新 `api-spec.yml` 時的完整鏈（修正 SDD 流程圖右分支）：

```
手動置入 api-spec
→ /feature-to-api（Sync）   [含 gen:api 重生型別 + npm run typelint 紅燈修受影響呼叫端]
→ /test e2e spec            （測試先行 → 紅；TDD 的「先寫測試」）
→ /feature-to-ui（Sync）     （為通過 spec 而建 / 改 UI）
→ /test e2e green            （迭代 UI 到綠）
→ Gate 回歸（playwright.gate.config.ts，主 spec + vibe spec 全綠）
```

要點：
- **不要同時放 `/test e2e spec` 與 `/test e2e pipeline`**（pipeline = spec→red→green，會重跑 spec）。
- **最後的 Gate 不是「vibe 驗證」而是「回歸守門」**：合約變更可能打壞其他 feature 主 spec 與既有 vibe spec，
  故 commit 前必跑全 gate（與 pre-push 同一份 config，執行環境差異見 vibe-check「目的」段）。
- **mock 資料形態改變是掃出下游隱藏假設的時機**：新型別、新編碼、新格式（如 SVG data URI 取代 base64 圖片）進 mock 後，型別檢查可能全綠但工具函式的隱藏假設會炸（實例：wedding-host 的 `dataUrlToBytes` 假設 data URL 一律 base64，URL-encoded 形式直接爆）。改完 mock 形態要**實跑受影響功能**（下載、匯出、預覽），不能只看 typelint。
- **commit 前鐵律**：`npm run eslint && npm run typelint`（語法 / 型別，前者含 visual-hierarchy-check），與 playwright（行為）互補。

---

## 8. 真實後端形狀對照（cross-project 實測）

拿生產級 spec（OpenAPI 3.1、envelope `allOf`、enum、分頁、巢狀、ingestion）dogfood 後的「形狀 → 消費 pattern」查表。
**codegen 機械上全部都吃得下（會乾淨產型別）**；下表是「產出後前端怎麼接」的決策，多數靠 typelint 守。

> **形狀是實測的、名字不是**：下表每一列的**形狀**都真的在生產級 spec 上遇過（這是本表的價值）；但**schema 名一律改寫為假想的 notes 領域**，與本 repo spec 零撞名（理由見檔頭）。要接的是形狀，不是名字——照抄名字只會得到不存在的型別。

| 真實形狀 | codegen 產出 | view 型別怎麼接 |
|---|---|---|
| 回應具名 `$ref`（`NotebookResponse`） | 具名 interface | `type NotebookListItem = Schemas['NotebookResponse']`（一行） |
| request body 內聯（無 `$ref`） | 埋在 `paths[...]` | `paths['/x']['post']['requestBody']['content']['application/json']` 萃取，或手寫 |
| 分頁 `data:{items:[]}`（泛型 envelope） | `items: Record<string,never>[]`（**無型別**） | alias **item 具名 schema**（`Schemas['NoteResponse']`），`useHttp` 攤平成 `T[]` |
| enum（`status`） | literal union（`'created'\|...`） | alias 自動繼承，填錯值 typelint 紅燈 |
| OpenAPI 3.1 nullable（`type:[string,'null']`） | `string \| null` | 直接用 |
| 巢狀子物件無自身 `$ref`（`NoteDetail.metadata`） | inline 匿名物件 | 整包 alias OK；要單獨用 → indexed access `NoteDetail['metadata']` |
| 鬆散 `data: object`（SSE，prose 描述 discriminated） | `Record<string,never>` | codegen **產不出 union** → 手寫 discriminated union（`type` 欄位收斂）；實作見 `realtime` skill 的 [references/sse.md](../../realtime/references/sse.md) |
| ingestion 契約 snake_case（`raw_payload`） | snake_case 欄位（**忠實鏡像**） | 照原樣 alias；**不要改 camelCase**（見 `openapi-conventions.md § 1` carve-out） |
| 動作端點回裸 `SuccessEnvelope`（無 `data`） | envelope 無 data 欄位 | `useHttp` 不拆（無 data）→ client 回 `void` / 忽略 body |
| content-negotiation（`application/json` + `text/csv`） | 各自型別 | CSV 走 `getOnce<Blob>` + `responseType:'blob'`；array query（`tagIds[]`）照常傳 |

> 通則：**codegen 永遠忠實鏡像 spec**（含 snake_case、鬆散 object）。前端語意（命名、discriminated union、巢狀拆出）由「手寫 view 層」補；
> 兩者分工 = 底層不漂移 + 上層可讀。哪個後端形狀都不會讓 codegen 失敗，只會改變「上層怎麼接」。

---

## 9. 自我檢查清單（OpenAPI 模式產出前必跑）

- [ ] `_schema.d.ts` 由 `gen:api` 產、未手改、已進版控
- [ ] view 型別是 `_schema` 的 alias，命名照 `openapi-conventions.md § 1`（Event / ListItem / Body / Detail）
- [ ] 下游（client / store / page）import view 型別，不直接 import `_schema`
- [ ] 表單跨欄位驗證走**手寫 zod**（不靠 codegen），`.refine` 帶對 `path`
- [ ] 合約 test 綠（client URL/method + mock 賦值給 view alias 不爆）
- [ ] Sync：spec 變 → 重生 → `typelint` 紅燈逐點修 → 綠
- [ ] Feature 推導模式（無 spec）→ **不跑 codegen**，維持手寫 view 型別
