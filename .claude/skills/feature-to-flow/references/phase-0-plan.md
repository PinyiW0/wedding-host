# Phase 0：解析 Feature、推導 module 分組、列計畫

## 目標

掃描 `spec/gherkin-feature/` 下所有 `.feature` 檔（包含 `.dsl.feature` 副檔名變體），依領域分組為 N 個 module，產出計畫表並等使用者確認，**不寫任何檔案**。

---

## 步驟

### 1. 掃描來源

讀取 `spec/gherkin-feature/` 下所有副檔名以 `.feature` 結尾的檔案（涵蓋 `*.feature` 與 `*.dsl.feature`）。建議用：

```bash
find spec/gherkin-feature -maxdepth 1 -type f -name '*.feature'
```

> 不要用 `ls spec/gherkin-feature/*.dsl.feature`，在 zsh 找不到時會報 `no matches found`。

切割成 `Feature:` 區塊（每個 `Feature:` 行起始一個區塊），抽取：

| 欄位 | 來源 |
|------|------|
| `featureName` | `Feature:` 之後的文字 |
| `description` | Feature 名稱下一行的描述 |
| `scenarios[]` | 每個 `Scenario:` 的標題、tags、Given/When/Then |
| `events[]` | 從 Given/Then 抽取的事件名稱（`AccountCreated`、`StationDeleted` 等） |
| `commands[]` | 從 When 抽取的命令名稱（`CreateAccount`、`Login` 等） |
| `views[]` | 從 When/Then 抽取的 view 名稱（`AccountList`、`WatchHistory` 等） |
| `viewFields{}` | 每個 view 的 `Then the view returns` 內陣列第一筆物件的 key 集合（用於計算欄位數，提醒 Phase 1 不要漏欄位） |
| `failureMessages[]` | `Then the operation fails with: ...` 的失敗訊息 |

### 2. 推導 module 分組（兩段式：capability 優先、aggregate 次要）

> **業界對齊**：Cucumber 官方調查與 BDD 主流（[Cucumber blog](https://cucumber.io/blog/bdd/solving-how-to-organise-feature-files/)、[andredesousa/gherkin-best-practices](https://github.com/andredesousa/gherkin-best-practices)）首選**按 capability / functional area 分組**，aggregate 為次要。理由：feature file 服務使用者場景（login vs. account management 是兩個不同使用者目的），aggregate boundary 多是 source code 的事。
>
> **歷史教訓**：曾將 `Feature: 登入`、`Feature: 修改密碼` 全塞進 `accounts`（理由是同 Account aggregate / `acc-001` stream）。結果 module 名與 URL 邊界不一致（`accounts` 卻涵蓋 `/login`）、語意搜尋失靈（找 login 測試要翻 `01-accounts.spec.ts`）。修法：用 capability layer 把 auth 切出來。

#### 2a. 先按 capability 分組（user-facing intent + actor）

| Capability 線索 | Actor 條件 | module |
|---|---|---|
| `Login` / `Logout` / `ObserverLoggedIn` / `Session*` / `2FA*` / 忘記密碼 / 密碼重設（self-service） | **Anonymous** 或使用者操作自己 | `auth` |
| `Password*` / `Remark*` / `Account*` CRUD | **管理者操作他人**（如 admin 為 observer 改密碼）| 走 2b aggregate 對照表（通常 `accounts`） |
| 通用 CRUD 操作主資料 | — | 走 2b aggregate 對照表 |
| 業務主流程 | — | 走 2b aggregate 對照表 |

> **Capability 規則勝過 aggregate 規則，但要看 actor**：
> - `Feature: 登入` 用 `When Anonymous sends Login` → actor 是 anonymous → 自助 auth → `auth`
> - `Feature: 修改密碼` 用 `When Observer sends ChangePassword`，且 UX 從 `/accounts` 進入 modal 改他人密碼 → admin-driven account management → `accounts`（不是 auth）
>
> **判斷流程**：先看 gherkin 的 `When {Actor} sends ...` 抽出 actor。Anonymous → 多半 auth；已登入 actor 操作自己（self-service）→ auth；已登入 actor 操作他人 → 該他人所屬 aggregate 的 module。

#### 2b. 再按 aggregate 前綴分組（capability 未命中時 fallback）

| 前綴 | module |
|------|--------|
| `Account*`（含 `Remark`，但不含已被 2a 抓走的 Login/Password） | `accounts` |
| `Site*` | `sites` |
| `Station*` | `stations` |
| `Watch*` / `Sighting*` / `Sightinger*` | `watch` |
| `Camera*` | `cameras` |
| `Export*` | `export` |

> **此前綴表是範例字典（取自某流星觀測專案），非通用白名單**：真正判準是「同一 aggregate 前綴 / 同一 URL 場景歸一個 module」。換領域（電商 `Order*`、CMS `Article*`）時依當前 `.feature` 即時歸納前綴，別套這張表的字面；前綴難歸時在計畫表「待確認」段問操作者。
>
> **就近原則**（取代舊版「主軸」措辭）：若 Feature 同時涉及多個前綴（如「觀測時段目擊事件清單」涉及 Watch + Sighting；「收藏單筆」純 Sighting），歸到**該 Feature 主要操作場景所在的 URL / 頁面**對應的 module（目擊事件清單、收藏皆在 `/watch/[id]` 頁面內，故歸 `watch`）。
>
> **未來擴展逃生口**：若新 Feature 的前綴不在表上、capability 也不在 2a，**停下來在計畫表的「待確認」段列出**，不要默默吃進最像的 module。

### 2.5 分配檔案編號（NN）

最終檔名格式為 `{NN}-{module}.flow.md`。

**新建（無既有 flow）：**
- 依 SDD 推進邏輯排序：認證 → 帳號 → 主資料 → 流程 → 周邊
- 預設順序：`00-auth` → `01-accounts` → `02-sites` → `03-stations` → `04-watch` → `05-cameras` → `06-export`
- 出現新 module 時，往後加編號（`00-` 編號保留給 auth；其餘新 module 使用最大編號 + 1）

**Sync（有既有 flow）：**
- 掃描 `spec/e2e-flows/` 取得既有 `{NN}-{module}.flow.md`
- 同名 module 保留原編號（**禁止重排**，下游 `/test e2e` 會以編號比對 spec）
- 新模組分配最大編號 + 1

### 3. 推導頁面路由

依 module 與 Feature 性質推導路由（用於 .flow.md 的「開啟 `/xxx`」步驟）：

| module | 主要頁面 |
|--------|----------|
| `auth` | `/login`（登入、修改密碼若走獨立頁可加入） |
| `accounts` | `/accounts`（列表 + 帳號 CRUD + 備註） |
| `sites` | `/sites` |
| `stations` | `/stations` |
| `watch` | `/watch/history`（歷史總覽）、`/watch/[watchId]`（目擊事件清單）、`/watch/live`（進行中） |
| `cameras` | `/cameras` |
| `export` | `/export` 或內嵌於 watch 頁的操作 |

> 路由僅為**建議**，使用者可在確認計畫時調整。最終以 `ui-config.yaml` 或專案 `pages/` 結構為準。

### 4. 分類 Feature 屬性

每個 Feature 區塊判斷主要型態：

| 型態 | 條件 | 對應 UI 操作 |
|------|------|-------------|
| **List/View** | When 出現 `view is queried` | 開啟列表頁、驗證表格內容 |
| **Command (Create)** | When 出現 `sends Create*` | 開啟對話框、填表單、提交 |
| **Command (Update)** | When 出現 `sends Update*` / `Change*` | 開啟編輯框、修改、提交 |
| **Command (Delete)** | When 出現 `sends Delete*` | 點刪除、確認對話框 |
| **Command (Action)** | When 出現 `sends Login` / `Start*` / `End*` / `Favorite*` 等 | 操作對應按鈕 |
| **System Event** | When `System sends` 或外部 translator | 不對應 UI 直接操作，標記為「背景同步」flow（見下方規則） |

> **System Event 處置規則**（避免不一致 silent drop）：
> - **有可觀察 UI 結果**（如「記錄目擊事件」會讓目擊事件清單多一筆）→ 產出 flow.md scenario，步驟用 `request.post(...)` 等模擬 system call，verification 驗證 UI 端的觀察結果，標記「背景同步 flow」
> - **完全無 UI 結果**（如純後端資料轉換 `traj → sighting fusion`，使用者完全感覺不到）→ **仍要在 flow.md 列出該 Feature 名稱與一句話說明，標註「無 UI 觀察點，本 flow 不產 scenario」**，避免後續維護者誤以為被遺漏
> - 不可預設 system event 一律 skip，也不可全部產出——按上述兩條判斷

### 4.5 角色分層偵測（條件式）

掃描各 Feature / Scenario，判斷是否有**不同角色看到 / 能做的事不一樣**的語意（利用步驟 1 已抽的 `actor` + scenario 內「僅…可」「無權限」「被拒」、或同資源不同 actor 結果不同）：

- **偵測到** → 在計畫表對應 module 的「備註」標 `⚠️ 角色分層`，並在「待確認」段列出研判的角色與受限端點，提醒 Phase 1 為該 module 寫**角色可見性不變式**（「僅 {role} 可達」「無權角色被擋」，UX-agnostic；見 [flow-template.md](flow-template.md) Business Invariants）。
- **沒偵測到** → 不寫角色不變式（中立預設）。

> 授權的**可執行合約**（端點存取 / 列表 ACL / 受保護路由的 403、過濾、守門）不在 flow 層落地——由 feature-to-api Phase 0「授權（RBAC）偵測」萃取進 `route-map.rbac`、實作見 rbac-scaffold.md。flow 只負責把「角色可見性」立成業務不變式，讓 `/test e2e spec` 有依據產拒絕場景。角色名用 feature 實際出現的詞、不寫死。

### 5. 輸出計畫表

以 markdown 表格回報給使用者，不寫入任何檔案。格式：

```markdown
## 📋 Feature-to-Flow 計畫

### 來源
- 掃描路徑：`spec/gherkin-feature/`（含 `*.feature` 與 `*.dsl.feature`）
- 共找到 X 份檔案，N 個 Feature 區塊，M 個 Scenario

### 建議分組（共 K 個 module → K 個 .flow.md）

#### `00-auth.flow.md`（路由：/login）
| Feature | Scenarios | 操作型態 | actor | 備註 |
|---------|-----------|---------|-------|------|
| 登入 | 成功登入、帳號不存在、帳號已刪除 | Command (Action) | Anonymous | capability=auth（self-service）|

#### `01-accounts.flow.md`（路由：/accounts）
| Feature | Scenarios | 操作型態 | actor | 備註 |
|---------|-----------|---------|-------|------|
| 帳號列表 | 顯示帳號列表、排除已刪除帳號 | List/View | Observer | view 4 欄（accountId, name, username, remark） |
| 建立帳號 | 成功建立、帳號名稱重複 | Command (Create) | Observer（admin）| |
| 修改密碼 | 成功、不存在、已刪除 | Command (Update) | Observer（admin 為他人改密）| admin-side，不算 auth |
| 修改備註 | 成功、不存在、已刪除 | Command (Update) | Observer（admin 為他人改備註）| |
| 刪除帳號 | 成功、不存在、已刪除 | Command (Delete) | Observer（admin）| |

> **view 欄位數**欄是給 Phase 1 的提示：欄位 ≥ 5 的 view 必須特別注意涵蓋策略——主要識別欄＋業務狀態欄必驗，細節 metric 走抽樣或 detail sub-flow（見 [phase-1-write.md](phase-1-write.md) 第 4 段），**不是逐欄產 testid**。歷史教訓：04-watch 曾經 14 欄只實作 1 欄，v2 由 sub-flow 的 label 可達斷言防漏。

#### `03-stations.flow.md`（路由：/stations）
...

### 寫入計畫
- ✅ 新建：00-auth.flow.md, 01-accounts.flow.md, 02-sites.flow.md, 03-stations.flow.md, ...
- ⚠️ 覆寫：（若 spec/e2e-flows/ 已存在同編號檔案）
- 🔢 編號分配：Sync 模式保留既有編號，新模組往後遞增

### 待確認
1. module 分組是否合理？
2. 路由是否符合預期（或由我推導即可）？
3. 是否有 Feature 應該排除（例如純 System 事件不需要 UI flow）？

回覆「OK」或調整後，執行 `/feature-to-flow 1` 進入寫檔階段。
```

---

## 規則

- **Phase 0 只讀不寫**：不能建立或修改 `spec/e2e-flows/` 內任何檔案
- 計畫輸出後必須停下來等使用者回覆，不要自動進入 Phase 1
- 若使用者帶參數 `accounts`，只列出 `accounts` module 的計畫
- 計畫表內 Feature 與 Scenario 名稱必須與原 .feature 完全一致（含繁中），方便比對
