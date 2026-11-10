# label 與 assignee 選擇政策：編排模式（`/ship`）

> 本專案只同步模板此檔的「編排模式」一節（issue #208）。互動模式的 label／assignee 規則仍以 `../SKILL.md`（`/new-issue`）與 `../../pr/SKILL.md`（`/pr`）各自寫的為準；
> 模板把兩者收斂成單一共用政策，那屬 SDD skill 同步範圍，另案 #209 處理。

## 編排模式（`/ship`）的預選規則

`/new-issue`、`/pr` 互動模式時由使用者挑選、不預選——那時預選會讓使用者在選單上按 Enter 就過去。
`/ship` 的情況不同：它把所有決定收攏到唯一一次確認，選定值會**完整展示在草案上並標 `←預選`**，
使用者一句話就能改。因此本節只在 `/ship` 適用。

label 預選：先 `gh label list --json name -q '.[].name'` 取實際清單，再對照——**清單裡沒有就填「略過」，不自創、不硬湊**：

| 訊號 | 對到清單中含這些字的 label |
|------|---------------------------|
| 分支前綴 `fix/` | `bug`／`bugfix` |
| 分支前綴 `feature/`、`feat/` | `enhancement`／`feature` |
| 分支前綴 `chore/`、`refactor/` | `chore`／`maintenance` |
| diff 只有 `*.md`、`.claude/` | `documentation`／`docs` |
| 以上都對不上 | 「略過」（不帶 `--label`） |

assignee 預選 `@me`（本來就是預設值）。reviewer 預選 Copilot（與 `/pr` 預設一致）；多人 repo 另加最近一次 merged PR 的 reviewer。
