# Phase 1：依計畫產出 .flow.md

## 目標

依 Phase 0 確認過的計畫，將每個 module 寫成一份 `spec/e2e-flows/{NN}-{module}.flow.md`（兩位編號；`00-` 保留給 auth（條件式），一般 module 從 01 起跳，見 SKILL.md 檔名規則）。

> **v2 抽象化原則**（先讀）：
> `.flow.md` 是 business invariants 的描述文件，不是 UI 步驟腳本。
> Steps 用使用者意圖（自然語言），Expected 用業務可觀察結果（API outcome / 反饋元素 / 狀態變化）。
> testid 為 fallback；首選 role + accessible name，次選 API spy。
> 詳見 [flow-template.md](flow-template.md) 與 [testid-conventions.md](testid-conventions.md) 的 v2 段落。

---

## 前置檢查

1. 確認 `spec/e2e-flows/` 目錄存在；不存在則建立
2. 若使用者在 Phase 0 調整了分組或路由，**以最新對話為準**，不要套用預設表
3. 若沒有 Phase 0 計畫（使用者直接執行 `/feature-to-flow 1`），先回退執行 Phase 0

---

## 步驟 0：`_common.flow.md`（共用前置流程，首次必建）

寫任何 module flow 前，先檢查 `spec/e2e-flows/_common.flow.md`：

- **不存在** → 先產出。內容為跨 module 共用的前置合約（消費端是 `/test e2e` 的 helpers / fixtures，欄位合約見 test skill 的 [setup.md](../../test/e2e/references/setup.md)）：
  1. **登入步驟**：角色 × 帳號表（引用 `ui-config.yaml > testAccounts`，不寫死密碼）＋「{role} "{account}" 已登入」的操作步驟
  2. **確認彈窗**：確認／取消的通用互動與 testid
  3. **資料重置約定**：每個測試前的 mock 重置方式（reset endpoint 或逐筆清除）
  4. **共用路由**：登入頁、首頁等跨 module 起點
- **已存在** → 只在本次 feature 引入新的共用步驟（新角色、新彈窗模式）時增補，不重寫

---

## 寫檔流程

對每個 module 執行以下步驟：

### 1. 載入範本

讀 `references/flow-template.md`，了解 `.flow.md` 應有的結構。

### 2. 為每個 Scenario 產出一段 Flow

每個 `Scenario:` 對應 `.flow.md` 中一個 `## Flow:` 區段。映射規則：

| .feature 元素 | .flow.md 對應 |
|--------------|---------------|
| `Feature:` 名稱 | 在 flow 區段標題前加註「對應 Feature」 |
| `Scenario:` 名稱 | `## Flow: {scenarioName}` |
| `@happy-path` tag | flow 標題後加 `（happy-path）` |
| `@not-found` / `@condition` / `@integrity-constraint` 等 | flow 標題後加對應標籤 |
| `Given the X event has occurred` | `### 業務脈絡`：初始事件/資料狀態 |
| `Given the AccountList view returns` | `### 業務脈絡`：初始畫面資料 |
| `Given no prior events` | `### 業務脈絡`：「系統無既有資料」 |
| `When Observer sends Create*` | `### E2E 驗證流程`：使用者意圖步驟（觸發動作、填表單，不寫 testid） |
| `When System sends ...`（System / Translator） | **不轉成使用者步驟**——該 Flow 標記`（背景同步）`，流程改寫「背景觸發條件」（見第 5 節） |
| `When the X view is queried` | `### E2E 驗證流程`：「進入 /xxx 頁面」 |
| `Then the X event is emitted` | `### Verification 策略`：API spy ＋ 使用者可感知的成功反饋（語意反饋元素） |
| `Then the operation fails with: 訊息` | `### Verification 策略`：「顯示錯誤訊息：{訊息}」（role=alert / 可見文字） |
| `Then the view returns [...]` | `### Verification 策略`：主要識別欄＋業務狀態欄＋代表性抽樣（語意 locator，見第 4 段） |

### 3. 對 Command 型 Scenario 補完 UI 步驟

`.feature` 的 `When ... sends Command` 只給命令名與 payload；要翻譯成 UI 操作。**用使用者意圖描述，不寫死 testid**。

**輸入（.feature）：**
```gherkin
When Observer sends CreateAccount on stream "acc-001":
  """
  { "name": "王思婷", "username": "observer_wang", "password": "pass1234", "remark": "北站觀測員" }
  """
```

**輸出（.flow.md `### E2E 驗證流程`）：**
```markdown
1. 進入 `/accounts` 頁面
2. 觸發「建立帳號」（位置與形式不限：toolbar / float button / menu）
3. 填寫表單欄位：
   - 姓名 → 王思婷
   - 帳號 → observer_wang
   - 密碼 → pass1234
   - 備註 → 北站觀測員
4. 提交表單

### Verification 策略
- API spy：`POST /api/v1/accounts` 被呼叫，payload 含上述四欄
- UI：表單關閉、列表新增「王思婷」實體

### 不再凍結
- 觸發按鈕的形式與位置
- 表單呈現（modal / inline panel / 獨立頁）
- 欄位 input 類型（text / 下拉 / segment）
- 提交按鈕文字（「建立」/「新增」/「送出」皆可）
```

**比較舊風格（已淘汰）**：

```markdown
❌ 1. 點擊 `[data-testid="account-create-button"]`
❌ 2. 驗證 `[data-testid="account-create-modal"]` 顯示
❌ 3. 在 `[data-testid="account-name-input"]` 填入「王思婷」
... (8 步全寫死 testid)
```

舊風格凍結了「按鈕在哪、modal 一定要出現、每個 input 的 testid 命名」。vibe 把它改成 inline panel、segment button、無 modal 都會紅。

**新風格**只描述「使用者要做什麼」，UI 怎麼呈現由 `/feature-to-ui` 決定。

### 4. 對 View 型 Scenario 補完驗證步驟（v2 抽象化規則）

`.feature` 的 `Then the view returns [...]` 給定一個 JSON 陣列。要翻譯成 **business invariant 斷言**，**不是逐欄 testid 斷言**。

---

#### 新規則（v2）

**每個 view 欄位必須是 UI 可達（accessible by user），但位置與形式不受限**：可以在 row、card、drawer、tooltip、詳情頁，由 `/feature-to-ui` 決定。

`.flow.md` 的 spec 必須涵蓋：

1. **主要識別欄位**（讓使用者識別這是哪筆資料）
   - 例：shower-code、station name、watch item
   - 用語意 locator 找實體：`getByRole('row', { name: /PER/ })`
2. **業務狀態欄位**（驅動 user behavior）
   - 例：已收藏 / 未收藏、進行中 / 已結束、連線中 / 已斷線
   - 用文字 / role 語意斷言
3. **代表性 metric 抽樣**（一兩個關鍵數值代表「資料有流到 UI」）
   - 例：speed = 130 找得到、station name 找得到
   - **不必驗每欄具體值**——單位/格式可能迭代（如 inch→cm、°→HH:mm、imperial→metric）

不在主 flow 寫的細節欄位，分兩種處理：

- **(a) 抽樣式概覽斷言**：在主 flow 寫「speed 130 出現於 sighting-001 範圍」一條代表
- **(b) 深度 sub-flow**：另起一個 `## Flow: 開啟 sighting detail / drawer` scenario，獨立驗證所有 metric 可達

---

#### 意圖 vs 斷言（invariant 寫哪一層）

Business Invariant 寫**業務意圖層**（使用者能做什麼、能識別什麼），不寫**實作斷言層**（哪個元素怎麼呈現）。斷言強度由 spec 層依意圖決定，flow 不預先鎖死呈現方式。

| | ❌ 斷言層（不進 flow） | ✅ 意圖層（進 flow） |
|---|---|---|
| 實體呈現 | 「賓客名**可見**」（spec 只能翻成 toBeVisible） | 「賓客實體**可被使用者識別**」（hover 浮現、tooltip、代號＋詳情皆滿足） |
| 欄位呈現 | 「每筆**顯示** name / username」 | 「每筆帳號可識別，name / username **可達**」 |
| 操作反饋 | 「toast **顯示**成功訊息」 | 「操作後使用者能**感知**成功（任一語意反饋）」 |

> 實例教訓（wedding-host，2026-07）：flow 凍結「賓客名可見」後，「花田頁不顯示賓客名」這個合理視覺決策被 invariant 卡死，最後只能用 opacity-0＋hover 硬過測。當初寫成「賓客可被識別」就不會發生。**判斷法**：如果一個合理的視覺重設計（隱藏、摺疊、hover 浮現、換頁呈現）會讓這條 invariant 紅燈，它就寫在錯的層。

---

#### 簡單範例（4 欄 list）

輸入：
```gherkin
Then the view returns:
  """
  [
    { "accountId": "acc-001", "name": "王思婷", "username": "observer_wang", "remark": "U12" },
    { "accountId": "acc-002", "name": "李文彥", "username": "observer_li", "remark": null }
  ]
  """
```

輸出（v2）：

```markdown
### E2E 驗證流程
1. 進入 `/accounts`
2. 期待：列表上能識別兩個帳號實體（不限 layout）

### Verification 策略
- `getByRole('row', { name: /王思婷/ })` 或 `getByText(/王思婷/)` 找實體
- entity 範圍內驗 username（`observer_wang`）與 remark（`U12`）可達
- 同樣驗 acc-002：李文彥 / observer_li / remark 為空（用 `:not(:has-text("U"))` 或省略 remark 斷言）

### Business Invariant 必涵蓋
- 兩筆帳號可被識別
- 每筆帳號的 name / username 可達
- 有 remark 者其 remark 可達
```

---

#### 多欄位範例（目擊事件 14 欄 — 抽象化重點）

輸入見 `gherkin-export.feature` 的 WatchSightinges view returns。

**舊風格（v1，已淘汰）**：14 條 testid 斷言全寫死，包含具體單位（°、cm、km/h）與具體數值（38、-15、2200）。後果：vibe 把 row 改 card / drawer，14 條全紅；vibe 改單位（imperial→metric），數值對不上。

**新風格（v2）**：

```markdown
### E2E 驗證流程
1. 進入 `/watch/watch-001`
2. 識別 sighting-001（shower-code = PER）與 sighting-002（shower-code = GEM）
3. 驗證收藏狀態：sighting-001 顯示「已收藏」、sighting-002 顯示「未收藏」

### Verification 策略
- `findEntity(/PER/)` / `findEntity(/GEM/)` 找目擊事件
- entity 內找 `getByRole('button', { name: /取消收藏/ })`（已收藏）或 `/^收藏/`（未收藏）
- 抽樣：能在 sighting-001 範圍內找到 speed `130`、station `陳小明`（代表資料流通）

### 完整 metric 驗證（sub-flow，可選）
另起 `## Flow: 開啟目擊事件詳情（happy-path）`：
1. 從目擊事件清單觸發「查看詳情」進入 detail / drawer
2. 驗證 detail 有可達的 metric 標籤：入射速度、光度、轉軸、效率、ssw、進壘角、垂直位移、水平位移、定位、影片連結
3. **不驗具體數值或單位**，只驗 label 與對應值能對到

### 不再凍結
- 14 欄是否全顯在 row（可移 drawer）
- 數值單位（mph / km/h / °/HH:mm / imperial / metric）
- video href 字面值
```

---

#### 影片 / 連結欄位

**仍是 invariant**：影片必須可被使用者開啟。

驗證寫法：
```markdown
- entity 範圍內能找到「查看影片」/「播放」等可觸發元素
- 或：能找到 `<a>` / `<video>` 元素且 href / src 不為空
```

**不驗 href 字面值**（vibe 可能換 CDN、加 query string、改 mock URL）。

---

#### View 多欄位的舊硬規則被取消的原因

舊規則「每欄一條 testid 斷言」存在的動機：防止 UI 漏實作（曾發生 14 欄只實作 1 欄）。

v2 用不同機制達成同樣目的：

| 目的 | 舊機制 | 新機制 |
|---|---|---|
| 防止 UI 漏欄位 | testid 每欄斷言 | sub-flow 開 detail / drawer 驗 label 可達 |
| 防止資料沒流到 UI | 每個欄位值斷言 | 主流抽樣（1-2 個代表性值）+ API spy 確保資料正確 |
| 防止 layout 假設 | 硬寫 row 結構 | 用 role 找實體，允許 row / card / drawer |

新機制少了「精確到每欄每值」的保護，**但這部分由「visual regression」或「manual QA」補**，不該由 E2E 扛——E2E 扛不動「14 欄 ×2 筆 × 各種單位變體」的維護負擔。

---

#### 反例對照

```markdown
❌ - `[data-testid="sighting-row-sighting-001-radiant-axis"]` 顯示「210」(°)
   ← 凍結了 row layout + 單位 + 具體值，vibe 三項都動就紅

✅ - 在 sighting-001 範圍內，radiant-axis 對應的數值或時鐘字串可被找到
   ← 描述 invariant，不鎖呈現

✅ - `[data-testid="sighting-row-sighting-001"]` 包含「PER」（shower-code 識別）
   ← 抽樣識別欄，OK
```

### 5. 處理 System / Translator Scenario

`.feature` 中由 `System` 或 `Translator` 觸發的 Scenario（例如「記錄目擊事件」、「註冊相機」、「更新相機狀態」）並非使用者直接操作。寫入 `.flow.md` 時：

- 仍保留為一個 `## Flow:` 區段（標註 `（背景同步）`）
- `### E2E 驗證流程` 改為「背景觸發條件」，列出觸發來源
- `### Verification 策略` 描述 UI 列表/狀態應如何反映變化（語意 locator ＋ API spy；testid 僅 fallback）

### 6. 加入檔頭與背景

每份 `.flow.md` 必須有：

- 一級標題 `# Flow: {module 中文名}`
- 檔頭引用 `> 對應規格：spec/gherkin-feature/{file-a}.feature, spec/gherkin-feature/{file-b}.feature`——**允許列多個來源檔**（逗號分隔）：整併多個逐 feature 檔時全數列出；來源是單一大檔（一檔含多個 `Feature:` 區塊）時列該檔即可
- 檔頭引用 `> 涵蓋頁面：/route-a, /route-b`——本模組涉及的所有 route
- `## Background` 區塊（共用前置條件，例如「已登入」、「測試帳號 admin」）
- `## Business Invariants` 區塊（合約核心，意圖層描述）
- 檔尾視需要加 `## Selector 策略` 與 `## Mock 假設`

> **這兩行檔頭是下游的結構化對應橋，不是裝飾**：`/test e2e spec` Step 2a 依 `對應規格` 定位來源 feature 與 Background、`/sdd-status` 依 `對應規格` ＋ `涵蓋頁面` 做模組 ↔ route-map 對應。漏列或省略會讓下游退回檔名／slug 猜測，造成對應判定缺漏（`auth↔login/register` 這類名字對不上的模組會被誤判成「缺」）。

> 完整骨架見 [flow-template.md](flow-template.md)

---

## 條件式跨切面關注點（偵測到才寫）

以下三類只在 feature 出現對應語意時才寫進 flow，平常不產：

### 即時連線

flow 含即時需求（即時 / 推播 / 通知 / live / 斷線重連）時，Business Invariants 段須捕捉「連線狀態對使用者可見」（連線中 / 已連線 / 已斷線）與「斷線重連後資料不遺漏」這兩條業務不變式（UX-agnostic：不指定用什麼元件呈現）。實作知識（傳輸選型、重連補抓、cleanup）由 `realtime` skill 提供，連線端點與信封型別由 feature-to-api Phase 0「Realtime 偵測」寫入 route-map。

### 影音串流（與即時連線不同）

與「連線狀態」不同，**影音播放的畫面呈現屬 UI / vibe 範疇，flow 不凍結它**——真實 flow 通常只以路由暗示直播頁（如 `/watch/live` 的「live」字），不寫「直播狀態可見」這類不變式（影片要不要顯示 LIVE / 無訊號 / 載入失敗，是 vibe 可自由迭代的呈現）。串流的合約在 OpenAPI 的播放 URL 端點（`/streams` → `hlsUrl`），由 feature-to-api Phase 0「Streaming 偵測」寫入 route-map；實作知識（播放器掛載、看門狗、延遲調校、多路對齊、teardown）由 `streaming` skill 提供。**flow 層不需為串流新增業務不變式**（對比：相機「連線中 / 已斷線」屬即時連線領域，那才是 flow 該捕捉的，見上一節）。

### 角色分層 / 授權

feature 含**不同角色看到 / 能做的事不一樣**（「以管理員登入」vs「以觀測員登入」清單或可操作不同、「僅…可」「無權限」語意）時，Business Invariants 須捕捉兩條 **UX-agnostic** 不變式：① 「{操作 / 資源} 僅 {role} 可達」；② 「無權角色被擋——看不到入口、或被導離、或操作被拒（任一語意反饋皆可）」。**不指定守門形式**（403 頁 / 導回首頁 / 入口隱藏由 vibe 決定）。角色名用 feature 實際出現的詞、不寫死。授權的合約（端點存取 / 列表 ACL / 單筆 object 歸屬（BOLA）/ 受保護路由）由 feature-to-api Phase 0「授權（RBAC）偵測」萃取進 `route-map.rbac`，實作範本見 [rbac-scaffold.md](../../feature-to-api/references/rbac-scaffold.md)；flow 只負責把「角色可見性」立成業務不變式（含「只能操作自己的」這類單筆歸屬語意），讓 spec 有依據產拒絕場景。

---

## 完成後

- 列出寫入的檔案路徑與大小
- 提示：「下一步：`/feature-to-api` 產出 API 合約與 Mock」
- 不要主動執行下一步指令
