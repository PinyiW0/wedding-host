# 維護協議：制度檔的修改、回寫與精簡

## 1. 修改權限分級

| 等級 | 範圍 | 規則 |
|------|------|------|
| **可自行改** | `.claude/ops/*` 的錯字、失效路徑修正、補充正反例；`memory/`（使用者層記憶，不隨 repo）依記憶機制回寫 | 改完必做第 3 節的路由驗證 |
| **改前先出草案等確認** | `.claude/CLAUDE.md` 本體、`.claude/rules/*`、`.claude/skills/*`、`spec/ui-config/*` | 這些是多方消費的 SSOT，先列 diff 草案給使用者 |
| **動前必問、預設不動（凍結區）** | 路徑清單以 `.claude/rules/frozen-paths.md` 為準（該檔 SSOT，hook 強制擋，此處不重列） | 見 `rules/frozen-paths.md`；不得為繞過而自寫 sentinel |
| **動前必問、預設不動（其他）** | `~/.claude/`（全域層，影響所有專案）；`.claude/settings*.json`；任何 `.env*`；`playwright.config.ts`、`playwright.gate.config.ts`（守門合約，`vibe-check`／`vibe-e2e` 兩個 skill 亦各自明訂不可動） | 這幾項不在 frozen-paths hook 管轄內，無技術強制，靠本協議與 skill 內的紅線一起守 |

任何等級的修改都遵守：改 tracked 檔前確認 git 狀態可還原（乾淨 tree 即可，git 就是備份）；untracked 檔先 `cp` 備份到 scratchpad。

## 2. 踩雷教訓寫回哪裡（分流判準）

踩了雷（工具的坑、慣例誤解、被糾正的做法），依性質分流：

| 教訓性質 | 寫回哪 | 格式 |
|----------|--------|------|
| 個人偏好／跨任務工作方式 | `memory/`（使用者層記憶，機器綁定不隨 repo；一檔一事實 + MEMORY.md 索引一行） | 記憶機制既有格式（frontmatter + Why + How to apply） |
| 制度規則錯了或缺角 | 直接改對應的 `ops/*.md`，在該節補正反例 | 沿用該檔格式；重大修改走 PR 說明 |
| 專案技術慣例（框架、工具） | `.claude/rules/` 對應檔（需確認，見第 1 節） | 沿用「禁止行為 → 正確做法」表格式 |
| skill 流程的坑 | 該 skill 的 SKILL.md 或 references/（需確認） | 祈使句 + 錯誤情境的處理方式 |

判斷不了寫哪 → 先寫 memory（成本最低、不影響他人），並在條目內標「候補：應upstream 到 <目標檔>」。

## 3. 路由驗證（每次改 .claude/ 下任何檔後必跑）

1. 對改動檔內出現的每個相對路徑**引用**跑 `ls <路徑>`，全部存在才算完成
   - **例外**：專案結構示意圖／目錄樹中「由 SDD 指令產出後才出現」的路徑（如 `app/api/`、`server/`）不適用——那是說明未來產出物，不是指向現存檔的引用。此類區塊應如 `CLAUDE.md` 專案結構段標明免責
2. 若刪除或搬移了檔案：grep 全 `.claude/` 找引用舊路徑的地方，逐一更新
3. `CLAUDE.md` 行數檢查：`wc -l .claude/CLAUDE.md` ≤ 150，超過就把最長的段落抽成引用檔

## 4. 精簡時機（行數上限）

| 檔案 | 上限 | 超過時 |
|------|------|--------|
| `.claude/CLAUDE.md` | 150 行 | 抽離內容成引用檔，只留一行索引 |
| `.claude/rules/*.md` | 100 行 | 拆成多個更窄 paths 的規則檔 |
| `.claude/ops/*.md` | 200 行 | 把範例／背景移到檔尾附錄或另檔，正文只留規則 |
| skill 的 SKILL.md | 500 行 | 細節下放 references/，SKILL.md 只留流程 |
| `memory/MEMORY.md` | 50 行 | 合併同主題記憶、刪除已過時者 |

精簡的原則：**刪重複、刪過時、下放細節**——不刪判準與正反例（那是弱模型唯一能依靠的部分）。

## 5. 定期健檢（每次大版本升級或每月一次，擇早）

派一個 fresh subagent（sonnet）跑審查範本（[delegation-templates.md](delegation-templates.md) 第 5 節），對象是整個 `.claude/ops/` + `CLAUDE.md`：

- 路徑全部有效？
- 模型名／參數與當前 harness 實際值一致？（用當前 session 的 tool schema 查證，不憑記憶）
- 有沒有規則在實務中從沒被用到？（候選刪除，列給使用者決定）
