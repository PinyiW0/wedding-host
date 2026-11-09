---
paths:
  - "test/e2e/specs/**"
  - "spec/gherkin-feature/**"
  - "spec/e2e-flows/**"
---

# 主 spec 凍結（SSOT 政策）

**你正在修改的路徑屬於凍結區。停下來。**（唯讀讀取不受限，本規則管的是修改與刪除）

> 技術強制：`.claude/hooks/frozen-paths-guard.mjs`（PreToolUse hook）會擋下凍結區**既有檔**的 Edit/Write/NotebookEdit 與 Bash 寫入（`sed -i`、`tee`、`cp`、`mv`、重導向等，含 subagent 內；大小寫變體與 symlink 繞道一併攔截）；**新增全新檔**放行（授權產出流程不受影響）。本規則的 paths 觸發僅在主對話生效、general-purpose 分身內不注入（2026-07-06 實測、2026-11-04 模板複測分身仍同；見 `.claude/CLAUDE.md` Hooks 表下方註記），hook 才是實際防線。hook 以「目標檔所在的 worktree」判斷凍結路徑（#199）：從主目錄 session 改同 repo 的另一個 worktree、或專案目錄下的巢狀 worktree（`isolation: "worktree"` 分身的位置），一樣擋；相對路徑以當下工作目錄解析，同一條指令裡的 `cd <dir>`、`git -C <dir>` 也會納入基準（cd 前後的基準都算，只會多擋；含空白的目錄與 `-C<dir>` 黏連也追蹤；`pushd`、`cd -`、引號內的 `bash -c 'cd …'` 等不追蹤，引號內再包一層含空白的路徑（`bash -c "rm '/a b/…'"`）也漏放，見 hook 檔頭已知極限第 33 條）；授權 sentinel 寫在目標所在 worktree 的 `.claude/tmp/`。邊界：執行的是啟動 session 那個目錄的 hook 版本，舊版目錄開的 session 沒有這項修正；別的 repo（含衍生專案）不擋；巢狀 worktree 以單元測試的真 git worktree 驗證，未用真的 isolation 分身實測。
>
> **一次性授權通道**：正規產出流程（`/feature-to-flow` 的 flow 覆寫、`/test e2e spec` 的 spec 全量重生）經使用者確認後，寫檔前先建 `.claude/tmp/frozen-allow.json`（格式 `{ "reason": "<為何覆寫>", "files": ["<repo 相對路徑>", ...] }`），hook 對清單內目標放行**一次**並自動從清單移除（清空即刪檔）。此通道僅限上述流程在使用者確認後使用，不得為繞過凍結而自行寫 sentinel。
>
> **凍結路徑清單以 hook 內的 `FROZEN` 陣列為準**——新增／移除凍結區時，hook、本檔 frontmatter paths 與下表三處必須同步改。

| 凍結路徑 | 內容 | 誰能改 |
|----------|------|--------|
| `test/e2e/specs/` | 主 spec（測試合約，UI 的唯一真理） | 只有 `/test e2e spec` 流程在使用者確認下產出；vibe / UI 修改絕不可動 |
| `spec/gherkin-feature/` | `.feature` 業務規格（外部產出，含 `.dsl.feature` 變體與上游 codegen 匯出） | 外部置入（使用者手動或上游腳本產出），AI 不改 |
| `spec/e2e-flows/` | `.flow.md`（business invariant + E2E 流程） | 只有 `/feature-to-flow` 流程產出，下游不回頭改 |

如果任務看起來「不改凍結檔就做不到」：

1. 不要改。先停。
2. 把衝突具體說明給使用者：哪條 invariant／哪個 spec 擋住了什麼目標。
3. 列出選項讓使用者決定（例如：調整目標、走正規 spec 變更迭代流、或由使用者自行修改規格）。

> 唯一例外：使用者明確指示走「spec 變更迭代流」（見 `.claude/CLAUDE.md` SDD 段），此時由對應 skill 依流程更新，仍需使用者逐步確認。

## hook 的覆蓋面與極限

hook 的覆蓋面、歷次繞道修補與擋不住的手法，記在 `.claude/hooks/frozen-paths-guard.mjs` 檔頭註解。hook 是純文字靜態解析，擋的是「順手改到凍結檔」，不是刻意繞道——不要把它當唯一防線。
