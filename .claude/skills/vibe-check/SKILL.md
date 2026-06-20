---
name: vibe-check
description: Gate 守門 — 跑 playwright.gate.config.ts（主 spec + vibe spec）確認綠燈。紅燈時依路徑分流：specs/ 對照 flow.md invariant、vibe/ 明確告知使用者決定。Use when vibe 完想驗證業務合約與既有 vibe 行為沒踩線。
---

# Vibe Check — Gate 守門（v4）

## 目的

**只做一件事**：跑 gate spec（主 spec `test/e2e/specs/` + vibe spec `test/e2e/vibe/`，排除 `vibe/unstable/`），確認 vibe 後業務合約與既有 vibe 層行為沒被破壞。

**不做**：UI 分層、vibe spec 產生、vibe spec 修改（這些由 `/vibe-setup` 與 `/vibe-e2e` 負責）。

主 spec 是 SSOT（Single Source of Truth），凍結，不可被任何 vibe 流程修改。vibe spec 不凍結（可由 `/vibe-e2e` 重生或使用者決定刪改），但 **/vibe-check 本身只報告、永遠不動它**。

pre-push hook 跑的是同一份 gate config——/vibe-check 綠燈 = push 會過。

## 何時用

- 每次 vibe UI 完，**第一步**先跑這個
- gate 綠燈才有資格往 `/vibe-setup`、`/vibe-e2e` 推進
- 想單獨確認守門狀態（= pre-push 會不會過）

## 使用方式

```bash
/vibe-check
```

無參數。永遠跑全量 gate spec。

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

如果發現非破壞合約無法達成 vibe 目標，**停下來告訴使用者**，不要擅自處理。

---

## 流程

### Step 1：跑 gate spec

```bash
npx playwright test --config playwright.gate.config.ts
```

不用 fast、不用 diff 分類、不挑 module——全量跑（主 spec + vibe spec，排除 `vibe/unstable/`）。原因：gate 是守門合約，少跑一條都可能漏判；跟 pre-push 跑同一份 config，這裡綠 = push 會過。

### Step 2：解析結果（依失敗 spec 路徑分流）

**綠燈**：

```
=== Vibe Check 通過 ===

主 spec：45/45 passed ✅（含 N skipped 為 spec 自身 .skip）
vibe spec：6/6 passed ✅（unstable/ 不計，守門排除）

業務合約與既有 vibe 行為完整，vibe 改動沒踩線。pre-push 會過。

下一步建議：
- 視 vibe 改動內容跑 /vibe-setup 做 UI 分層
- 純 visual 改動可直接 commit
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
   失敗訊息：findAccountEntity(/coach_wang/) 找不到 element
   對應 flow：spec/e2e-flows/01-accounts.flow.md → Flow: 顯示帳號列表
   可能違反的 invariant：
   - 「列表必須能識別未刪除的帳號實體」
   - 「username 為主要識別欄」
   嫌疑 vibe 改動（grep app/pages/accounts/）：
   - app/pages/accounts/index.vue 是否還顯示 username 欄位？是否還能用 username 找到 row？
   建議行動：
   - 確認 coach_wang 帳號列在 /accounts 頁、且其 username 字串「coach_wang」可被視覺/讀屏識別
   - 不要修改 test/e2e/specs/01-accounts.spec.ts

2. ...

下一步建議：
- 請對照上方建議調整 vibe，調整後再跑 /vibe-check 驗證
- 主 spec 紅燈時不要往 /vibe-setup、/vibe-e2e 推進
```

#### B. `test/e2e/vibe/` 紅燈 = vibe 層行為壞了（必須明確告知使用者）

**硬規則**：只要紅燈牽涉 vibe 層 spec，報告必須有獨立區塊明確標示，然後**停下來等使用者決定**。即使「刪掉那支 spec 就全綠了」也不可代為刪改——vibe spec 的去留是使用者的決定。

```
⚠️ 以下失敗是 vibe 層 spec（test/e2e/vibe/），不是業務合約：

1. interaction-practice-lazy-load.spec.ts › vibe：投球清單 lazy loading
   失敗訊息：…
   來源 hunk（spec 首行 marker）：app/pages/practice/[practiceId].vue:148-180
   這支 spec 守的行為：滾動 lazy load 可持續載入、不在分頁交界卡死

   你的選項（請選一個，我不會代你決定）：
   (a) 修 UI——如果這個行為是你想保留的
   (b) 更新該 vibe spec——如果這次 vibe 就是刻意改掉這個行為（可用 /vibe-e2e 重生）
   (c) 刪除該 vibe spec——如果這個行為不再需要守
   (d) 搬到 test/e2e/vibe/unstable/——如果失敗是時序 flaky 而非行為真的壞
```

specs/ 與 vibe/ 同時紅時，A、B 兩區塊都要出，並提醒先處理 A（業務合約優先）。

### Step 3：總結

最後一行明確表態：

- 全綠 → 「業務合約與 vibe 行為守住，可繼續 /vibe-setup 或 commit（pre-push 會過）」
- specs/ 紅 → 「請對照上方建議調整 vibe，調整後再跑 /vibe-check」
- vibe/ 紅 → 「請從上方選項選一個處理方式，我等你決定」

---

## 實作要點

1. **不污染 git**：檢查過程不該動到任何檔案
2. **失敗報告要可行動**：不只說「失敗」，要指出「對應 flow.md 哪一段」+「可能違反的 invariant」+「建議調整方向」
3. **不過度推測**：UI 截圖能補上時要報告 Playwright 的 error context（截圖 / page snapshot），讓使用者直接看
4. **遇到無法解決的根本衝突（如業務 invariant 與 PM 想要的 UX 互斥），停下來問使用者**，不擅自決定
5. **保持最小職責**：不做 diff 分類、不生 spec、不改 vibe spec——產生與重生是 /vibe-e2e 的事，去留是使用者的事；/vibe-check 只跑與報告

---

## 與相關 skill 的關係

```
/vibe-check    （這個 skill）跑 gate spec（主 + vibe），回報 pass/fail（與 pre-push 同一份 config）
   ↓ green 才繼續
/vibe-setup    git diff → 分類為 visual / 互動 / 結構，產出分層報告
   ↓
/vibe-e2e      依分層 pattern-driven 產生 vibe spec → 跑 vibe spec → 回報
```

三個 skill 各自獨立，使用者按順序呼叫。/vibe-check 不會自動呼叫下游，也不該被下游呼叫。
