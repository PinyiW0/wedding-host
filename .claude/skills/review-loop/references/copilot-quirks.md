# Copilot review 的行為與踩坑

來源：PinyiW0/Nuxt4-template-SDD PR #132 實跑，2026-09-01。七輪 review 才收斂，以下每一條都對應真實付出的代價。第 3 節的 body 格式另有後續樣本：#151（2026-09-23）、#185（2026-10-28）、#190／#192（2026-11-02）、#203（2026-11-05）。

## 1. re-request 必須走 GraphQL

REST 的 `POST /repos/{o}/{r}/pulls/{N}/requested_reviewers` 端點對 **re-request 無效**：回 200、回傳完整 PR 物件，但 `requested_reviewers` 始終是空陣列，Copilot 也不會來。實測靜置兩小時零反應；改用 GraphQL 後 10 分鐘內就收到 review。實跑的指令是（`-f` 是 `gh api` 的旗標，不是 endpoint 路徑的一部分）：

```bash
gh api "repos/{o}/{r}/pulls/{N}/requested_reviewers" \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

GitHub 對認不得的 reviewer 是**靜默忽略**，不報錯——所以只看 HTTP 狀態碼會誤判成功。

有效做法是 `requestReviews` mutation 的 `botIds`（REST 只認 user／team，這是它失效的原因）：

```bash
sh .claude/skills/review-loop/scripts/copilot.sh request <PR編號>
```

bot node ID 由 `copilot.sh bot-id` 解出：掃 repo 近 50 個 PR 的 review 作者，取 `__typename == "Bot"` 且 login 在 `../SKILL.md` 鐵律 2 白名單內的，**去重後必須唯一**——撈到多個不同 id 就報錯要人工指定，不猜（請錯 bot 一樣會回成功，然後 review 永遠不會來）。

**白名單三個 login 都要列**，它隨端點而異（實測 2026-09-02）：GraphQL review author 是 `copilot-pull-request-reviewer`、REST `/pulls/N/reviews` 是 `copilot-pull-request-reviewer[bot]`、REST `/pulls/N/comments` 是 `Copilot`。不要改用 `contains("copilot")` 或 `test("copilot.*review")`——那會連 `copilot-swe-agent`（或 `copilot-swe-agent-review`）一起撈進來，請錯 bot 或污染輪詢的基準線。

> **與 `/pr`、`/ship` 現有寫法的關係**：那兩個 skill 寫的 REST 版本是給**初次**請求用的，在「repo 沒開自動 Copilot review」的情況下有效；`/ship` 的「回 200 但空陣列不用排查」也只對初次成立。第一輪 review 結束後 ruleset 不會再自動觸發，REST 也請不動，此時只有 GraphQL 有效。

## 2. review 常錨在舊 commit

Copilot 會在你 push 新 commit **之前**就開始跑，完成時 review 錨的是舊 head。實測七輪裡有三輪如此，同一個問題被重複提出，其中「import 不完整」被提了兩次、「SKILL.md 交叉引用」被提了兩次。

**每次拿到 review 先比對錨點**：

```bash
gh api repos/<o>/<r>/pulls/comments/<留言id> --jq .commit_id   # inline 留言
git rev-parse --short HEAD
```

suppressed comment 沒有自己的留言 id，看該則 review 的 `commit_id`（`copilot.sh reviews` 已一併輸出）。

錨點不等於 HEAD 時，**先讀遠端實際內容**確認問題是否已修掉：

```bash
git show origin/<branch>:<path>
```

已修掉就**只回覆說明、不重改也不重 commit**，回覆裡附上 commit 對照與遠端實際內容當證據，然後 re-request 讓它跑在最新 commit 上。為了「看起來有回應」而把已修好的東西再改一次，是這個坑最貴的失敗模式。

## 3. 問題常藏在 review body 的 Suppressed comments

Copilot 的 review body 可能夾帶結構化的 `Suppressed comments (N)` 區塊，**帶明確的 file:line 與完整建議**，但 inline 留言數是 **0**。實測七輪中有四輪是這種形態——只讀 inline 留言會整輪漏掉，而且不會有任何徵兆。

review body 一定要讀完，不能只當摘要跳過。`copilot.sh reviews` 的輸出含 `body` 就是為了這個。

body 有三種格式，**都要認**：v1、v2（2026-09-23 起）、v2 新寫法（2026-11-02 起，同樣以 `<!-- ccr-overview-v2 -->` 開頭）。腳本的判準只有一份：`../scripts/copilot-body.jq`，Copilot 再換格式時改那個檔。

**v1**（#135 review 5085821819，節錄）——項目在 `Suppressed comments` 底下，每條是粗體 `path:line` 接一行 `*` 說明，沒有嚴重度：

```markdown
### 🔵 Needs a closer look
…
<details>
<summary>Review details</summary>

### Suppressed comments (2)

**Previously missed (2)** — in code that hasn't changed since the last review.

**.claude/skills/review-loop/scripts/copilot.sh:83**
* 在 GraphQL 解析 Copilot reviewer bot id 時，查的是 `reviews(first:50)`……
**.claude/skills/review-loop/SKILL.md:103**
* 「輪詢驅動」這段同時寫了……

- **Comments generated:** 0 new
- **Review effort level:** Lite
</details>
```

**v2**（#151 review 5290000574，節錄；`[High]` 這類標記在原文是 `<picture>…<img alt="High severity">…</picture>` 圖示）——開頭有 `<!-- ccr-overview-v2 -->`，項目分三個 `<details>`：

```markdown
<!-- ccr-overview-v2 -->
## Copilot review overview
### 🟡 Changes recommended
…
**Review effort:** Lite
**Findings:** 1 [High]

<details open>
<summary><strong>Open (1)</strong></summary>

- [High] [Fail safely on invalid skip or force regex patterns](#discussion_r4081616104) · New
</details>

<details>
<summary><strong>Resolved since last review (2)</strong></summary>
- [High] [Set NUXT_PUBLIC_API_BASE for isolated Docker E2E tests](#discussion_r4081479106)
…
</details>

<details>
<summary><strong>Previously missed (1)</strong></summary>

In code that hasn't changed since last review

<details>
<summary>[Low] Correct inaccurate ledger synchronization claim</summary>

`.husky/​pre-push:82`

This message is inaccurate: `ledger.sh` does not read `SMOKE_PATTERN`……
</details>
</details>
```

**v2 新寫法**（#203 review 5780011484，節錄）——沒有 `**Findings:**` 摘要行，清單標頭改成「數字＋小寫名詞」，effort 移到頁尾 `<sub>`：

```markdown
<!-- ccr-overview-v2 -->
### 🟡 Changes recommended
…
<details open>
<summary><strong>7 open issues</strong></summary>

- [High] [批次重排未驗證每筆筆記的修改權限](…#discussion_r4476719538) · New
…
</details>

<details>
<summary><strong>4 previously missed issues</strong></summary>

In code that hasn't changed since last review

<details>
<summary>[Medium] …</summary>

`.claude/​skills/​feature-to-api/​references/​auth-scaffold.md:391`

[P2] 讓 mock 登出撤銷 refresh token。……
</details>
…
</details>

<details>
<summary><strong>3 resolved since last review</strong></summary>
…
</details>

<sub>Review effort: Balanced</sub>
```

沒有問題時是 `### 🟢 Approval recommended` 加 `**No open issues** 🎉`（#190 review 5733005762）。

讀法：

| 區塊 | 要不要處理 | 怎麼對到留言 |
|---|---|---|
| `Open (N)`／`N open issues` | 要 | `#discussion_r<id>` 就是 inline 留言的 comment id；嚴重度看圖示的 `alt` |
| `Resolved since last review (N)`／`N resolved since last review` | 不用，只是對帳 | 同上 |
| `Previously missed (N)`／`N previously missed issues` | 要，沒有 thread | 路徑在反引號裡，**夾著零寬空白（U+200B）**，比對前要先去掉；回覆走第 5 節的 `gh pr comment` |
| `**Findings:** None`（v2）／`**No open issues**`（v2 新寫法） | 只代表沒有新的 Open，**同一則可能還帶 Previously missed** | `copilot.sh reviews` 的 `findings_none` 已把這種情況排除 |

撞配額的 review 是零留言的 `COMMENTED`，body 只有一句「Copilot was unable to review this pull request because the user who requested the review has …」。句尾在 2026-10-28 從「reached their quota limit.」換成「insufficient remaining quota.」（#185 review 5678618127），所以 `is_quota` 只認「body 以 Copilot was unable to review 開頭」＋「含 quota」，不綁整句。

`/pr-feedback` 步驟 2 的四路抓法只涵蓋 inline 留言與 review 總結本體，未特別處理這個區塊——它把 (c) review 當「沒有 file:line 的總結」，而 suppressed 區塊**自己帶著 file:line 與完整建議**，照那個指引會被當純摘要略過。委派它抓留言時要自己另外補這一步。

## 4. Copilot 給的行號不可靠

它在 review body 摘要裡標的行號，與 inline 留言標的行號、以及檔案真實行號，三者可能互不相符（實測差 2–4 行）。它說「同檔案其他行也有此問題」時給的行號同樣不可信。

一律用它描述的**內容**去檔案裡搜，不要直接跳到它給的行號。

## 5. 回覆留言的兩種端點

| 留言形態 | 回覆方式 |
|---|---|
| inline 留言（有 comment id） | `gh api repos/<o>/<r>/pulls/<N>/comments/<id>/replies -F body=@<檔案>`，回在原討論串 |
| suppressed comment、review 總結 | 沒有 thread 可掛 → `gh pr comment <N> --body-file <檔案>` |

**一律先把內容寫成檔案再送**，不要用 inline 的 `-f body='…'` / `--body '…'`：

- `gh pr comment` 不帶 body 會進**互動模式等你打字**（`gh` 自己的說明就這麼寫），無人值守時直接卡死
- 回覆常含反引號、巢狀引號與中文標點，inline 形式會被 shell 咬掉（實測撞過）

回覆內容要能被第三者驗證：附 `commit_id` 對照、遠端實際檔案內容、或實測數據。判定為誤判時說清楚理由，不要只寫「已處理」。
