---
name: pr
description: 把當前 feature 分支發成對 main 的 PR — push + 產繁中標題/內文草案 + gh pr create。一律先出草案待確認才開 PR；偵測未 commit 改動或人在 main 上會停下來引導，不越界。Use when 使用者要發 PR、開 PR、送出 pull request、或說「幫我發 PR」「開個 PR」時。
argument-hint: "[reviewer / label / 補充說明(選填)]"
---

# PR

把當前 **feature 分支** 發成一個對 `main` 的 Pull Request。職責是 **push → 產草案 → `gh pr create`**，與 `/commit` 解耦。

**核心鐵律：永遠先列出「PR 標題 + 內文草案」給使用者確認，得到同意後才 `git push` + `gh pr create`。** 不先斬後奏。

## 與 /commit 的分工（單一職責）

本專案 commit 與發 PR 是兩段獨立流程，乾淨銜接 —— `/commit` 故意不 push，正好留給 `/pr` 接手：

```
/commit  →  把改動變成 commit（明確不 push）
/pr      →  接手：push → 產 PR 草案 → gh pr create
```

`/pr` **不負責 commit**。偵測到有未 commit 改動時，停下來叫使用者先跑 `/commit`，不越界代勞。

## 流程

### 1. 前置檢查（硬關卡，不通過就停）

依序檢查，任一不通過就停下說明，不硬幹：

| 檢查 | 命令 | 不通過 → |
|------|------|---------|
| gh CLI 可用且已認證 | `gh auth status` | 提示安裝 / `gh auth login` |
| 不在 main / master 上 | `git branch --show-current` | **停**，引導先開 feature 分支（見下） |
| 工作區乾淨（無未 commit） | `git status --short` | **停**，叫先跑 `/commit`，不自己 commit |
| 是否已有對應 PR | `gh pr view --json url,state` | 有 → 轉「只 push 更新」不重開 |

**在 main / master 上是硬紅線**：開發一律走 feature 分支，不可直接動 main。此時停下來引導使用者建分支，命名慣例：

- `feature/#<issue>-<簡述>`（如 `feature/#2-development-skill`）
- `chore/<簡述>`、`fix/<簡述>`

### 2. 收集素材

```
git log main..HEAD --oneline      # 本分支所有 commit
git diff main...HEAD --stat        # 變更檔案總覽
```

從分支名解析 issue 編號（如 `feature/#2-...` → `#2`）。

**解析到編號時，內文結尾固定補一行 `Closes #<編號>`** —— PR 合併進 `main` 時 GitHub 會自動關閉該 issue，不必再手動關。不論內文用 PR 模板或內建三段式，都在最後補這行。注意：

- 關鍵字須**獨立成行、緊接編號**才生效（寫進清單項或被其他字包住會失效）。
- 跨 repo 的 issue 用 `owner/repo#<編號>`。
- 分支名沒有編號 → 略過這行，不硬湊。

### 3. 產生標題 + 內文草案（全繁中）

**標題**：綜觀本分支所有 commit，摘一句**繁中**標題講清楚這個 PR 做了什麼 —— 不直接照搬英文 commit subject。

**內文**：

- repo 有 `.github/pull_request_template.md` → **以它為準**填寫。
- 沒有 → 用內建三段式：

```
## 摘要
<1–3 句：這個 PR 做了什麼、為什麼>

## 變更
- <對應本分支 commits 的重點邏輯改動>

## 測試
- <如何驗證；本專案 CI 自動跑 build + eslint + sdd-review>

Closes #<編號>
```

> 末行 `Closes #<編號>` 僅在分支名解析得到 issue 編號時加；沒有就拿掉。

### 4. 內文精簡易讀守則（重點）

PR 內文是給人讀的，**精簡直觀 > 鉅細靡遺**：

- **摘要 1–3 句**，講「做了什麼 + 為什麼」，砍掉「本 PR 旨在…」「為了提升…整體…」這類開場白廢話。
- **變更講邏輯改動，不逐檔流水帳** —— 檔案清單讓 diff 自己說，別把每個檔名抄一遍。
- **不複製 commit message** —— PR 是更高一層的視角，不是 commit 的拼貼。
- **沒內容的小節就不放** —— 純 skill/docs 改動沒手動測試步驟，「測試」一句帶過或省略，不硬湊。

反例（冗長通病，別這樣）：

```
## 摘要
本 PR 主要新增了一個全新的 skill，目的是為了協助使用者更方便地建立
Pull Request，提升整體開發體驗與工作流程效率。

## 變更內容
- 新增 .claude/skills/pr/SKILL.md
- 定義了 frontmatter
- 撰寫了完整流程說明
- 加入前置檢查邏輯

## 測試
- 已測試相關功能，確認沒有問題
```

正例（精簡）：

```
## 摘要
新增 `pr` skill，把當前 feature 分支一鍵發成對 main 的 PR。與 commit 解耦。

## 變更
- 前置檢查（在 main / 有未 commit 會擋）→ 繁中草案 → 確認後 push + 建 PR
- 進階：reviewer/label 選填、建完開瀏覽器

## 測試
CI 自動跑 build + eslint + sdd-review。

Closes #2
```

### 5. 先出草案 → 等確認 → 才執行

把標題 + 內文草案完整列給使用者，格式：

```
擬發 PR：
標題：<繁中標題>
base：main  ←  <當前分支>

內文：
<完整 markdown 內文>
```

**停下來等使用者回覆。** 確認（或調整）後才執行下一步。

### 6. 執行

```
git push -u origin <branch>        # 沒 upstream 才需 -u；已有就 git push
gh pr create --base main --title "<標題>" --body "<內文>"
gh pr view --web                   # 開瀏覽器
```

- 使用者透過 `$ARGUMENTS` 指定了 reviewer / label 才加 `--reviewer <人>` / `--label <標籤>`（預設不帶；label 須 repo 已存在）。

### 7. 收尾

回報 PR URL，並提醒一句：PR 會觸發 CI —— `pull_request.yml` 跑 build + eslint；若改到 `app/`、`server/` 還會跑 `sdd-review.yml` 的 AI 語意審查。

## 注意

- base 固定 `main`（本專案 PR 一律 target main）。
- 絕不在 main / master 上發 PR 或代 commit —— 該停就停，列選項問使用者。
- `$ARGUMENTS` 有值 → 視為 reviewer / label / 內文補充提示，納入判斷。
- 不確定（標題怎麼下、要不要拆 PR）→ 照樣列草案問使用者，不擅自決定。
