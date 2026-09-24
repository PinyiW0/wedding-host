---
name: vibe-check
description: Gate 守門 — 跑 playwright.gate.config.ts（主 spec + vibe spec）確認綠燈。預設定向（白名單內的改動只跑煙霧＋受影響 spec），`--full` 跑 dev 全量。紅燈時依路徑分流：specs/ 對照 flow.md invariant、vibe/ 明確告知使用者決定。Use when vibe 完想驗證業務合約與既有 vibe 行為沒踩線，或發 PR 前要跑 dev 全量（--full）。
---

# Vibe Check — Gate 守門（v5：分級）

## 目的

**只做一件事**：跑 gate spec（主 spec `test/e2e/specs/` + vibe spec `test/e2e/vibe/`，排除 `vibe/unstable/`），確認 vibe 後業務合約與既有 vibe 層行為沒被破壞。

**不做**：UI 分層、vibe spec 產生、vibe spec 修改（這些由 `/vibe-setup` 與 `/vibe-e2e` 負責）。

主 spec 是 SSOT（Single Source of Truth），凍結，不可被任何 vibe 流程修改。vibe spec 不凍結（可由 `/vibe-e2e` 重生或使用者決定刪改），但 **/vibe-check 本身只報告、永遠不動它**。

## 分級（本檔是分級判準的 SSOT，其他 skill／rules 只引用不重列）

| 級 | 跑什麼 | 誰跑 |
|---|---|---|
| 煙霧 | `.husky/pre-push` 的 `SMOKE_PATTERN` 那一行（本專案 `specs/(00-auth\|00-hydration)`：管理員註冊＋逐 route 整頁載入） | `.husky/pre-push`；本檔預設模式一定帶 |
| 定向 | 煙霧 ＋ 受影響的 spec（Step 2 三來源查法） | 本檔預設模式（白名單內）、`/verify-ac` 修正輪 |
| dev 全量 | gate config 全部，本機 dev server | 本檔 `--full`（發 PR 前跑一次） |
| production 全量 | gate config 全部，production build | CI `pull_request.yml` 的 `e2e` job（build 一次、4 shard 平行跑）；本機選配 `sh scripts/docker-gate.sh`（一次性 Postgres，不碰本機 5433） |

**鐵律：只有整份 diff 都落在白名單內才定向，其餘一律全量。** 白名單 ＝ 本次 diff（merge-base 起、含未追蹤、濾掉 pre-push `SKIP_PATTERN`）**全部**落在 `app/pages/**`、`test/e2e/vibe/**`、`test/e2e/specs/**`，以及**模組專屬元件** `app/components/<seg>/**`（`app/pages/<seg>/` 目錄存在才算；本專案實測 53% 的 commit 只影響單一模組）。碰到任何其他檔（頂層或非模組目錄的 `app/components`、`server/`、layouts、composables、stores、helpers、config…）就是全量。AI 不判斷「要不要定向」，只查「白名單內的頁對哪幾支 spec」。

**定向綠只代表選集，不算 gate 已驗**。commit 前跑定向即可；dev 全量由發 PR 前的 `/vibe-check --full` 跑一次，production 全量由 CI 跑。dev 全量與 production 全量不互相取代（hydration 警告只在 dev build 會印，`00-hydration` 在 production 驗不到這一項）。

## 何時用

- 每次 vibe UI 完，**第一步**先跑這個（預設模式，一兩分鐘）
- gate 綠燈才有資格往 `/vibe-setup`、`/vibe-e2e` 推進
- 發 PR 前、或想單獨確認全量守門狀態 → `--full`（≈ CI 會不會過，dev／prod 差異見上表）

## 使用方式

```bash
/vibe-check                       # 預設：白名單內 → 煙霧＋定向；白名單外 → dev 全量
/vibe-check --full                # dev 全量（發 PR 前跑這個）
/vibe-check test/e2e/specs/07-xxx.spec.ts   # 額外指定 spec，併入定向選集
```

---

## 絕對禁止（SSOT 政策）

以下永遠不可在 /vibe-check 過程中發生：

- 不可修改 `test/e2e/specs/` 內任何檔案
- 不可修改 `test/e2e/vibe/` 內任何檔案（vibe 層雖不凍結，但刪改是使用者的決定，不是 /vibe-check 的）
- 不可修改 `spec/gherkin-feature/`、`spec/e2e-flows/`
- 不可修改 `playwright.config.ts`、`playwright.gate.config.ts`
- 不可主動修 `app/` 程式碼（即使能修好違規也不行）
- 不可主動 commit / push
- **失敗時不可建議「改 spec 來配合 vibe」這類解法**，要建議「還原 vibe 改動」或「調整 vibe 讓它仍滿足業務 invariant」
- **不可把定向綠報成「gate 已驗」**，報告首行必須標明範圍

如果發現非破壞合約無法達成 vibe 目標，**停下來告訴使用者**，不要擅自處理。

---

## 流程

### Step 0：前置檢查（有沒有測試檔）

Playwright 對「No tests found」回非 0，空模板直接跑裸指令會拿到 exit 1，但沒有任何可分流的失敗 spec：

```bash
gate_specs=$(find test/e2e/specs test/e2e/vibe -name '*.spec.ts' -not -path '*/vibe/unstable/*' 2>/dev/null || true)
if [ -z "$gate_specs" ]; then
  echo "⚠️  尚無 gate 測試檔（test/e2e/specs｜vibe/*.spec.ts）→ 跳過 gate spec。"
  echo "   （SDD 流程產出 spec 後，此 gate 才會真正守。）"
  exit 0
fi
```

前置檢查與 `.husky/pre-push`、CI `build-e2e` job 是**同一套邏輯**（含 `|| true` 的 errexit 處理）。三個入口對「沒有測試檔」的判定必須一致。

> **刻意不用 `--pass-with-no-tests`**：那會讓「config 壞掉導致收不到測試」也靜默綠燈，把守門失效偽裝成通過。前置檢查會大聲說出「沒有測試」，訊號強得多。

`$ARGUMENTS` 含 `--full` → 跳過 Step 1、2，直接到 Step 3 的全量指令。

### Step 1：白名單前置檢查（決定定向還是全量，不靠判斷）

```bash
default=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##'); default=${default:-main}
base=$(git merge-base HEAD "origin/$default" 2>/dev/null || true)
skip=$(sed -n "s/^SKIP_PATTERN='\(.*\)'\$/\1/p" .husky/pre-push | head -1)
smoke=$(sed -n "s/^SMOKE_PATTERN='\(.*\)'\$/\1/p" .husky/pre-push | head -1)
[ -n "$smoke" ] || { smoke='specs/(00-auth|00-hydration)'; echo "  ⚠️ pre-push 沒有 SMOKE_PATTERN 那行，先用本專案預設；請補上"; }
# SKIP 是可手改的 ERE。非法時 grep 回 2，下面的 || true 會把它變成空 diff → 誤判成定向（fail open）。
# 同 pre-push 的 ere_ok：只有 exit 2 算非法（合法 pattern 對空輸入回 1 是正常的）；非法就直接升全量。
ere_ok() { rc=0; printf '' | grep -qE "$1" 2>/dev/null || rc=$?; [ "$rc" -le 1 ]; }
ere_bad=''
ere_ok "$skip" || ere_bad="SKIP_PATTERN"
changed=$(
  { [ -n "$base" ] && git diff "$base" --name-only 2>/dev/null
    git ls-files -o --exclude-standard 2>/dev/null
  } | sort -u
)
# 濾掉 SKIP_PATTERN（文件、.env、.husky 等）——與 pre-push 同一套判準
[ -n "$skip" ] && changed=$(printf '%s\n' "$changed" | grep -vE "$skip" || true)
# 白名單：頁、spec，以及「模組專屬元件」app/components/<seg>/…（app/pages/<seg>/ 存在才算同模組）。
# case 必須放在函式裡、不能直接寫在 $( ) 內——macOS 的 /bin/sh 是 bash 3.2，$( ) 內的 case 會被判語法錯誤（實測）。
whitelisted() {
  case "$1" in
    ''|app/pages/*|test/e2e/vibe/*|test/e2e/specs/*) return 0 ;;
    app/components/*/*) seg=${1#app/components/}; seg=${seg%%/*}; [ -d "app/pages/$seg" ] ;;
    *) return 1 ;;
  esac
}
outside=$(printf '%s\n' "$changed" | while IFS= read -r f; do whitelisted "$f" || printf '%s\n' "$f"; done)
# 推不出模組的頁一律升全量——機械檢查，不靠讀 Step 2 的提醒：第一段就是動態段（app/pages/[tenantId]/…、app/pages/[id].vue，
# 模組會算成 [tenantId]，Routes／URL 查法對不上）、路由群組 (group)、catch-all [...slug]。第二段以後的動態段由 Step 2 的取段規則處理。
dyn=$(printf '%s\n' "$changed" | grep -E '^app/pages/[[(]|^app/pages/.*(\(|\[\.\.\.)' || true)
if [ -n "$ere_bad" ] || [ -z "$base" ] || [ -n "$outside" ] || [ -n "$dyn" ]; then
  echo "MODE=full"; [ -z "$base" ] && echo "  算不出 merge-base"
  [ -n "$ere_bad" ] && echo "  pre-push 的 ${ere_bad} 不是合法 ERE，diff 無法可信地過濾 → 升全量；請修正 .husky/pre-push 那一行"
  printf '%s\n' "$outside" | sed '/^$/d; s/^/  白名單外：/'; printf '%s\n' "$dyn" | sed '/^$/d; s/^/  路由推不出模組：/'
else
  echo "MODE=targeted"; printf '%s\n' "$changed" | sed '/^$/d; s/^/  白名單內：/'
fi
```

- `MODE=full` → Step 3 全量指令。第一個白名單外的檔就是報告要寫的理由
- `MODE=targeted` → Step 2（第一段動態、`(group)`、`[...slug]` 頁的升全量已由上方 `dyn` 那行機械處理，Step 2 不必再判）
- diff 取 merge-base 起的已追蹤改動＋未追蹤的新檔（union），不要只看 `git diff HEAD`
- `SKIP_PATTERN` 先驗是不是合法 ERE（`ere_ok`，判準同 pre-push）：非法一律 `MODE=full`，不讓壞掉的 pattern 把 app diff 濾成空的然後報「定向」
- 模組專屬元件的判定在上方 `case`：`app/components/<seg>/…` 且 `app/pages/<seg>/` 存在才算白名單內；頂層 `app/components/X.vue` 與找不到同名頁目錄的一律白名單外（真共用元件會影響多個模組，升全量是對的）

### Step 2：定向查法（三來源聯集，只查片段、不整檔讀）

先算模組：

- 頁 `app/pages/<seg>/…` → 模組 `<seg>`（頂層 `app/pages/x.vue` → `x`；`index.vue` → `/`）
- 模組專屬元件 `app/components/<seg>/…`（Step 1 已確認 `app/pages/<seg>/` 存在）→ 同模組 `<seg>`
- **第一段後面緊接動態段**（`app/pages/weddings/[weddingId]/rsvp/…`、`app/pages/practice/[practiceId]/pitch/…`）→ 第一段太粗（下游實測後台全擠在一段底下），模組取「第一段／第三段」＝ `weddings/rsvp`。這種模組下面三來源的 `<seg>` **不能照字面代入**，各自換成對應樣式：來源 1 用 `"page: app/pages/weddings/.*/rsvp"`；來源 2 的 URL 用 `weddings/[^/'\"]+/rsvp`（`goto\('/weddings/[^/'\"]+/rsvp|toHaveURL\(.*weddings/[^/'\"]+/rsvp|waitForURL\(.*weddings/[^/'\"]+/rsvp`，`Routes` key 取值以 `/weddings/` 開頭且含 `/rsvp` 的）；來源 3 的 marker 是檔案路徑、中間是 `[weddingId]` 目錄，用 `app/(pages|components)/weddings/\[[^]/]+\]/rsvp`。沒有第三段（`app/pages/practice/[practiceId].vue`）就取第一段 `practice`

對每個模組 `<seg>`：

1. **route-map**：`grep -n -B2 -A8 -E "page: app/pages/<seg>(/|\.vue$)" spec/report/route-map.yaml`（頂層頁在 route-map 記成 `page: app/pages/login.vue`、沒有斜線，只比對 `<seg>/` 會漏掉；`index.vue` 改查 `"page: app/pages/index\.vue$"`；兩段模組用 `-E "page: app/pages/<seg>/.*/<sub>"`）→ 該路由 `features[].file` 前兩碼 NN → `test/e2e/specs/NN-*.spec.ts`。**不要 `cat` 整份 route-map**（幾十個路由的 YAML 一次就 5K token）。route-map 常過期（下游實測 12／33 頁不在裡面），它只是輔助，來源 2 才是主來源
2. **spec 內文**（補「列表 spec 造訪詳情頁」這種跨頁 case，route-map 對不上的）：先從 `test/e2e/helpers/fixtures.ts` 的 `Routes` 表找出值以 `/<seg>` 開頭的 key，再 `grep -rlE --include='*.spec.ts' --exclude-dir=unstable "Routes\.<key>|goto\('/<seg>|toHaveURL\(.*<seg>|waitForURL\(.*<seg>" test/e2e/specs test/e2e/vibe`（`-r`：gate config 收的是 `specs/**`、`vibe/**`，spec 可能放子目錄，`*.spec.ts` 這種單層 glob 會漏；`--exclude-dir=unstable` 對齊 `testIgnore`）
3. **vibe marker**：`grep -rlE --include='*.spec.ts' --exclude-dir=unstable "Source hunk: app/(pages|components)/<seg>(/|\.vue)" test/e2e/vibe`（同上遞迴、排除 `unstable/`；頂層頁的 marker 是 `app/pages/login.vue:…`、`<seg>` 後面沒有斜線，所以接受 `/` 或 `.vue`；`index.vue`（模組 `/`）改查 `"Source hunk: app/pages/index\.vue"`；marker 不一定在第 1 行，grep 整檔）

再加上：本次 diff 裡的 spec 檔本身（新增的主 spec、新生成的 vibe spec）。

例外：

- 三來源**全部零命中**（不論頁是新是舊）→ 只跑煙霧，報告警告「這一頁沒有任何 spec 在測」。**不升全量**——白名單已保證只動到頁面與模組專屬元件，其他模組的 spec 不會受影響，跑全量只是多等（wedding-host 實測：最近 30 個 commit 改的三個模組主 spec 覆蓋 0 支，每次卻跑 327 條）
- 頁不在 route-map、或 route-map 登記的頁已不存在 → 只印提醒「route-map 過期，建議 `/feature-to-api` Sync」，**不影響分級**
- `/login` 這種每支 spec 都會經過的模組，來源 2 會選中全部 → 自然等於全量，正確

### Step 3：跑

**定向**（一條指令、位置參數是對檔案路徑的 regex、彼此聯集；`--reporter=line` 只印失敗，通過的不刷版）：

```bash
# 每個 tool call 都是新 shell，Step 1 的 $smoke 不會活到這裡；sed 必須跟指令寫在同一條，且空值要給預設——
# 空字串當位置參數會被 Playwright 編成恆真 regex，等於靜默跑全量、報告卻寫定向。
smoke=$(sed -n "s/^SMOKE_PATTERN='\(.*\)'\$/\1/p" .husky/pre-push | head -1); : "${smoke:=specs/(00-auth|00-hydration)}"; \
npx playwright test --config playwright.gate.config.ts --reporter=line \
  "$smoke" \
  test/e2e/specs/07-xxx.spec.ts test/e2e/vibe/interaction-xxx-toggle-1.spec.ts
```

跑完核對輸出的檔數與報告首行的「共 N 檔」一致——不一致代表 `$smoke` 空掉或 pattern 抽錯，不得照抄小選集數字。

**全量**（`--full` 或 `MODE=full`；不加 `--reporter`，保留 config 的 list ＋ HTML 報告）：

```bash
npx playwright test --config playwright.gate.config.ts
```

**不用 `--last-failed`**：它與檔名篩選是 AND 不是聯集；缺 `.last-run.json` 時靜默不篩選（等於跑全量）；有檔但零失敗時 `No tests found` exit 1。要重跑上輪紅的，把檔名接在指令後面。

### Step 4：解析結果（依失敗 spec 路徑分流）

**無測試檔（Step 0 已跳過，模板初始狀態的正常情形）**：

```
=== Vibe Check 跳過 ===

gate 範圍（test/e2e/specs｜vibe/*.spec.ts）尚無測試檔 → 未跑 gate。

這不是失敗：SDD 流程尚未產出 spec，gate 沒有東西可守。
pre-push 與 CI `build-e2e` job 對此情形同樣放行（三處前置檢查一致）。

下一步建議：
- 要讓 gate 真正守起來 → 先跑 /test e2e spec 產出主 spec
- 純 visual 改動可直接 commit
```

**不要**把這個情形報成紅燈，也**不要**為了「讓 gate 有東西跑」而去生測試檔——產 spec 是 `/test e2e` 的職責，不是 /vibe-check 的。

**報告首行固定標明範圍**，兩種寫法擇一，不可省：

```
=== Vibe Check（定向）===
範圍：煙霧 2 支 ＋ 定向 3 支（共 5 檔 / gate 全部 70 檔）
選集與理由：
  specs/07-查詢觀測站列表.spec.ts                ← route-map /stations → feature 07
  specs/08-新增觀測站.spec.ts                    ← spec 內文 goto('/stations/new')
  vibe/interaction-stations-toggle-1.spec.ts   ← Source hunk app/pages/stations/index.vue
  specs/00-auth、00-hydration                 ← 煙霧（SMOKE_PATTERN）
⚠️ route-map 過期：app/pages/story/[weddingId].vue 不在 route-map（建議 /feature-to-api Sync；不影響分級）
⚠️ app/pages/gallery/[weddingId]/index.vue 沒有任何 spec 在測——本次只靠煙霧守
```

```
=== Vibe Check（全量）===
範圍：gate 全部 70 檔。理由：--full ／ 白名單外：app/components/StationCard.vue
```

**綠燈**（定向）：

```
定向 5/5 檔 passed ✅（含 N skipped 為 spec 自身 .skip）

選集內的業務合約與 vibe 行為沒踩線。定向綠只代表選集：dev 全量由發 PR 前的 /vibe-check --full 跑，production 全量由 CI 跑。

下一步建議：
- 視 vibe 改動內容跑 /vibe-setup 做 UI 分層
- 純 visual 改動可直接 commit
```

**綠燈**（全量）：

```
主 spec：45/45 passed ✅（含 N skipped 為 spec 自身 .skip）
vibe spec：6/6 passed ✅（unstable/ 不計，守門排除）

業務合約與既有 vibe 行為完整。dev 全量已驗；CI 會再跑一次 production 全量。
```

**紅燈——先看失敗的 spec 在哪個資料夾，兩種性質完全不同**：

#### A. `test/e2e/specs/` 紅燈 = 破壞 Business Invariant

1. 解析失敗 test 名稱（如 `01-accounts.spec.ts › 規則：顯示帳號列表（v2） › 顯示帳號列表`）
2. 對應到 `spec/e2e-flows/{N}-{module}.flow.md` 的 `## Flow: {scenarioName}` 區段
3. 讀該 flow 段的 `Business Invariants` 與 `Verification 策略`，找出可能違反的 invariant
4. 用以下格式報告：

```
=== Vibe Check 失敗 ===

主 spec：3/45 failed ❌

失敗清單：

1. 01-accounts.spec.ts › 規則：顯示帳號列表（v2） › 顯示帳號列表
   失敗訊息：findAccountEntity(/observer_wang/) 找不到 element
   對應 flow：spec/e2e-flows/01-accounts.flow.md → Flow: 顯示帳號列表
   可能違反的 invariant：
   - 「列表必須能識別未刪除的帳號實體」
   - 「username 為主要識別欄」
   嫌疑 vibe 改動（grep app/pages/accounts/）：
   - app/pages/accounts/index.vue 是否還顯示 username 欄位？是否還能用 username 找到 row？
   建議行動：
   - 確認 observer_wang 帳號列在 /accounts 頁、且其 username 字串「observer_wang」可被視覺/讀屏識別
   - 不要修改 test/e2e/specs/01-accounts.spec.ts

2. ...

下一步建議：
- 請對照上方建議調整 vibe，調整後再跑 /vibe-check 驗證（重跑時把紅的檔名接在指令後面）
- 主 spec 紅燈時不要往 /vibe-setup、/vibe-e2e 推進
```

#### B. `test/e2e/vibe/` 紅燈 = vibe 層行為壞了（必須明確告知使用者）

**硬規則**：只要紅燈牽涉 vibe 層 spec，報告必須有獨立區塊明確標示，然後**停下來等使用者決定**。即使「刪掉那支 spec 就全綠了」也不可代為刪改——vibe spec 的去留是使用者的決定。

```
⚠️ 以下失敗是 vibe 層 spec（test/e2e/vibe/），不是業務合約：

1. interaction-watch-lazy-load.spec.ts › vibe：目擊事件清單 lazy loading
   失敗訊息：…
   來源 hunk（spec 首行 marker）：app/pages/watch/[watchId].vue:148-180
   這支 spec 守的行為：滾動 lazy load 可持續載入、不在分頁交界卡死

   你的選項（請選一個，我不會代你決定）：
   (a) 修 UI——如果這個行為是你想保留的
   (b) 更新該 vibe spec——如果這次 vibe 就是刻意改掉這個行為（可用 /vibe-e2e 重生）
   (c) 刪除該 vibe spec——如果這個行為不再需要守
   (d) 搬到 test/e2e/vibe/unstable/——如果失敗是時序 flaky 而非行為真的壞
```

specs/ 與 vibe/ 同時紅時，A、B 兩區塊都要出，並提醒先處理 A（業務合約優先）。

### Step 5：總結

最後一行明確表態：

- 無測試檔 → 「gate 尚無 spec 可守，已跳過（非失敗）；產出主 spec 後才會真正守」
- 定向全綠 → 「選集守住，可繼續 /vibe-setup 或 commit；dev 全量留到發 PR 前的 --full，production 全量由 CI 跑」
- 全量全綠 → 「業務合約與 vibe 行為守住，dev 全量已驗，可發 PR」
- specs/ 紅 → 「請對照上方建議調整 vibe，調整後再跑 /vibe-check」
- vibe/ 紅 → 「請從上方選項選一個處理方式，我等你決定」

---

## 實作要點

1. **不污染 git**：檢查過程不該動到任何檔案
2. **失敗報告要可行動**：不只說「失敗」，要指出「對應 flow.md 哪一段」+「可能違反的 invariant」+「建議調整方向」
3. **不過度推測**：UI 截圖能補上時要報告 Playwright 的 error context（截圖 / page snapshot），讓使用者直接看
4. **遇到無法解決的根本衝突（如業務 invariant 與 PM 想要的 UX 互斥），停下來問使用者**，不擅自決定
5. **保持最小職責**：不生 spec、不改 vibe spec——產生與重生是 /vibe-e2e 的事，去留是使用者的事；/vibe-check 只選、跑與報告
6. **定向的判斷全在 Step 1 的 shell 與 Step 2 的 grep**，不憑印象挑 spec。升全量的條件只有 Step 1 的三種（白名單外、路由推不出模組、算不出 merge-base）；白名單內但三來源零命中 → 煙霧＋警告（Step 2 例外），不是升全量

---

## 與相關 skill 的關係

```
/vibe-check    （這個 skill）預設定向、--full 全量，回報 pass/fail 並標明範圍
   ↓ green 才繼續
/vibe-setup    git diff → 分類為 visual / 互動 / 結構，產出分層報告
   ↓
/vibe-e2e      依分層 pattern-driven 產生 vibe spec → 只跑本次新檔 → 回報
```

三個 skill 各自獨立，使用者按順序呼叫。/vibe-check 不會自動呼叫下游，也不該被下游呼叫。
