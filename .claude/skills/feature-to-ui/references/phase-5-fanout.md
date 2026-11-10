# Phase 5 模組級扇出

> **上位規範**：本檔講「怎麼扇出」，不判斷扇出算不算獨立驗證——那條界線見 [ops/model-dispatch.md](../../../ops/model-dispatch.md) 第 6 節「與並行無關」註記：worktree 扇出買的是 wall-clock，不是驗證意義上的獨立性。停下來問的判準一律回 [decision-tiers.md](decision-tiers.md) 與 [ops/judgment-rubrics.md](../../../ops/judgment-rubrics.md) 第 3 節，本檔不重列。

## 一、規模開關（可判定）

讀 `spec/report/route-map.yaml`，數 `routes[]` 陣列的筆數：

- **≤ 10** → 循序。沿用 Phase 5 既有流程（一次一頁、每頁完成後停下等確認），不套本檔
- **> 10** → 扇出。套用本檔流程

判定時機：Phase 4 完成、Phase 5 開工前判一次即可，不必等做到一半才改路線。

## 二、切面＝模組，不是頁面

扇出的切分單位是**模組**，不是頁面——頁面數再多，同模組的頁面也只派給同一個分身。

模組判定（依 `route-map.yaml` 可執行，不靠語意猜測）：

1. 走訪 `routes[]`，任兩個 route **共用至少一個 `features[].file`** 即視為同模組——只用這一個條件。`store` 欄位相同**不算**：`store: auth` 這類跨切面共用 store 會把全站不相關的頁面連成同一個模組，扇出等於沒扇出
2. 用連通分量（connected components）把整份 `routes[]` 分群，每群即一個模組
3. 模組頁數 = 該群組內 route 數量

**孿生頁規則**：共用同一套領域邏輯的成對頁面（例如同一個實體的兩個操作台頁面），連通分量演算法多半會因為共用 `features[].file` 而自動分進同一群。若分群結果把明顯共用邏輯的孿生頁拆散了（例如兩頁共用同一個 store 但剛好沒有共同的 feature 檔），人工合併成同一模組——演算法是預設判法，不是天條，發現分錯就手動修正，不要硬套。

## 三、隔離：git worktree

**不要**讓兩個分身在同一個目錄跑。原因：

- **本專案例外**：E2E 資料在共用的 Postgres（docker compose 的 `wedding-host-db`，port 5433），不在 dev server 記憶體裡。不同 worktree 換了 port 仍共用同一個資料庫，**同時**跑 spec 會互相清掉對方的資料（`playwright.config.ts` 開頭「已知限制」）。分身之間看不到彼此、沒有鎖，`scripts/docker-gate.sh` 又只能整包跑 gate，所以本專案扇出改成**依序派工**：一次只派一個模組分身，它回報後才派下一個；worktree 與分支隔離照舊保留。跑 spec 要把 `COMPOSE_PROJECT_NAME=wedding-host` 寫在同一條指令前面（寫法見下方派工指示）。下面幾點是模板（記憶體 mock）的原文
- 模板的 mock 資料是單一 dev server process 內的記憶體狀態，每個 spec 用 `test.beforeEach` 呼叫 `/api/__test__/reset` 重設（見 [test/e2e/references/setup.md](../../test/e2e/references/setup.md) 的 Step 4「建立 Mock Data Reset Endpoint」與 `resetMockData()` helper 實作；不寫死行號）
- 兩個分身共用同一個 dev server（同目錄、同 port）時，一個分身的 `beforeEach` reset 會把另一個分身跑到一半的測試資料清空，兩邊互打
- `playwright.config.ts:7-17` 的 port 是用 **worktree 根目錄路徑**做 hash 算出來的（3100–3499）——不同 worktree 天生拿到不同 port、跑各自的 dev server，資料互不影響（本專案只隔離 dev server、不隔離資料庫，見上方本專案例外）；這正是 [.claude/CLAUDE.md「本機開發 gotchas」](../../../CLAUDE.md)「E2E port 依 worktree 路徑 hash 推導」那條的機制
- **殘餘風險**：hash 碰撞機率約 1/400（md5 前兩 byte 對映到 400 個 port）。dev server 起不來或 port 被佔用時視為異常——回報主線、換一個 worktree 目錄名重建，不要默默失敗或硬等

**做法**：每個分身用 Agent tool 派工時帶 `isolation: "worktree"`。本 skill 跑在 fork 分身裡，由這個分身再派模組分身——2026-11-04 實測 general-purpose 分身可以呼叫 Agent tool；巢狀層的 `isolation: "worktree"` 未實測，第一個模組分身回報後，先確認它的 worktree 路徑與主線不同，不同才派其餘模組。這個參數會自動建立一份獨立 git worktree 副本給該分身工作，完成後把 worktree 路徑與分支名回傳（沒有改動則自動清掉，不留垃圾 worktree）。不必手動 `git worktree add`——那是 README 給「人開多個 CLI session」用的手動流程，Agent 扇出時用工具原生參數即可達到同樣的隔離效果。

## 四、前提順序

兩項全滿足才扇出，缺一項就退回第一節的循序：

1. **Phase 1–4 地基完成且已 commit**（layout、共用元件、路由骨架皆已就緒——地基是所有頁面的依賴，本質循序，不可扇出）。`git status --porcelain` 要是空的：`isolation: "worktree"` 從已 commit 的版本開副本，沒 commit 的地基分身拿不到
2. **沒有待處理的 sync 刪除**：`sync-report.md` 有刪除項目時，先由主線依 [phase-5-pages.md](phase-5-pages.md) 的增量刪除流程循序做完（那個流程會改 `route-map.yaml`），再扇出。扇出不處理 sync 刪除

## 五、交辦：每個分身一個 Agent 呼叫

**確認點的仲裁**：Phase 5 原規則「一次只做一個頁面，完成後停下等使用者確認」（見 [phase-5-pages.md](phase-5-pages.md)）在扇出模式下失效——模組分身沒有管道向使用者提問，逐頁停下會卡死整個模組。扇出模式下：**模組分身不逐頁停下等確認**，改成「該模組全部頁面的 spec 皆綠 ＋ 模組級回報（含每頁的一句對照表：頁面、spec 結果、關鍵取捨）」。指揮官（跑本 skill 的分身）同樣沒有提問管道，所以確認拆成兩段：第一段派工、收回報、寫進匯流清單後結束；使用者看完清單，再叫 `/feature-to-ui 5 --merge` 做第二段 merge（見第六節）。確認點從「頁」升到「模組」，不是取消確認。

- **model**：`sonnet`（依 [ops/model-dispatch.md](../../../ops/model-dispatch.md) 第 3 節，實作類任務 sonnet 足夠）
- **isolation**：`"worktree"`（見第三節）
- **prompt**：依 [ops/delegation-templates.md](../../../ops/delegation-templates.md) 範本 2（實作），在驗收條件額外加一條：**「每頁做完立刻跑該頁對應的 spec 到綠，才算完成該頁，才可以動下一頁」**——這一條是 Phase 5 扇出版的核心規則，紅燈成因還在分身的短期記憶裡，當場修比事後靠別人考古便宜

範本套用範例（模組名、頁面清單、spec 路徑依實際 route-map.yaml 填入）：

```
第一步：worktree 建立後先跑 `npm install`（node_modules 與 .nuxt 不進 git，每個 worktree 要各自安裝），裝完才開始下面的任務。
（本專案）跑 spec 一律把變數寫在同一條指令前面：`COMPOSE_PROJECT_NAME=wedding-host npx playwright test <spec>`。`npx playwright test` 會經 `npm run dev` 的 predev 起 docker compose，沒設會在新 worktree 撞同名容器；每次呼叫 Bash 都是新的 shell，另一條指令先 `export` 不會保留。E2E 資料庫各模組共用（port 5433），本專案依序派工，你跑 spec 時不會有其他模組分身同時在跑。

任務：在 <模組內的 pages 清單> 實作 Phase 5 功能。
動機：Phase 5 模組級扇出，本模組與其他模組互不依賴，可各自在獨立 worktree 做（本專案依序派工，見第三節本專案例外）；不平行的部分（Phase 1-4 地基）已完成。
規格：<模組內每個頁面對應的 test/e2e/specs/{NN}-{name}.spec.ts>，依 phase-5-pages.md 的必讀規範清單逐頁實作。
遵循：decision-tiers.md 三級表；ops/judgment-rubrics.md 第 3 節；rules.md [P5] 段；.claude/rules/frontend-security.md、.claude/rules/ui-conventions.md、.claude/rules/vibe-ui.md、.claude/rules/framework-skills.md（分身內 paths 規則不注入，必須主動讀）；page-builder.md；spec/report/contract-facts.md（Step 0 合約事實：envelope 形狀、ID pattern、登入方式、種子總表、testid 慣例來源，直接引用不重查）。
禁止：修改凍結區；新增跨模組共用檔（見 decision-tiers.md 第三級，命中就停手、在回報列出用途與影響範圍）；假設其他模組已完成；逐頁停下等確認（見上方「確認點的仲裁」，改成模組級回報）。
驗收條件：每頁做完立刻跑該頁對應 spec 到綠才算完成該頁，完成後不停下、直接做下一頁；模組內所有頁面做完後，`npm run eslint` 與 `npm run typelint` 全綠，且跑一次涵蓋本模組全部 spec 的指令（npx playwright test <本模組 spec 清單>）全綠後，把本模組全部改動 commit 到本 worktree 的分支，`git status --porcelain` 輸出為空才回報（匯流時主線會 `git worktree remove`，有未提交改動會被拒）。
回報格式：改了哪些檔（檔案:行號）、每頁一列的對照表（頁面、spec 結果、關鍵取捨；沒有取捨就寫「無」，會原樣寫進匯流清單給使用者看）、worktree 路徑與分支名、最後一個 commit 的 sha 與 `git status --porcelain` 為空的確認（供匯流步驟使用）。
產物超過 30 行時寫到 <主線 repo 絕對路徑>/.claude/tmp/feature-to-ui/module-<模組名>.md，回報只附路徑。
```

（共通回報尾段見 [ops/delegation-templates.md](../../../ops/delegation-templates.md) 開頭「共通尾段」，逐字貼進每個分身的 prompt；其中「<指定路徑>」填上面那個 `module-<模組名>.md` 路徑。路徑寫主線 repo 的路徑，不寫進 worktree——worktree 會在匯流時移除。）

## 六、匯流（兩段式）

### 第一段：寫匯流清單後結束（本次 `/feature-to-ui 5` 呼叫的最後一步）

1. 收集每個分身回報的 worktree 路徑、分支名與 commit sha（交辦已要求分身先 commit）
2. **寫匯流清單** `.claude/tmp/feature-to-ui/fanout-<YYYY-MM-DD>.md`（主線 repo 內；同日已存在就加 `-2`、`-3`）。每個模組一段：模組名、頁面對照表（頁面、spec 結果、關鍵取捨）、worktree 路徑、分支名、commit sha。清單開頭另記合併目標：主線分支名（`git branch --show-current`；輸出為空代表 detached HEAD，停下回報、不寫清單）。不 merge，回報清單路徑後結束，結尾提示：「看完清單後執行 `/feature-to-ui 5 --merge`；要否決某些模組就在後面列出模組名，例如 `/feature-to-ui 5 --merge 否決 billing`」

分身的 commit 只落在它自己的分支，還沒進主線，所以使用者這時否決沒有回滾成本。

### 第二段：`/feature-to-ui 5 --merge`

讀最新的一份匯流清單 `fanout-<YYYY-MM-DD>*.md`（先比日期；同一天取 `-N` 數字最大的，沒有後綴的算第 1 份；不要照檔名排序，`-2.md` 會排在 `.md` 前面），先看 `git status`：有 rebase 進行中（上次衝突停下）就停下回報。再驗合併目標：`git branch --show-current` 要等於清單記的主線分支名，不同或為空就停下回報、請使用者切回去，不 merge。再依使用者這次呼叫帶的參數決定每個模組：

- 沒被列為否決的模組 → 進第 3 步 merge
- 否決的模組 → **不 merge、不刪**：worktree 與分支原樣保留，要改幾頁再 merge、還是整條 `git branch -D` 丟掉，由使用者決定。不要替使用者刪，整個模組重做比修幾頁貴得多

3. 主線（commander 所在分支）**逐一**處理每個核准的分身分支，一次一個，在**主線 worktree**執行。先移除該分身的 worktree——分支還被那邊 checkout 著時，主線 `git checkout` 會被拒（branch already used by worktree）：
   ```bash
   git worktree remove <分身 worktree 路徑>   # 有未 commit 改動會被拒；被拒代表分身沒照交辦 commit，停下回報
   git checkout <分身分支>
   git rebase <主線分支>
   git checkout <主線分支>
   git merge --ff-only <分身分支>
   ```
   續跑前先看 `git status`：有 rebase 進行中（上次衝突停下）就停下回報，不續跑；分支已不存在（`git rev-parse --verify <分身分支>` 失敗，例如使用者已 `git branch -D`）就跳過並在回報列出。分身分支已是主線的祖先（`git merge-base --is-ancestor <分身分支> <主線分支>` 成功，代表上次 `--merge` 已合併過）→ 跳過這個模組，不再執行上面的指令；worktree 已不存在、分支卻還沒合併時，跳過 `git worktree remove` 從 `git checkout` 繼續。
   rebase 有衝突就停下回報，不自動解；確認這個分身乾淨合併後才處理下一個分身的分支——不要一次把所有分身的分支都合完再排錯，衝突會疊加，分不清是哪個分身造成的
4. 全部合併完，跑一次全量（`npm run test:e2e`，見 README.md 指令表），確認跨模組沒有互相影響。有模組被否決時，它的頁面沒有進主線，它的 spec 在全量裡必紅——那不是跨模組互撞：紅燈只追核准模組的 spec，否決模組的紅燈列出清單、不修，回報時一併說明
5. `spec/report/route-map.yaml` 在扇出時只讀不寫（sync 刪除會改它，但第四節已規定刪除在扇出前由主線做完）。若合併時真的在這份檔案上出現衝突，視為異常訊號：停止 merge、在回報列出衝突，不要猜著解
