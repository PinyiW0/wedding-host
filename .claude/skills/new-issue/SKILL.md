---
name: new-issue
description: 建立 GitHub issue 並用 gh issue develop 綁定符合專案命名慣例的 linked 分支（feature/task/chore/fix），與 /pr 的 Closes #N 自動關聯無縫接上。Use when 使用者要開 issue、建立議題並綁分支、啟動新任務、或說「開個 issue」「建 issue 綁分支」時。
argument-hint: "[issue 標題或描述(選填)]"
disable-model-invocation: true
---

# New Issue

用一個指令 **建立 GitHub issue → 綁定一條符合專案命名慣例的 linked 分支**，補齊 SDD 工作流最前端的開工動作。職責是 **建 issue → 綁分支**，與 `/pr`、`/commit` 解耦。

**核心鐵律：永遠先列出「issue 草案 + 預計分支名」給使用者確認，得到同意後才 `gh issue create` + `gh issue develop`。** 不先斬後奏。

## 工作流位置（單一職責）

本 skill 是 SDD 流程的起點，乾淨銜接到後續指令：

```
/new-issue   →  建 issue #N（四段 body）+ linked 分支 feature/#N-xxx（本 skill）
   ↓ 開發（/feature-to-api → /feature-to-ui → /test）
/verify-ac   →  讀 issue #N 的 `## 驗收標準` 逐條驗收 → 未過自動修（≤2 輪）→ 勾回 issue
/commit      →  把改動變成 commit
/pr          →  push → PR 草案 → gh pr create（分支含 #N → 自動 Closes #N）
   ↓ merge
issue #N 自動關閉
```

**關鍵**：分支名嵌入 `#N`，`/pr` 會解析 `feature/#N-` 並在 PR 內文補 `Closes #N`，merge 進 main 時 GitHub 自動關 issue。新 issue 的分支必須沿用此命名，整條鏈路才接得起來。

## 流程

### 1. 前置檢查（硬關卡，不通過就停）

依序檢查，任一不通過就停下說明，不硬幹：

| 檢查 | 命令 | 不通過 → |
|------|------|---------|
| gh CLI 可用且已認證 | `gh auth status` | 提示安裝 / `gh auth login` |
| 在 git repo 且有 GitHub remote | `gh repo view --json nameWithOwner` | **停**，提示這不是 GitHub repo |
| 取得 default branch 作 base | `gh repo view --json defaultBranchRef -q .defaultBranchRef.name` | 取不到 → 預設 `main` |

> 本 skill **不切換分支、不碰當前工作區**，所以不檢查工作區是否乾淨——在哪個分支跑都安全。

### 2. 收集 issue 資訊

依序備齊五項，缺的就問使用者：

1. **標題**：取自 `$ARGUMENTS`；沒有就問。一句話講清楚要做什麼。
2. **內文 body（固定四段）**：本 skill 產出的 issue 一律用下列四段結構，缺的段落問使用者、或依標題**代擬草案讓使用者確認增刪**。四段是 `/verify-ac` 的輸入合約，不是排版偏好——結構壞掉下游就驗不了。

   | 段落 | 內容 | 要求 |
   |------|------|------|
   | `## 問題現象` | 現在發生什麼、誰受影響 | 寫現況與痛點，**不寫解法**（problem domain 本體） |
   | `## 動機與影響` | 為什麼要解、不解會怎樣 | 一到三句，講清楚代價 |
   | `## 範圍` | 這次動哪些、不動哪些 | **必含「範圍內」與「範圍外」兩個子項**——範圍外是防多目標混寫的閘門，也是 `/verify-ac` 反查改動有沒有超編的依據 |
   | `## 驗收標準` | checklist | 規格見下 |

   驗收標準寫法（讓讀 issue 的人不用回頭問「做到什麼程度算完成」就能直接開發與驗收）。採 **rule-oriented checklist**——Given/When/Then 情境展開不放 issue，那屬於下游 `.dsl.feature` / spec 層（issue AC 停在 Problem/Solution 分界點）：
   - checklist 格式（`- [ ]`），段落標題固定為 `## 驗收標準`——`/verify-ac` 靠這個字串定位，**別改字**
   - 每條可獨立判 **Pass / Fail**，寫結果不寫實作（What not How）：feature 類寫使用者可觀察的行為結果；chore / 基礎建設類寫產出物與檢查方式
   - 可測量、不含糊：「2 秒內載入」而非「載入很快」，禁「功能正常」這種模糊描述
   - 條數 3–7 為宜，塞不下代表 issue 範圍太大、考慮拆 issue
   - 規範 / 文件 / 流程類條目要**接回實際消費點**（誰會讀、何時生效）——寫了沒人用等於沒寫
   - 使用者明說不要寫 AC → 照辦，但明確告知：**該 issue 無法用 `/verify-ac` 驗收**
3. **前綴**：用 AskUserQuestion 列四個選項讓使用者選（單選）：

   | 選項 | 用途 | 對應 label |
   |------|------|-----------|
   | `feature` | 新功能 / 新頁面 / 新 API | `enhancement` |
   | `task` | 一般開發任務 / 子任務 | `task` |
   | `chore` | 雜務 / 設定 / 維護 | `chore` |
   | `fix` | 修 bug | `bug` |

4. **分支描述**：把標題轉成 kebab-case（小寫、空白換 `-`、去掉 `#`/`:`/標點等特殊字元、取 3–5 個關鍵詞）。
   組出分支名 `<prefix>/#<N>-<kebab-desc>`，其中 `#<N>` **待 issue 建立後回填真實編號**（此刻先以 `#N` 佔位展示）。

5. **assignee**（**預設 `@me`**）：開 issue 者即認領者，讓人一眼看出誰在做。單人 repo 不問，直接 `@me`；repo 有其他 collaborator（`gh api repos/<owner>/<repo>/collaborators --jq '.[].login'`）→ 用 AskUserQuestion 列出讓使用者選（預設選項 `@me`，含「不指派」；清單排除自己與 bot 帳號，自己已由 `@me` 代表）。

#### label 存在性檢查（重要）

`gh issue create --label <X>` 在 label 不存在時會直接失敗。建 issue 前先確認：

```
gh label list --json name -q '.[].name'
```

- 目標 label 已存在（`enhancement`、`bug` 是 GitHub 預設，通常都在）→ 直接帶上。
- 目標 label 不存在（本專案 `chore`、`task` **預設沒有**）→ 用 AskUserQuestion 問使用者（單選）：
  - **建立它**：`gh label create <X>`（可加 `--description`、`--color`）後再帶上。
  - **本次略過 label**：建 issue 時不帶 `--label`，其餘照舊。

### 3. 先出草案 → 等確認 → 才執行

把草案完整列給使用者，格式：

```
擬建立 issue：
標題：<標題>
label：<label 或「略過」>
assignee：<@me / 所選協作者 / 不指派>

內文：
## 問題現象
<現況與痛點，不寫解法>

## 動機與影響
<為什麼要解、不解會怎樣>

## 範圍
**範圍內**
- <這次要動的檔案／目錄／行為>

**範圍外**
- <明確不做的事，一項一行>

## 驗收標準
- [ ] <可獨立判 Pass/Fail 的結果>
- [ ] ...

綁定分支：<prefix>/#N-<kebab-desc>   （base：main，建立後不自動切換）
```

**停下來等使用者回覆。** 確認（或調整標題/前綴/body）後才執行下一步。

### 4. 執行

```
# 1) 建 issue，從回傳 URL 取出真實編號
url=$(gh issue create --title "<標題>" --body-file "<body 暫存檔>" --label "<label>" --assignee "<assignee>")
num=${url##*/}                       # URL 結尾即 issue 編號，如 .../issues/15 → 15

# 2) 用真實編號回填分支名後，綁定 linked 分支（# 一律單引號包住，避免被 shell 當註解）
gh issue develop "$num" --name '<prefix>/#'"$num"'-<kebab-desc>' --base main
```

- **不加 `--checkout`**：依設計只建立、不切換，當前工作區與分支不受影響。
- `gh issue develop` 會在遠端建立分支並掛到 issue 的 **Development** 側欄（真 linked branch，雙向可追溯）。
- body **一律**先把完整四段寫入暫存檔再用 `--body-file`——四段含 `##` 標題、反引號與多行內容，直接塞 `--body` 會被 shell 逃逸咬到。
- 略過 label 時，`gh issue create` 就不要帶 `--label`；不指派時同理不帶 `--assignee`。

### 5. 收尾

回報三件事：

- issue URL 與編號 `#N`
- 已綁定的 linked 分支名
- 一句提示：要切過去開工就跑 `git fetch && git switch <分支名>`

## 注意

- base 固定取 repo 的 default branch（本專案為 `main`）。
- 分支命名必須是 `<prefix>/#<N>-<desc>`——`#N` 不可省，否則 `/pr` 解析不到、`Closes #N` 會斷鏈。
- 分支名含 `#`，所有命令裡一律用單引號包住，別讓 shell 把 `#` 後面當註解吃掉。
- 本 skill 只負責「建 issue + 綁分支」，**不 commit、不切換、不開 PR、不驗收**——各自的事交給 `/commit`、`git switch`、`/pr`、`/verify-ac`。
- 四段 body 是 `/verify-ac` 的輸入合約：`## 驗收標準` 的段落標題與 `- [ ]` 格式一旦改動，下游解析會失效。
- `$ARGUMENTS` 有值 → 視為 issue 標題或描述提示，納入判斷。
- 不確定（標題怎麼下、前綴選哪個、要不要建 label）→ 照樣列選項問使用者，不擅自決定。
