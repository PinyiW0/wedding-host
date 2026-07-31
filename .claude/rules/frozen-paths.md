---
paths:
  - "test/e2e/specs/**"
  - "spec/gherkin-feature/**"
  - "spec/e2e-flows/**"
---

# 主 spec 凍結（SSOT 政策）

**你正在修改的路徑屬於凍結區。停下來。**（唯讀讀取不受限，本規則管的是修改與刪除）

> 技術強制：`.claude/hooks/frozen-paths-guard.mjs`（PreToolUse hook）會擋下凍結區**既有檔**的 Edit/Write/NotebookEdit 與 Bash 寫入（`sed -i`、`tee`、`cp`、`mv`、重導向等，含 subagent 內；大小寫變體與 symlink 繞道一併攔截）；**新增全新檔**放行（授權產出流程不受影響）。本規則的 paths 觸發僅在主對話生效、subagent 內不注入（2026-07-06 實測），hook 才是實際防線。
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
