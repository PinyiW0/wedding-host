---
name: vibe-setup
description: Vibe UI 分層 — 讀 git diff 將 vibe 改動分類為純 visual / 互動 / 結構，並標記命中的測試 pattern（折疊/tab/loading/error/empty/新區塊...），輸出分層報告供決策或 /vibe-e2e 套版。Use when 跑完 /vibe-check 綠燈、想知道哪些 vibe 改動需要進一步 e2e 驗證。
---

# Vibe Setup — UI 分層（v1）

## 目的

把 vibe 階段對 `app/` 的改動分類，幫使用者快速判斷：

- **純 visual**（顏色、間距、字級、icon）→ 不用補 e2e
- **互動行為**（展開、折疊、條件渲染、hover、tab）→ 需要補 e2e
- **結構新增**（新區塊、空狀態、loading、error UI）→ 需要補 e2e

同時對每個「需要補 e2e」的 hunk 標記**測試 pattern**（給 `/vibe-e2e` 套版用）。

**不做**：跑測試、寫 spec、修 UI、落地檔案（純 console 報告）。

## 前置條件

- 建議**先跑 `/vibe-check` 確認主 spec 綠燈**。主 spec 紅燈時 vibe 改動本身可能違規，分層意義不大
- vibe 改動已落在 working tree（uncommitted）或 HEAD 上（committed），能被 `git diff` 抓到

## 使用方式

```bash
/vibe-setup            # 預設：對比 HEAD（包含 working tree + staged + 最新 commit 對比上一 commit）
/vibe-setup <ref>      # 指定 base ref（例：/vibe-setup origin/main 對比遠端 main）
```

---

## 絕對禁止

- 不可動到任何檔案（純讀 + console 輸出）
- 不可跑 playwright（那是 /vibe-check 或 /vibe-e2e 的事）
- 不可寫入 `spec/`、`test/`、`app/`
- 不可 commit / push

---

## 流程

### Step 1：抓 diff

```bash
git diff <base> -- app/pages/ app/components/ app/layouts/
```

`<base>` 預設 `HEAD`。若 working tree 乾淨但最近 commit 是 vibe，改用 `HEAD~1`（或使用者指定 ref）。

只看 `.vue` 與 `.ts` 檔，忽略 `*.test.*`、`*.spec.*`。

### Step 2：對每個 hunk 分類

分類規則（grep pattern、sub-pattern mapping、邊界 case 人工判斷）見 [`./classification.md`](./classification.md)，與 `vibe-e2e` 共用。改規則只改該檔，兩個 skill 自動同步。

### Step 2.5：testid 合約對照

從 `test/e2e/specs/*.spec.ts` 提取所有 `getByTestId('xxx')` 字串集合 = **合約 testid 白名單**：

```bash
grep -rhoE "getByTestId\(['\"]([^'\"]+)['\"]\)" test/e2e/specs/ \
  | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/" | sort -u
```

**只對本次 diff 新增的 `data-testid`** 做集合差（**不掃 UI 全量**）：

```bash
# 只看 diff + 行新增的 testid（含 static data-testid 與 :data-testid 動態形式）
git diff <base> -- app/pages/ app/components/ app/layouts/ \
  | grep -E "^\+.*data-testid=" \
  | grep -oE "data-testid=[\"'\`]([^\"'\`]+)[\"'\`]" \
  | sed -E "s/.*data-testid=[\"'\`]([^\"'\`]+)[\"'\`].*/\1/" | sort -u
```

分類：

- **白名單內**：合法（主 spec 認得這個 testid，是合約的一部分）
- **白名單外**：**本次 vibe 新增的**孤兒 testid 候選

> **為什麼只看 diff 新增**：UI 存量已有大量 v1 cycle 1 殘留的 dead testid（v2 抽象化遷移之前產出，主 spec 不再引用）。這些是 tech debt 不是本次 vibe 的責任。每次 vibe 報告**只關心本次 vibe 引入的新孤兒**，避免報告被存量淹沒。
>
> 若要全面盤點存量 dead testid（清理 tech debt 用），請另跑 inventory script，不要塞進 vibe-setup 報告。

### Step 3：輸出報告

格式（純 console，不寫檔）：

```
=== Vibe Setup 分層報告 ===

Base ref：HEAD
Diff 範圍：app/pages/, app/components/, app/layouts/

分類統計：
- 純 visual：8 hunks
- 互動行為：3 hunks
- 結構新增：2 hunks

---

## 純 visual（無需 e2e）

1. app/pages/accounts/index.vue:42-45
   diff: class="text-xs" → class="text-sm"
   說明：字級調整

2. app/components/common/EntityRow.vue:18-22
   diff: 新增 lucide icon import + 替換
   說明：icon swap

...

## 互動行為（需 e2e）

1. app/pages/practice/live.vue:120-135
   diff: 新增 sidebar 折疊 ref + UButton @click toggle
   pattern: toggle
   建議測試：點折疊按鈕後 sidebar 應 hidden；再點應 visible
   locator hint:
     - 觸發：role=button name=/折疊|展開|collapse|expand/
     - 目標：role=complementary name=/sidebar/ 或 testid=vibe-sidebar
   
2. app/pages/players/[id].vue:50-72
   diff: 新增 UTabs（基本資料 / 統計）
   pattern: tab
   建議測試：點 statistic tab 後對應 panel 出現
   locator hint:
     - 觸發：role=tab name=/統計/
     - 目標：role=tabpanel
   
3. ...

## 結構新增（需 e2e）

1. app/pages/players/index.vue:80-95
   diff: 新增 v-if="!players.length" 空狀態區塊（含「尚無球員」文字 + 引導建立 CTA）
   pattern: empty-state
   建議測試：清空 players 後顯示「尚無球員」文字；CTA 連到建立頁
   locator hint:
     - 目標：text=/尚無球員/
     - CTA：role=link name=/建立/

2. ...

---

## testid 合約對照（只看本次 diff 新增）

合約白名單（grep test/e2e/specs/）：5 個 testid
本次 diff 新增/修改的 testid：2 個
（**存量 dead testid 不檢查**——cycle 1 殘留 tech debt，請另跑 inventory）

✅ 合約內（0 個）：
  （無）

⚠️ 合約外（2 個）— 本次 vibe 引入的新孤兒：
  - vibe-statistics-panel (app/pages/players/[id].vue:55 +line)
    建議：若要納入合約 → 改 .flow.md → 重跑 /test e2e spec
  - sidebar-collapse-button (app/components/Sidebar.vue:30 +line)
    建議：用 getByRole('button', { name: /折疊/ }) 取代

下一步：
- 合約外的 testid 若不需要長期存在 → 從 diff 移除
- 若確實需要進合約 → 走 flow.md → spec 重生流程

---

下一步建議：
- 純 visual 部分可直接 commit
- 互動 + 結構部分（5 hunks）建議跑 /vibe-e2e 產 spec 並驗證
- 若任何 hunk 命中不確定的 pattern，請先人工檢視
```

---

## 與相關 skill 的關係

```
/vibe-check    主 spec 守門（先跑這個，綠燈才有意義往下走）
   ↓ green
/vibe-setup    （這個 skill）分類 + pattern 標記，純 console 報告
   ↓ 看報告決策
/vibe-e2e      依分層 pattern-driven 產生 vibe spec → 跑
```

**輸出不落地**——`/vibe-e2e` 跑時會重新對當下 git diff 分類，不依賴本 skill 的歷史輸出。本 skill 的角色是給人類看的「決策報告」。

---

## 實作要點

1. **不污染**：純讀取與 console 輸出
2. **分類規則優先序固定**：結構 > 互動 > visual，不要 case-by-case 亂改
3. **pattern 標記要具體**：locator hint 要寫到「role + name regex」或「testid」層級，不要只說「找按鈕」
4. **不確定就標記不確定**：與其誤判，不如在報告裡列「邊界 case，建議人工確認」
5. **保持輕量**：不跑測試、不寫檔，跑完 < 5 秒
