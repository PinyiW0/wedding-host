# Phase 0: 準備工作

## 前置（必做，先於下方一切判斷）：定位並正規化 spec 檔名

下游所有判斷（來源判斷、Path 前綴偵測、codegen）只認 canonical **`spec/api/api-spec.yml`（連字號）**。
進 Phase 0 的第一件事，先把後端交付的別名收斂成這個 canonical 檔名：

1. `spec/api/api-spec.yml` 已存在 → 直接用，跳過本步。
2. 不存在，但 `spec/api/api_spec.yml`（底線版，後端最常見）存在 → `mv spec/api/api_spec.yml spec/api/api-spec.yml` 改名成 canonical，再繼續。
3. 其他別名（`.yaml` 副檔名、`openapi.yml` / `swagger.yml` 等）→ **依語意**判斷是否為本專案 OpenAPI 來源（底線只是最常見範例，非白名單）；是則同樣 `mv` 成 canonical。命名不尋常、無法確定是不是 spec 時，列出候選請操作者確認，**別默默猜、也別硬比字面**。
4. canonical 與別名**同時存在且內容不同** → 不確定哪份才是最新，停下來問操作者要用哪份，再 `mv` 覆蓋。

> 為何 rename 而非保留兩份：canonical 是單一 SoT，避免兩份漂移；後端下次再匯出別名版，置入後本步驟會再次收斂（覆蓋更新）。
> 此步只在 skill 流程內執行——不透過 skill、直接手跑 `npm run gen:api` 而當下只有別名版，仍會「找不到來源」（先 `mv` 或先跑一次 feature-to-api）。

---

## 必讀規範

```
所有模式必讀：
- ../references/openapi-conventions.md（輸出格式法典）
- spec/ui-config/ui-config-pm.yaml（PM 設定）

OpenAPI 模式必讀：
- spec/api/api-spec.yml（SoT）
- ../references/openapi-codegen.md（codegen 工具鏈 + view 型別 alias + 合約測試 + Sync loop）

Feature 推導模式必讀：
- spec/gherkin-feature/*.feature（所有 feature 檔）

Sync 模式額外讀取：
- spec/report/route-map.yaml（現有路由對照表）
- app/types/api/*.ts（現有型別定義，欄位級比對基準）
```

---

## 來源判斷（先做）

| 條件 | 模式 | 行為 |
|------|------|------|
| `spec/api/api-spec.yml` 存在 | **OpenAPI 模式** | 跳過 `.feature` 推導，直接 1:1 從 OpenAPI 派生 types + endpoints |
| 僅 `spec/gherkin-feature/*.feature` 存在 | **Feature 推導模式** | 從 `.feature` 推欄位 + 端點；輸出格式遵守 `openapi-conventions.md` |

## 模式判斷（疊在來源判斷之上）

Phase 0 再檢查 `spec/report/route-map.yaml`：

| 條件 | 模式 | 行為 |
|------|------|------|
| `route-map.yaml` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」 |
| `route-map.yaml` **存在** | **Sync 模式** | 執行下方「Sync 模式步驟」（增量偵測 + 變更報告） |

---

## 偵測總則（下方所有偵測器都適用）

> 下方各偵測器（path 前綴 / auth / rbac / realtime / streaming）列出的訊號是**常見範例，不是窮舉白名單**。判準是**語意**——「這份 spec 是否描述了該能力」，而非「有沒有出現某個字串」。命名 / 結構不同但語意相同一樣要命中（例：登入端點未必叫 `/auth/login`，可能是 `/sessions`、`/oauth/token`；前綴未必住在 `servers.url`）。
>
> **多個來源衝突時，以實際端點 / schema 為準**，不以單一宣告來源為準。依現況判斷；訊號模糊、來源互相矛盾、或無法判定時 → **停下來問使用者，不要默默猜**。

### 偵測索引（導覽，判準以下方各段語意為準，不得退化成字面比對）

| 關注點 | 一句話語意判準 | route-map 區塊 | 詳段 / 範本 |
|---|---|---|---|
| path 前綴 | 端點實際住在哪個共同前綴 | `api_contract.path_prefix` | §Path 前綴偵測 |
| auth | 有沒有登入主體 | `auth` | auth-scaffold.md |
| rbac | 不同角色能做的事不同嗎 | `rbac` | rbac-scaffold.md |
| realtime | 有伺服器推送 / 雙向連線嗎 | `realtime` | `realtime` skill |
| streaming | 有影音播放 / 直播嗎 | `streaming` | `streaming` skill |

> rbac 以 auth 為前提；各關注點無訊號則該區塊**完全不生**（中立預設）。索引只為防漏——五個都要逐一過，判準一律回到下方各段的語意描述。

---

## Path 前綴偵測（兩種模式皆執行，先做）

> **目的**：path 前綴（如 `/api/v1`、`/v1`、`/api`、空）由後端習慣決定，各專案不同。Phase 0 偵測一次後鎖定在 `route-map.yaml > api_contract.path_prefix`，**後續執行不重抽**，SoT 模式切換時（OpenAPI ↔ Feature 推導）也不變。詳細原則見 `openapi-conventions.md § 6.0 / 6.1`。

### 偵測流程（依序檢查，遇到即停止）

```
1. route-map.yaml > api_contract.path_prefix 存在？
     → 是 → 沿用此值，跳過偵測（鎖定原則）
     → 否 → 繼續

2. spec/api/api-spec.yml 存在？
     → 是 → 前綴的真相是「端點實際住在哪」；servers.url 只是線索之一（常只有 host 無 path，
            或與 paths 不一致）。取兩份證據再和解，不要只信 servers.url：
              a. servers.url 的 path 段（去掉 protocol+host+port）
              b. 所有 paths keys 的最長共同前綴
                 （如 /api/v1/auth/login + /api/v1/sites → /api/v1）
            和解規則：
              - (a) 與 (b) 一致 → 用該值
              - servers.url 無 path 段、或 (a) 與 (b) 衝突 → 以 (b) paths 共同前綴為準
                （端點真的住的地方；servers 的 host-only / 環境別 URL 不代表前綴）
              - 兩者皆空 → 前綴為空字串
            例：servers.url="https://api.example.com/v1"、paths 以 /v1 開頭 → /v1
            例：servers.url="http://localhost:8000"（無 path）、paths 以 /api/v1 開頭 → /api/v1
            寫入 route-map.yaml，停止
     → 否 → 繼續

3. server/api/ 目錄存在且非空？
     → 是 → 掃描所有 endpoint 檔，取最長共同前綴
            例：server/api/v1/sites/, server/api/v1/cameras/ → path_prefix = "/api/v1"
            例：server/api/sites/, server/api/auth/         → path_prefix = "/api"
            寫入 route-map.yaml，停止
     → 否 → 繼續

4. 完全空專案（無 spec 也無既有 endpoint）
     → 停下來詢問使用者：「請指定 API path 前綴（例：/api/v1、/v1、/api、空字串）」
     → 不要默默猜
```

### 偵測完寫入 route-map.yaml

```yaml
api_contract:
  path_prefix: /api/v1  # 由 Phase 0 偵測產生，各專案不同；後續執行不重抽
  ...
```

> ⚠️ **產出永遠是相對 path**：若偵測來源含絕對 URL（如 `https://host/v1`），只取 path 段（`/v1`），host / port / protocol 全部丟棄。Domain 由 env (`NUXT_PUBLIC_API_BASE`) 在 runtime 注入。

---

## Auth 偵測（兩種模式皆執行，先做）

> SDD workflow 對 auth 中立——**偵測到才走**，無訊號的專案完全不生 auth。詳見 [auth-scaffold.md](auth-scaffold.md)。

grep 來源訊號（命中任一即「需要 auth」）：

- OpenAPI：`paths` 同時含 `/auth/login` 與 `/auth/refresh`；或 `securitySchemes` 有 bearer
- `.feature` / `.flow.md`：有登入 scenario（登入 / login / 帳號+密碼 / 未登入導向）

**偵測到 → 寫入 `route-map.yaml > auth` 區塊**（`required: true` + `login_path` / `home_path` / `public_paths` / `token_endpoints`，格式見 auth-scaffold.md §2）。`public_paths` 推導：login ＋ `.feature` 中**無需登入即可用的場景**（賓客／訪客／公開瀏覽）對應的路由——漏列會被 middleware 誤擋，多列會漏守門，判準是「這個場景的操作者有沒有登入過」。**公開路由不得是受保護路由的路徑前綴**（middleware 前綴比對，`/announcement` 公開會連 `/announcement/settings` 一起放行）——路由規劃時遇到巢狀衝突，把受保護頁改掛別的前綴（如 `/admin/…`），並依 auth-scaffold.md §3a 套用 API 層範本（提供 `useHttpAuth` handler 即啟用攔截，**useHttp.ts 不覆蓋**；`nuxt.config` 追加 auth 路徑）。

**沒偵測到 → route-map 不寫 auth 區塊、不套 scaffold。** Sync 模式下後來才出現 `/auth/*` 一樣補上（見 auth-scaffold.md §6）。

---

## Realtime 偵測（兩種模式皆執行，先做）

> SDD workflow 對即時連線中立——**偵測到才提示**，無訊號的專案完全不碰。即時連線的實作知識（連線生命週期、重連補抓、auth token、cleanup、傳輸選型）由 `realtime` skill 提供。

grep 來源訊號（命中任一即「有即時需求」）：

- SSE：OpenAPI 有 `text/event-stream` content type、或 `/events`（含 `?channels=`）端點；`.feature`/`.flow.md` 有「即時 / 推播 / 通知 / live / 斷線重連」scenario
- WebSocket：`wss://`、`ws://`、WebSocket 端點描述
- WebRTC：`RTCPeerConnection`、signaling、datachannel

**偵測到 → 寫入 `route-map.yaml > realtime` 區塊**（`transport: sse | websocket | webrtc-data`、`events`（端點路徑）、`event_types`（信封 `type` 列舉，供前端手寫 discriminated union）、`auth`（連線端點認證方式：`query-token | cookie | header`））**並在報告提示「建議套用 `realtime` skill」**。SSE 信封的 `data` 多半是鬆散型別（codegen 給 `Record<string, never>`），型別語意由前端手寫 discriminated union 補（見 openapi-codegen.md §8、realtime/references/sse.md）。

> `auth` 判定（**別假設一律 query**）：讀連線端點的 `security` 與 `parameters`——`token`/`access_token` 類參數 `in: query` 且 `security: []` → `query-token`；靠 cookie（cookie security scheme 或描述提及）→ `cookie`；走 Bearer header（少數，前端需改用 `@microsoft/fetch-event-source`）→ `header`。realtime skill 依此值實作連線 URL / 認證。

**沒偵測到 → route-map 不寫 realtime 區塊、不提示。** Sync 模式下後來才出現即時端點一樣補上。

---

## Streaming 偵測（兩種模式皆執行，先做）

> SDD workflow 對影音串流中立——**偵測到才提示**，無訊號的專案完全不碰。影音播放的實作知識（播放器掛載、錯誤自救、看門狗、延遲調校、多路對齊、teardown、傳輸選型）由 `streaming` skill 提供。

grep 來源訊號（命中任一即「有串流播放需求」）。**OpenAPI 是主訊號**——串流合約住在 spec 與 UI，flow 通常只以路由暗示（如 `/watch/live`），故 flow 側訊號弱、僅供參考：

- HLS：OpenAPI 有 `hlsUrl` 欄位、`/streams` 端點、描述含「HLS」、或 `.m3u8`；mock / 原始碼有 `application/vnd.apple.mpegurl`、`application/x-mpegurl`
- WebRTC media：`RTCPeerConnection` + `ontrack` / `addTrack` / `addTransceiver`
- （flow 側弱訊號）`.flow.md` 出現名為 `live` 的路由 / 頁面（如 `/watch/live`）——僅暗示可能有直播頁，**不據此要求 flow 寫串流不變式**（畫面呈現屬 vibe）

**偵測到 → 寫入 `route-map.yaml > streaming` 區塊**（`transport: hls | webrtc-media`、`url_source`（提供播放 URL 的端點，如 `/streams/{streamId}` 取 `hlsUrl`）、`url_field`（URL 欄位名，如 `hlsUrl`））**並在報告提示「建議套用 `streaming` skill」**。播放 URL 多由獨立端點提供（單一真相來源），型別走 codegen alias（如 `StreamResponse`），實作見 streaming/references/hls.md。

**沒偵測到 → route-map 不寫 streaming 區塊、不提示。** Sync 模式下後來才出現串流端點一樣補上。

---

## 授權（RBAC）偵測（兩種模式皆執行，先做）

> SDD workflow 對授權中立——**偵測到才走**，無角色分層的專案完全不碰。授權的實作知識（route-map.rbac schema、mock 守門範本、檔案落點）由 [rbac-scaffold.md](rbac-scaffold.md) 提供。
> **rbac 以 auth 為前提**：偵測到 rbac 必同時需要 auth（沒有登入主體就無從判角色）；若 rbac 命中但 auth 未命中，視為矛盾 → 列研判問操作者。

判準是**語意**——「不同角色看到 / 能做的事不一樣嗎」，不是逐字比對。下列訊號為**常見範例非白名單**，命中任一即「有角色分層」：

- OpenAPI：端點 description 含「僅 X 可操作 / X 不得 / X 才能」這類**操作者角色限制**散文（→ `endpoints`，OWASP BFLA）；含「只能讀 / 改 / 刪**自己的** X」「不得存取**他人** Y」這類**單筆歸屬**散文，尤其在 `/{id}` 端點（→ `object_ownership`，OWASP BOLA / API #1）；schema 有 `roles` 列舉欄位（值如 `super_admin`/`observer`/`owner`/`member`，皆範例）；`403` 回應帶權限語意 `errorCode`
- `.feature` / `.flow.md`：不同身分操作同一資源結果不同（「以管理員登入」vs「以觀測員登入」看到的清單 / 可按的鈕不同）、「無權限 / 僅…可 / 被拒 / 只能操作自己的」語意 scenario

**偵測到 → 寫入 `route-map.yaml > rbac` 區塊**（`required: true` + `roles` + `endpoints`（端點存取控制 / BFLA）+ `ownership`（列表級 ACL）+ `object_ownership`（單筆 object 級 ACL / BOLA，最常漏卻是 OWASP #1）+ `protected_routes`（前端守門）+ `business_guards`（僅登錄不自動生），格式見 rbac-scaffold.md §2）**並在報告提示「建議套用 rbac-scaffold」**。角色名一律從 spec 萃取、不寫死；判準是語意角色（受限 vs 全權）。

**沒偵測到 → route-map 不寫 rbac 區塊、不套守門。** Sync 模式下後來才出現角色限制端點一樣補上（見 rbac-scaffold.md §5）。命名超出範例、或來源互相矛盾（散文說「僅 super_admin」但 feature 卻讓 observer 操作）時 → **不默默猜、也不硬比字面，列出研判與操作者確認再定**。

---

## OpenAPI 模式執行步驟（api-spec.yml 存在時）

1. **讀取 PM 設定**（同下方全量模式步驟 1）
2. **讀取 OpenAPI**：`spec/api/api-spec.yml`
3. **codegen 重生底層型別**（OpenAPI 模式專用，取代逐欄手抄 YAML → TS）：
   - 跑 `npm run gen:api` → 產 `app/types/api/_schema.d.ts`（機器產、進版控、**不手改**）
   - 從 `_schema` 的具名 schema **派生 view 型別 alias** 到 `app/types/api/{resource}.ts`（一個資源一檔）：
     `export type AccountListItem = components['schemas']['AccountListItem']`
   - 同資源的 `XxxCreatedEvent` / `XxxListItem` / `XxxBody` 放同檔；view 命名照 `openapi-conventions.md` § 1
   - null / enum / 具名 schema 對應由 codegen 處理；view 命名語意由 alias 補（見 `openapi-codegen.md` § 4）
   - 建立 `app/types/api/index.ts` 統一 re-export（re-export view 型別，**不 re-export `_schema`**）
4. **派生端點規格**：每個 `paths/*/{method}` → `endpoints` 條目
   - 路徑、method、request/response schema 引用全照抄
   - 不要自加分頁（除非 spec 有 `parameters`）
   - 不要改 method（如 spec 寫 `PATCH /watches/{id}/station` 就照 spec）
5. **產生 route-map.yaml**：
   - 寫入 `api_contract.path_prefix`（來自上方「Path 前綴偵測」結果，**所有 endpoint 路徑都以此前綴開頭**）
   - 寫入 `api_contract.response_conventions`（回應信封依 openapi-conventions §3 判定：模式 A envelope／模式 B 裸回，判定規則勿在此複製）：
   ```yaml
   response_conventions:
     envelope: 'A 或 B（判定依 openapi-conventions §3；apiEnvelope=false → B）'
     list: 'A：ok(T[]) / page(items, pagination)；B：T[]'
     single: 'A：ok(T)；B：T'
     action: XxxEvent（POST 201；軟刪除 204 無 body，兩模式皆同）
     error: 'A：ErrorEnvelope；B：createError({ statusCode, statusMessage })'
   ```
6. **產出前自檢**：
   - □ `app/types/api/_schema.d.ts` 由 `gen:api` 產、未手改（檔頭 `Do not make direct changes`）
   - □ view 型別是 `_schema` 的 alias，`index.ts` 未 re-export `_schema`
   - □ `api_contract.path_prefix` 已寫入（值來自「Path 前綴偵測」）
   - □ 所有 `endpoints[*].path` 都以 `path_prefix` 開頭，且為相對 path（無 `http://` / host）
   - □ view 型別涵蓋所有端點用到的 `components/schemas`
   - □ endpoints 數量與 `paths` 一致（method 維度）
   - □ 全欄位 camelCase
   - □ 未自創第三種包裝（如 `{ status, data, meta }`）；envelope 模式判定已寫入 `response_conventions`
   - □ HTTP code 對齊 spec
   - □ 若偵測到角色分層，`rbac` 區塊已寫入且涵蓋所有角色限制端點（見 rbac-scaffold.md §2）
7. **詢問用戶確認**

---

## Feature 推導模式注意事項

走下方「全量模式執行步驟」，但有三個必改：

- **欄位命名 camelCase**（不再 snake_case）
- **型別命名分 Event / ListItem / Body / Detail**（見 `openapi-conventions.md` § 1）
- **mock 端點回應模式依 openapi-conventions §3**（預設模式 A envelope；Phase 1 負責實作，這邊先在 `route-map.yaml > response_conventions` 標明判定結果；絕不自創 `{ status, data }` 包裝）

---

## 全量模式執行步驟

1. **讀取 PM 設定**
   - 讀取 `ui-config-pm.yaml`
   - 同步到 `ui-config.yaml`（參考下方同步邏輯）
   - 記錄 `additionalFeatures` 中值為 `true` 的項目（後續步驟 6 寫入 route-map）

2. **掃描所有 .feature 檔**
   - 路徑：`spec/gherkin-feature/*.feature`（含 `.dsl.feature` 變體）
   - ⚠️ **必須讀取全部檔案**

3. **產出功能清單**（見下方格式）

4. **產出路由規劃**（見下方格式）

5. **建立 API 合約型別**（直接寫入 `app/types/api/*.ts`）
   - 根據 feature 分析結果，直接建立 TypeScript 型別定義檔
   - 每個資源一個檔案（如 `sites.ts`、`auth.ts`）
   - 建立 `index.ts` 統一 re-export
   - ⚠️ **欄位命名使用 `camelCase`**（對齊 OpenAPI 慣例，未來與 `api-spec.yml` 無痛對接；不再用 snake_case）
   - ⚠️ **型別命名分 Event / ListItem / Body / Detail**，見 `openapi-conventions.md` § 1
   - ⚠️ 日期欄位使用 `string`（JSON 不支援 `Date`）
   - ⚠️ **必須建在 `app/types/api/`**，Nuxt 4 的 `~` 別名解析到 `app/`
   - 見下方「API 合約型別範例」

6. **產生路由對照表**（`spec/report/route-map.yaml`）
   - 根據步驟 3-5 的分析結果，自動產生路由對照檔
   - 此檔案是後續所有 Phase 及 **update 迭代的唯一參照來源**
   - ⚠️ **`api_contract` 區塊**：包含 `path_prefix`（路徑前綴，由「Path 前綴偵測」決定）、`types`（型別欄位快照，作為 Sync diff 基準；程式碼 SSoT 仍是 `app/types/api/*.ts`）和 `endpoints`（端點規格，所有 `path:` 必以 `path_prefix` 開頭）
   - 見下方「路由對照表格式」

7. **產出前自檢**（寫入檔案前逐項確認）
   - □ `/` 根路由存在（`navigateTo` 到第一個主要頁面）
   - □ 每個 `.dsl.feature` 都有對應的路由
   - □ `app/types/api/*.ts` 涵蓋所有端點的 Request/Response 型別
   - □ `api_contract.path_prefix` 已寫入（值來自「Path 前綴偵測」）
   - □ 所有 `api_contract.endpoints[*].path` 與各路由 `api_endpoints` 都以 `path_prefix` 開頭，無例外
   - □ 沒有絕對 URL（grep `https?://` 在所有產出檔應為 0）
   - □ `api_contract.types` 的欄位與 `app/types/api/*.ts` 的 export interface 一一對應
   - □ `api_contract.endpoints` 與各路由的 `api_endpoints` 一致
   - □ `enabled_features` 反映 PM yaml 的 `additionalFeatures`（有啟用的功能才寫入）
   - □ 啟用功能的頁面已標註 `features_used`
   - □ 若偵測到角色分層，`rbac` 區塊已寫入且涵蓋所有角色限制端點（見 rbac-scaffold.md §2）

7.6. **孤兒偵測（反向 audit）** ⚠️ 必跑

   全量模式通常用於首次設定（codebase 空），但若在已有 codebase 的情況下跑全量（如重置 route-map 後重建），仍需執行孤兒偵測。

   流程與輸出見 [phase-0-sync.md 步驟 7.6](phase-0-sync.md#步驟-76孤兒偵測反向-audit-必跑)。產出寫入新 `sync-report.md`（或全量模式下的 `initial-report.md`）的「🗑️ 孤兒清單」段。

8. **詢問用戶確認**（含路由對照表內容 + 孤兒清單若有）

---

## PM 設定同步邏輯

| PM 設定欄位 | ui-config.yaml 欄位 | 轉換規則 |
|------------|---------------------|----------|
| `project.*` | `project.*` | 直接複製 |
| `meta.*` | `meta.*` | 直接複製 |
| `theme.colors.*` | `theme.colors.*` | 非空值覆蓋預設，空值 fallback 到 Tailwind 內建色 |
| `colorMode.*` | `colorMode.*` | 直接複製 |
| `toast.displaySeconds` | `toast.duration` | 秒 → 毫秒 (×1000) |
| `toast.position` | `toast.position` | 中文轉英文（右上角→top-right 等） |
| `table.*` | `table.*` | 直接複製（結構已對齊） |
| `delete.*` | `delete.*` | 直接複製（結構已對齊） |
| `testAccounts` | `testAccounts` | 直接複製 |
| `additionalFeatures.*`（boolean） | `additionalFeatures.*.required` | `true` → `true`，`false` → `false` |

---

## 輸出格式：功能清單

```markdown
## 功能清單

### 認證相關
- [ ] 登入頁面 (01-使用者登入.dsl.feature)
- [ ] 登出功能 (02-使用者登出.dsl.feature)

### 觀測點管理
- [ ] 觀測點列表 (03-查詢觀測點列表.dsl.feature)
- [ ] 建立觀測點 (04-建立觀測點.dsl.feature)

### 資料模型
| 實體 | 欄位 | 來源 |
|------|------|------|
| User | account, role, status | 01-使用者登入 |
| Site | id, name, stationCount | 03-查詢觀測點列表 |

### API 端點規劃
> ⚠️ 路徑以本專案偵測到的 `path_prefix` 為前綴；下例假設 `/api/v1`

| 端點 | 方法 | 用途 | 來源 |
|------|------|------|------|
| /api/v1/auth/login | POST | 登入 | 01 |
| /api/v1/sites | GET | 觀測點列表 | 03 |
```

**讀回完整性（規劃完端點必查）**：`.feature` 是命令驅動的，照著寫只會產出寫入端點。列完端點表後，逐一檢查每個 command（POST/PUT/PATCH）：「它寫入的每個欄位，重新整理後前端從哪個 GET 拿回來？」

- 詳情頁顯示的欄位 → 該 aggregate 的詳情 GET（`XxxDetail` 完整型別）必須含這些欄位
- 只有列表 GET 而 command 寫入的欄位不在 `XxxListItem` → 補詳情 GET，不要把欄位硬塞進列表型別
- 完全沒有 GET 的可變狀態（設定、偏好、佈置類 aggregate）→ 補一條讀回 GET
- **OpenAPI 模式端點 1:1 對應 spec、不可自創**——發現讀不回的欄位記入 sync-report「待 PM 處理」，回報後端補 spec

> wedding-host 實戰：命令驅動漏產讀回管道，事後補了 7 個 GET 端點，重新整理才不丟資料。

---

## 輸出格式：路由規劃

```markdown
## 路由規劃

| 路由 | 頁面 | Layout | 功能來源 |
|------|------|--------|----------|
| /login | login.vue | auth | 01-使用者登入 |
| / | index.vue | default | 首頁/Dashboard |
| /sites | sites/index.vue | default | 03-查詢觀測點列表 |
```

---

## API 合約型別範例

Phase 0 直接建立 `app/types/api/*.ts`，消除 YAML → TypeScript 翻譯誤差。

### 型別檔案結構

```
app/types/api/
├── index.ts     # 統一 re-export
├── auth.ts      # LoginData
├── sites.ts     # SiteItem, CreateSiteBody
└── stations.ts   # StationItem, CreateStationBody
```

### 型別檔範例

```typescript
// app/types/api/sites.ts
export interface SiteListItem {
  siteId: string // uuid
  siteName: string
  stationCount: number
}

export interface SiteCreatedEvent {
  siteId: string
  siteName: string
}

export interface CreateSiteBody {
  siteName: string
}
```

```typescript
// app/types/api/index.ts — 統一 re-export
export type { ObserverLoggedInEvent, LoginBody } from './auth'
export type { CreateSiteBody, SiteCreatedEvent, SiteListItem } from './sites'
```

> ⚠️ **命名慣例**：欄位 `camelCase`、型別 `PascalCase`、UUID 用 `string`、日期用 `string`
>
> ⚠️ **型別命名規則**（見 `openapi-conventions.md` § 1）：
> - 寫入動作回應 → `XxxEvent`（過去式動詞）
> - 列表 view → `XxxListItem`
> - Request body → `XxxBody`
>
> ⚠️ 此型別是前端自定義的合約，未來 `api-spec.yml` 到位後只需逐欄對齊 schema。

---

## 路由對照表格式（route-map.yaml）

用戶確認後，將此對照表寫入 `spec/report/route-map.yaml`。此檔案是後續 Phase 2-5 及 **update 迭代的唯一參照來源**。

```yaml
# spec/report/route-map.yaml
# 由 /feature-to-api Phase 0 自動產生
# ⚠️ 可手動修改，修改後以此為準

generated_at: 2026-01-20
version: 1

# PM 啟用的額外功能（來自 ui-config-pm.yaml > additionalFeatures）
# 只列出值為 true 的項目；全部 false 時省略此區塊
# Phase 4 據此建立對應元件，Phase 5 據此在頁面中使用
# 各功能的實作規範 → 見 ../../feature-to-ui/references/features.md（跨 skill 引用，路徑相對本規範檔）
enabled_features:
  - charts # 統計圖表
  - dragAndDrop # 拖曳排序

# API 合約規格
api_contract:
  # API path 前綴（由 Phase 0「Path 前綴偵測」產生，各專案不同）
  # - 普世原則：產出永遠是相對 path；domain 由 env (NUXT_PUBLIC_API_BASE) runtime 注入
  # - 範例：/api/v1、/v1、/api、/api/v2024-01、'' (空字串皆合法)
  # - 鎖定原則：一旦寫入，後續執行不重抽；SoT 模式切換時不變
  path_prefix: /api/v1

  # 回傳格式慣例（回應信封依 openapi-conventions §3：模式 A envelope／模式 B 裸回，判定後寫入）
  response_conventions:
    envelope: 'A 或 B（判定依 openapi-conventions §3；apiEnvelope=false → B）'
    list: 'A：ok(T[]) / page(items, pagination)；B：T[]'
    single: 'A：ok(T)；B：T'
    action: XxxEvent（POST 201；軟刪除 204 無 body，兩模式皆同）
    error: 'A：ErrorEnvelope；B：createError({ statusCode, statusMessage })'

  # 型別欄位快照（鏡像 app/types/api/*.ts，作為 Sync diff 基準）
  # 程式碼層面的 SSoT 仍是 app/types/api/*.ts
  # 手動修改只改 *.ts，此區塊由 Phase 0 自動同步覆蓋
  types:
    SiteListItem:
      file: sites.ts
      fields:
        siteId: string
        siteName: string
        stationCount: number
    SiteCreatedEvent:
      file: sites.ts
      fields:
        siteId: string
        siteName: string
    CreateSiteBody:
      file: sites.ts
      fields:
        siteName: string

  # 端點規格（方法 + 路徑 + Request/Response 型別名引用）
  # ⚠️ 以下 path 假設 path_prefix = "/api/v1"，實際以本檔上方 path_prefix 為準
  # 所有 path 必以 path_prefix 開頭；不得寫絕對 URL
  # ⚠️ Phase 1.5 會依 method + path 推導 client function name（如 GET /sites → listSites，
  #    POST /watches/{id}/end → endWatch），命名規則見 phase-1-5-client-api.md
  endpoints:
    - method: POST
      path: /api/v1/auth/login
      request: LoginBody
      response: ObserverLoggedInEvent
    - method: GET
      path: /api/v1/sites
      request: '{}'
      response: 'SiteListItem[]'
    - method: POST
      path: /api/v1/sites
      request: CreateSiteBody
      response: SiteCreatedEvent

routes:
  - path: /login
    page: app/pages/login.vue
    layout: auth
    features:
      - file: 01-使用者登入.dsl.feature
        content_hash: a1b2c3d4
    api_endpoints:
      - POST /api/v1/auth/login
    components: []
    store: auth

  - path: /sites
    page: app/pages/sites/index.vue
    layout: default
    features:
      - file: 03-查詢觀測點列表.dsl.feature
        content_hash: e5f6g7h8
      - file: 04-建立觀測點.dsl.feature
        content_hash: i9j0k1l2
    api_endpoints:
      - GET /api/v1/sites
      - POST /api/v1/sites
    components:
      - PageHeader
      - ListContainer
      - ConfirmModal
    store: null
    features_used: [] # 此頁面使用的 additionalFeature（空則省略或留空陣列）

  # 範例：使用 additionalFeature 的頁面
  # - path: "/analytics/[id]"
  #   features_used: [charts]   # Phase 5 據此引用圖表元件
```

### 欄位說明

| 欄位 | 說明 |
|------|------|
| `enabled_features` | PM 啟用的額外功能清單（來自 `additionalFeatures`，Phase 4/5 消費，見 [../../feature-to-ui/references/features.md](../../feature-to-ui/references/features.md)，跨 skill 引用） |
| `api_contract` | API 合約規格 |
| `api_contract.path_prefix` | API path 前綴（Phase 0 偵測產生，鎖定後不重抽；所有 endpoint `path:` 必以此開頭） |
| `api_contract.response_conventions` | 回傳格式慣例 |
| `api_contract.types` | 型別欄位快照（鏡像 `app/types/api/*.ts`，Sync diff 基準；手動修改只改 `*.ts`，此區塊由 Phase 0 自動覆蓋） |
| `api_contract.endpoints` | 端點規格（方法 + 路徑 + Request/Response 型別引用） |
| `path` | 路由路徑 |
| `page` | 頁面檔案路徑（相對於專案根目錄） |
| `layout` | 使用的 Layout 名稱 |
| `features` | 對應的 .feature 檔案（物件陣列，含 `file` 和 `content_hash`） |
| `api_endpoints` | 會呼叫的 API 端點列表（引用 `api_contract.endpoints` 的路徑） |
| `components` | 使用的共用元件 |
| `store` | 使用的 Pinia store（null 表示不使用） |
| `features_used` | 此頁面使用的 `enabled_features` 項目（Phase 5 據此引用對應元件） |

### 推導規則

| Feature 類型 | 路由推導 | 說明 |
|-------------|---------|------|
| （無 feature 對應） | `/` → `index.vue` | **必建**：根路由，Phase 2 放空殼，Phase 5 填入 `navigateTo` |
| `使用者登入` / `使用者登出` | `/login` | 認證類功能合併到登入頁 |
| `查詢 XXX 列表` | `/xxx` (複數) | 列表頁 |
| `建立 XXX` / `編輯 XXX` / `刪除 XXX` | 同列表頁 | CRUD 合併到同一個列表頁 |
| `查看 XXX 詳情` | `/xxx/[id]` | 詳情頁 |
| `XXX 的子功能` | `/xxx/[id]/yyy` | 巢狀路由 |

> ⚠️ **根路由必建**：即使沒有 feature 對應 `/`，route-map.yaml 也必須包含 `/` 路由。Phase 2 建空殼，Phase 5 填入 client-side redirect。**禁止使用 `redirectCode`（HTTP redirect 會被瀏覽器快取，影響同 port 的其他專案）**，改用 `if (import.meta.client) { await navigateTo('/xxx', { replace: true }) }`。

> ⚠️ **一個頁面可對應多個 feature**：例如觀測點列表頁同時處理「查詢」「建立」「編輯」「刪除」四個 feature。
>
> ⚠️ **Phase 2 必須讀取此檔案**：建立頁面骨架時，以 route-map.yaml 為準。
>
> ⚠️ **Phase 5 必須讀取此檔案**：實作頁面時，根據 features 欄位確認要實作哪些功能。

### features 格式說明

features 欄位使用物件陣列，每個物件包含 `file`（檔名）和 `content_hash`（內容雜湊）：

```yaml
features:
  - file: 03-查詢觀測點列表.dsl.feature
    content_hash: a1b2c3d4
```

- `content_hash` 使用 `shasum -a 256` 計算 feature 檔案內容
- Sync 模式用此 hash 判斷 feature 是否有變更
- **向下相容**：讀到舊格式（字串陣列）→ 視為無 hash，全部標記為需要比對

計算方式（shell，統一使用 `shasum -a 256`，macOS/Linux 皆內建）：
```bash
shasum -a 256 spec/gherkin-feature/03-查詢觀測點列表.dsl.feature | awk '{print $1}'
```

---

## Sync 模式步驟

Sync 模式的完整步驟（步驟 1-10）、變更報告格式、邊界情況處理 → 詳見 [phase-0-sync.md](phase-0-sync.md)
