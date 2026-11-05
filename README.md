# EverAfter — 婚禮管理系統

> 一人 full-stack 打造的婚禮 SaaS：從籌備期的賓客名單、桌次排席、RSVP 邀請、喜餅與小物，到宴客當天的流程分工、接待報到、祝福投影牆，再到婚後的謝卡群發——一站式管理。

**線上站**：<https://everafter-iota.vercel.app>（正式環境需登入；賓客頁由簽名連結進入）｜**想動手玩**：clone 後 `npm run dev` 零設定啟動完整系統（見[本機啟動](#本機啟動)）

<!-- 產品短片：影片檔不進 repo，放在 GitHub 附件（issue #204 的留言）。網址要獨立一行，GitHub 才會顯示成播放器 -->
https://github.com/user-attachments/assets/bf47cdb9-686b-4d4d-a0f8-cb053ae0339b

*50 秒看完一場婚禮的三個階段：籌備（賓客名單、回覆、桌次、喜餅與小物）→ 當天（流程分工、接待報到）→ 婚後（電子謝卡）。畫面全部是本機示範資料。配樂由 MusicGen（`facebook/musicgen-small`）生成，權重授權 CC BY-NC 4.0，僅供非商業展示。*

## 專案亮點

- **一人開發與維護的完整產品**：119 支 API、26 張資料表、19 個功能模組、4 種 UI 端，已部署上線（Vercel + Neon + Cloudflare R2）
- **規格驅動開發（SDD）**：程式碼由 Gherkin 業務規格逐層生成，E2E 測試是凍結合約——375 條 Playwright 測試（83 檔）守住業務不變量，UI 可以放心重構
- **賓客免登入體驗**：HMAC-SHA256 簽名連結（婚禮層級 / 賓客專屬兩種格式），賓客點連結即可回覆出席、寫祝福、看謝卡，無需帳號
- **零設定啟動**：所有外部依賴（DB、圖片儲存、LINE、監控）都有本機退路，`npm install && npm run dev` 就能跑起完整系統
- **雙模式授權**：`enforced`（正式環境，JWT + 簽名驗證）與 `open`（開發 / E2E，自動退回預設身分）同一套 middleware 切換，測試不必造假登入流程

## 操作演示

以下素材由 `npm run capture:demo` 以本機示範資料錄製，人名皆為虛構。

### 籌備

**連結中心**——每位賓客一組專屬短網址與 QR code，回覆、祝福、報到、謝卡四條連結一次備齊，複製或出示給賓客掃描：

![連結中心演示：點賓客的「連結」，側欄列出四條專屬短網址與 QR code](docs/demo/links.gif)

**賓客回喜帖**——免登入簽名連結進入，填寫出席資訊並親手畫一朵小花，種進新人的祝福花田：

<img src="docs/demo/rsvp.gif" width="390" alt="賓客 RSVP 演示：填寫出席資訊與手繪小花">

**桌次排席**——以圓桌呈現現場佈局，賓客從名單點選或拖曳入座；「推薦排序」依主桌帶入新人與雙親、男左女右、長輩近主桌的禮俗自動帶位：

![桌次排席演示——手動入座與推薦排序自動帶位](docs/demo/seating.gif)

排好之後可下載給餐廳的備餐地圖與賓客名單；賓客名單除了 JPEG／PDF，也能下載 Excel（兩個工作表：名單、桌位圖）：

| 下載選單 | 備餐地圖 |
|---|---|
| <img src="docs/screenshots/seating-download.png" width="460" alt="下載桌次圖的選單：備餐地圖 JPEG／PDF，賓客名單 JPEG／PDF／Excel"> | <img src="docs/screenshots/seating-chart.jpg" width="300" alt="下載的備餐地圖：每桌葷素份數與兒童椅數"> |

**喜餅與婚禮小物**——喜餅依賓客分類一次帶入款式，各款盒數與金額自動統計；婚禮小物分類管理、採購總額一眼看完：

![喜餅與婚禮小物演示：依分類帶入喜餅款式，再看小物採購總額](docs/demo/cakebox.gif)

### 當天

**當天流程**——以矩陣表安排每個時段與各角色的分工；每個角色有自己的連結，工作人員打開只看到自己的待辦與要帶的物品：

![當天流程演示：矩陣表與複製角色專屬連結](docs/demo/rundown.gif)

<img src="docs/demo/rundown-role.gif" width="390" alt="角色專屬頁演示（行動版）：新秘只看到自己的時段、待辦與物品">

**接待報到**——搜尋賓客、報到帶位、登記禮金，禮金彙總即時更新：

![接待報到演示：搜尋賓客、報到、登記禮金、打開禮金彙總](docs/demo/reception.gif)

**祝福審核與投影牆**——後台逐則通過賓客祝福，宴會現場投影牆即時以跑馬燈呈現：

![祝福審核與投影牆演示](docs/demo/projection.gif)

### 婚後

**電子謝卡**——賓客點開專屬信封，謝卡自信封口升起展開，行動版與桌面版皆支援：

<img src="docs/demo/thankyou.gif" width="390" alt="謝卡公開頁演示（行動版）：點信封開封、謝卡展開">

![謝卡公開頁演示（桌面版）](docs/demo/thankyou-web.gif)

## 產品導覽

| 後台總覽 | 賓客名單 |
|---|---|
| ![婚禮總覽](docs/screenshots/dashboard.png) | ![賓客名單](docs/screenshots/guests.png) |

| 當天流程 | 喜餅規劃 |
|---|---|
| ![當天流程矩陣表](docs/screenshots/rundown.png) | ![喜餅規劃](docs/screenshots/cake-box.png) |

| 祝福審核 | 投影牆（宴會現場即時跑馬燈） |
|---|---|
| ![投影祝福審核](docs/screenshots/blessings.png) | ![投影牆](docs/screenshots/projection.png) |

賓客側為行動優先的免登入公開頁：

| 喜帖 RSVP | 祝福花田 |
|---|---|
| <img src="docs/screenshots/rsvp-mobile.png" width="390" alt="賓客 RSVP 回覆頁"> | <img src="docs/screenshots/flowers-mobile.png" width="390" alt="祝福花田"> |

*每位賓客回覆喜帖時親手畫一朵花，慢慢種成整片花田——婚禮結束後成為新人的紀念。*

### 功能地圖

| 階段 | 功能 |
|------|------|
| 籌備 | 賓客名單（分類、每位賓客的專屬短網址與 QR code）、桌次排席（拖曳 + 禮俗檢查 + 推薦排序；備餐地圖與賓客名單可下載 JPEG／PDF／Excel）、RSVP 表單設計與外觀客製、喜餅規劃（依分類帶入、訂購統計）、婚禮小物（分類與採購總額）、LINE 邀請與綁定 |
| 當天 | 當天流程（角色分工矩陣、角色專屬連結、賓客版時程）、接待報到台（獨立接待員帳號）、禮金登記與彙總、喜餅發放、祝福審核、投影牆即時跑馬燈 |
| 婚後 | 電子謝卡（範本 + 個別客製 + LINE multicast 群發）、祝福花田紀念頁 |
| 營運 | 多婚禮管理、角色權限（管理者 / 新人 / 接待員 / 賓客）、帳號管理 |

## 架構

Nuxt 4 單體：Vue 3 前端與 Nitro API 同一應用、同一次部署。`weddingId` 是全域分片鍵，同時是資料分區與授權邊界。

```
        管理者 / 新人 / 接待員                賓客（免登入，HMAC 簽名連結）
              │ JWT Bearer                        │ ?sig= → X-Guest-Sig
              ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nuxt 4 應用（Vercel SSR）                     │
│  app/（Vue 3 + NuxtUI）          server/（Nitro）                │
│  ├─ pages/    後台·接待·公開·投影  ├─ middleware/auth.ts  統一授權  │
│  ├─ api/      client API 包裝層   ├─ api/v1/**  route handler    │
│  ├─ types/api API 合約型別        └─ db/ Drizzle schema（26 表）  │
│  └─ stores/   auth（persisted）                                  │
└──────────┬──────────────┬──────────────┬──────────────┬─────────┘
           ▼              ▼              ▼              ▼
     PostgreSQL      Cloudflare R2    LINE 平台         Sentry
     （Neon／本機）   （presigned 直傳） （謝卡群發＋OAuth）（錯誤監控）
```

刻意的取捨（詳見 [docs/architecture.md](docs/architecture.md)）：

- **務實派 CRUD 而非分層架構**：route handler 直接操作 DB、普遍 20–50 行，橫切關注點（認證、授權）全數上移 middleware——一人專案把複雜度花在刀口上
- **型別即合約**：`app/types/api/` 是前後端共用的唯一合約來源，元件內禁止定義 local interface
- **賓客簽名不設過期**：謝卡等連結需婚後長期有效，要全面失效就輪換 secret

## 工程實踐

**SDD 流程**——程式碼由規格驅動生成，`spec/` 是上游真相：

```
spec/gherkin-feature/*.feature（業務規格）
        ↓ /feature-to-flow
spec/e2e-flows/*.flow.md（Business Invariants = 業務合約）
        ↓ /feature-to-api          ↓ /test e2e spec
app/types/api + server/api    test/e2e/specs/*.spec.ts（凍結）
        ↓ /feature-to-ui
app/pages（為通過 spec 而建）
```

**測試守門**：

- 主 spec（`test/e2e/specs/`）是凍結合約不得修改；vibe spec（`test/e2e/vibe/`）保護 UI 迭代
- 測試分四級：pre-push 只跑煙霧（`00-auth`、`00-hydration`）；`/vibe-check` 預設只跑煙霧＋受影響的 spec；發 PR 前 `/vibe-check --full` 跑 dev 全量；PR 上的 CI 以 production build＋一次性 Postgres 跑全量（4 shard 平行）
- 紅燈依路徑分流：`specs/` 紅 = 破壞業務合約（修程式），`vibe/` 紅 = UI 改動需決策
- commitlint（Conventional Commits）+ ESLint + 自製視覺層級檢查（一頁一主焦點的設計規範，用腳本守住）

**GitHub 流程**：issue 綁 linked 分支（`feature/#N-描述`）→ PR 自動 `Closes #N` → Squash merge。

## 本機啟動

```bash
npm install
npm run dev   # 自動拉起 Docker Postgres、migrate + seed，零設定
```

啟動後以示範帳號 `couple`（密碼 `couple1122`）登入，即以「新人」視角操作示範婚禮。

種子資料為了 E2E 測試刻意精簡（19 組賓客、流程表 1 列）。想看上面演示裡那場「賓客上百人」的婚禮，dev server 啟動後再跑：

```bash
node scripts/demo-data.mjs base        # 補賓客與回覆、喜餅、小物、當天流程、謝卡（不排桌，留給你按「推薦排序」）
node scripts/demo-data.mjs reception   # 排完桌之後：補報到與禮金
```

環境需求：Node.js 26.13.0（以 `.nvmrc` 為準，先 `nvm use` 再 `npm install`：Node 22 內建的 npm 10 在這個依賴樹會崩潰）、Docker。Node 版本寫在 `.nvmrc`、Dockerfile `ARG NODE_VERSION`、package.json `engines`（寫 `^版本`，不寫 `>=`：正式站跑在 Vercel，Vercel 依 `engines` 挑範圍內最新的支援版，`>=` 會在 Vercel 支援新 major 時自動跳版）三處，升版時三處一起改，不一致時 `npm run test:unit` 會失敗。環境變數清單見 [docs/architecture.md](docs/architecture.md) §8（全部可留空，未設定時自動退回本機相容行為）。

### 常用指令

| 指令 | 用途 |
|------|------|
| `npm run dev` | 啟動開發伺服器（含本機 DB） |
| `npm run build` / `npm run preview` | SSR 打包／預覽 |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle migration 與資料瀏覽 |
| `npm run db:create-admin` | 建立正式環境首位管理員 |
| `npm run eslint` / `npm run typelint` | Lint（含視覺層級檢查）／型別檢查 |
| `npm run test:unit` / `npm run test:e2e` | Vitest／Playwright 主 spec |
| `npx playwright test --config playwright.gate.config.ts` | 守門全量（主 spec + vibe spec；pre-push 只跑其中的煙霧 spec） |
| `sh scripts/docker-gate.sh` | 本機跑 production build 全量（一次性 Postgres，不碰本機資料） |
| `npm run capture:demo` | 重錄本檔的 GIF 與截圖（先啟動 dev server；會把本機 DB 重置成示範資料） |

## 專案結構

```
app/                  # 前端（Vue 3 + NuxtUI）
├── api/              # per-domain client API 包裝層
├── components/       # 元件（common/ 為跨頁原子元件）
├── pages/            # 頁面路由（後台、公開頁、接待台、投影牆）
├── stores/           # Pinia store（僅 auth）
└── types/api/        # API 合約型別（型別即合約）
server/               # 後端（Nitro）
├── api/v1/           # route handler（務實派 CRUD）
├── db/               # Drizzle schema、migrations、seed
├── middleware/       # 統一認證授權
└── utils/            # JWT、賓客簽名連結、LINE、R2 等
spec/                 # SDD 規格（上游真相）
test/e2e/             # specs/（凍結合約）+ vibe/（UI 保護網）
```

## 技術棧

Nuxt 4（Vue 3 Composition API + NuxtUI 4 + Nitro）｜TypeScript strict｜Tailwind CSS 4｜PostgreSQL + Drizzle ORM｜Pinia｜Playwright + Vitest｜Vercel + Neon + Cloudflare R2 + LINE Messaging API + Sentry

## 文件

| 文件 | 內容 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | 系統架構總覽（以程式碼為準） |
| [docs/ops.md](docs/ops.md) | 營運手冊：監控、密碼救援、故障排查 |
| [docs/production-readiness.md](docs/production-readiness.md) | 產品化評估與 roadmap |
| [doc/frontend/frontend-workflow.md](doc/frontend/frontend-workflow.md) | SDD 開發流程 |
