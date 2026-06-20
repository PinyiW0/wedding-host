---
name: commit
description: 分析 git diff，依 SDD 階段分群並產生 Conventional Commits v1.0.0 的 type(scope) commit，message 為精簡扼要的英文。一律先出分群草案待使用者確認才提交；diff 混多階段時按階段拆成多個 commit。Use when 使用者要 commit、提交、送出變更、整理變更、或說「幫我 commit」「commit 一下」時。
argument-hint: "[範圍提示或 message 補充(選填)]"
---

# Commit

分析目前工作區改動，依 **SDD 階段**分群，套 **Conventional Commits v1.0.0** 產生精簡繁中 message。

**核心規則：永遠先列出「分群 + 訊息草案」給使用者確認，得到同意後才 `git commit`。** 不先斬後奏。

## 為什麼用 SDD 階段分群，而不是用 scope

本專案是 SDD pipeline，commit 的邏輯邊界是**階段**，不是目錄。一個階段的產物常橫跨多個目錄但屬同一目的 —— 例如 `/feature-to-api` 一次吐出 `app/types/api/` + `server/api/` + `server/mock/` + `app/api/*.api.ts` + `spec/report/route-map.yaml`，這是**一個 commit**，不可因為「跨 app/ 和 server/」就硬拆。

判斷分群時：**同一階段的產物 → 綁成一個 commit；偵測到 diff 跨了多個階段 → 才按階段拆成多個 commit。**

## 流程

### 1. 盤點

```
git status --short
git diff
git diff --staged
```

- 已有 staged → 只處理 staged 的。
- 沒 staged → 處理所有 tracked 改動 + 合理的 untracked，但 **跳過** `.env*`、`*.local`、`node_modules/`、`dist/`、`.output/`、build 產物。

### 2. 用「階段指紋」分群

比對改動路徑，歸到對應 SDD 階段。**同階段路徑屬同一群**：

| 階段 | 路徑指紋（命中即屬此階段） | 預設 type(scope) |
|------|--------------------------|------------------|
| flow | `spec/gherkin-feature/`、`spec/e2e-flows/*.flow.md` | `docs(flow)` 或 `test(spec)` |
| api 合約 | `app/types/api/`、`server/api/`、`server/mock/`、`app/api/*.api.ts`、`spec/report/route-map.yaml` | `feat(api)` |
| 主 spec | `test/e2e/specs/*.spec.ts` | `test(e2e)` |
| ui | `app/pages/`、`app/components/`、`app/layouts/`、`app.config.ts`、`app/main.css` | `feat(ui)` |
| store | `app/stores/` | `feat(store)`（多隨 ui 同群） |
| vibe spec | `test/e2e/vibe/` | `test(vibe)` |
| ci | `.github/`、`.husky/`、`playwright*.config.ts` | `ci` |
| build/deps | `package.json`、lockfile、`nuxt.config.ts`、`Dockerfile` | `build(deps)` |
| skill/docs | `.claude/skills/`、`*.md`、`CLAUDE.md` | `feat(skill)` / `docs` |
| chore | 上面都不命中（`.vscode/` 等） | `chore` |

判斷原則：
- **單一階段** → 一個 commit，**不拆**（即使跨目錄）。
- **跨多階段** → 每階段一個 commit。
- **同階段但夾帶不相干的隨手修正**（如順手修了個無關 bug）→ 把那塊獨立成 `fix` commit。
- vibe 改動若已跑過 `/vibe-setup` 分層：純 visual → `style(ui)`；互動/結構 → `feat(vibe)`。

### 3. 定 type / scope

階段指紋表已給預設值，再依實際內容微調：

| type | 用途 |
|------|------|
| `feat` | 新功能 / 新頁面 / 新 API / 新元件 / 新 skill |
| `fix` | 修 bug、修錯誤行為 |
| `refactor` | 不改外部行為的重構（搬移、改名、抽函式） |
| `perf` | 效能優化 |
| `docs` | 純文件（`*.md`、CLAUDE.md、註解） |
| `test` | 測試與規格（`test/`、`spec/`） |
| `style` | 純格式（縮排、空白、prettier，無邏輯變化） |
| `build` | 建置 / 依賴 |
| `ci` | CI（`.github/`、husky、playwright config） |
| `chore` | 雜項維護 |
| `revert` | 還原先前的 commit |

scope 取最能代表該群的單一小寫詞，常見：`flow`/`api`/`server`/`store`/`ui`/`e2e`/`vibe`/`spec`/`ci`/`skill`/`deps`。範圍太雜或無共通 scope 時省略。

### 4. 寫 message —— English, 精簡扼要（重點）

description 一律**英文**，遵守：

- **imperative mood、小寫開頭、句尾不加句號**（`add` 不是 `added`/`Adds`）。
- **直觀**：講「做了什麼」不講「怎麼做」，一眼看懂。
- **扼要**：subject ≤ ~50 字元一句講完，砍掉 `stuff`、`some`、`various`、`related to` 這類贅字。
- 一個 commit 一件事，**不寫 body**（除非 BREAKING CHANGE 或須交代原因）。
- 破壞性變更：type 後加 `!`，body 寫 `BREAKING CHANGE: <說明>`。

每種 type 各一個正例：

```
feat(api): add device contract types and mock
fix(husky): skip pre-push gate when no test files exist
docs: update CLAUDE.md SDD flow and command table
style(ui): align device list spacing and icons
refactor(skills): move stage files from scripts to references
perf(server): cache device list query
test(e2e): add device business contract spec
build(deps): bump nuxt to 4.1
ci: add sdd-review PR cloud workflow
chore: add .vscode editor settings
revert: revert "feat(api): add device contract types and mock"
```

破壞性變更（含 body）：

```
feat(api)!: remove legacy login endpoint

BREAKING CHANGE: /api/v1/login removed, use /api/v2/auth instead
```

反例（別這樣）：

```
✗ feat(skill): Added a new skill for doing code review stuff.   ← 大寫、句號、過去式、贅字
✗ update: change some things                                    ← 非法 type、空泛
✗ fix: fix bug                                                  ← 沒講修了什麼
```

### 5. 先出草案 → 等確認 → 才提交

把分群結果列給使用者，**每群一行**，格式：

```
擬分 N 個 commit：
1. feat(api): add device contract types and mock
   └ app/types/api/device.ts, server/api/v1/devices/*.ts, server/mock/devices.ts, spec/report/route-map.yaml
2. test(e2e): add device business contract spec
   └ test/e2e/specs/03-device.spec.ts
```

**停下來等使用者回覆。** 使用者確認（或調整）後，再逐群執行：

```
git add <該群檔案>
git commit -m "type(scope): 描述"
```

**不要** `git push`（除非使用者明確要求）。

### 6. 收尾

commit 完跑 `git log --oneline -n <群數>`，一行帶過給使用者看。

## 注意

- 絕不 commit `.env*`、密鑰、`*.local`、build 產物。
- 階段難以辨識、或不確定該不該拆時，照樣列草案問使用者，不擅自決定。
- `$ARGUMENTS` 若有值，視為使用者對範圍或訊息的補充提示，納入判斷。
