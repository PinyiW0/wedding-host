# review-loop evals：拿 Copilot 的歷史留言當測試題

目的：回答兩個問題。(a) 本地 `/code-review` 在 push 前能先抓到 Copilot 會抓的問題的幾成——決定 #171「本地先審」值不值得、要不要加 prompt 焦點。(b) `.github/copilot-instructions.md` 上線後，Copilot 的誤判＋範圍外比例有沒有降。

## 檔案

| 檔 | 進版控 | 內容 |
|---|---|---|
| `copilot-cases.tsv` | 是 | 每則 Copilot 意見一列（11 欄，由 `scripts/copilot-harvest.sh` 產）＋ verdict |
| `runs/<日期>/pr-<N>.md` | 否 | 該日對 `eval/pr-<N>` 跑本地 `/code-review` 的 findings 原文 |
| `runs/<日期>/summary.tsv` | 否 | 該日的抓取率與誤判／範圍外比例 |

## 流程

1. **收 case**（在 repo 根目錄執行）：`sh .claude/skills/review-loop/scripts/copilot-harvest.sh -o .claude/skills/review-loop/evals/copilot-cases.tsv <PR…>`。用 `-o` 不用 `>`：`>` 會先清空正式檔，harvest 中途失敗就只剩空檔或半截；`-o` 全部成功才換檔，並把已填的 verdict 帶到新檔。`-o` 會整檔換掉，PR 清單要列全。
2. **填 verdict**，分兩步：
   - reply_excerpt 為空 → 直接用 awk 填 `未回覆`，**不交給模型**。2026-10-07 第一版把 55 則判成未回覆，其中 34 則其實有回覆——讓模型自己決定「有沒有回覆」會出錯。
   - 其餘派 **sonnet** subagent 四選一（必修已修／誤判／範圍外／可選），**禁止輸出未回覆**，並要求「以最終結論為準，不是開頭」。輸出「行號 TAB verdict TAB 理由」後用 awk 填回第 11 欄。評分模型要與產生者不同：Copilot 不是 Claude，本地 `/code-review` 是主線模型。haiku 在這一步誤判率太高，不用。
3. **(a) 抓取率**：對每個 PR 取**第一則 Copilot review 的 `commit_id`**：`sh .claude/skills/review-loop/scripts/copilot.sh reviews <N> | jq -r 'sort_by(.id) | .[0].commit_id'`。不要直接打 `/pulls/<N>/reviews` 取第一則——那會拿到人類或 `sdd-review.yml` 的 review。接著 `git fetch origin pull/<N>/head`（PR 合併、分支刪掉後本機可能沒有那個 commit），`git branch -f eval/pr-<N> <sha>`，用 Skill tool 跑 `/code-review medium eval/pr-<N> --max-findings all`（level 與 `SKILL.md` 第 2 節第 0 步相同，量到的才是它的抓取率；`--max-findings all` 會黏到之後的手動呼叫，整批跑完後第一次手動跑 `/code-review` 時帶 `--max-findings default`）。findings 存 `runs/<日期>/pr-<N>.md`。再派 haiku 對每條 verdict＝必修已修 的 case（這一步是「同 path 且同缺陷」的比對，haiku 夠用） 判「本地 findings 有沒有同 path 且同一缺陷」→ 抓取率寫 `summary.tsv`。跑完 `git branch -D eval/pr-<N>`。
4. **(b) 政策檔效果**：政策檔上線後對新 PR 再跑 1–2，比 `(誤判＋範圍外) ÷ 總數` 與 baseline。

## baseline（2026-10-07，#151、#135、#141）

第一版 baseline（verdict 由 haiku 全包、回覆只取 200 字）經 /code-review 抓到誤標：55 則「未回覆」有 34 則其實有回覆。下面是修正 harvest 並照第 2 步重判後的數字。

| 指標 | #151 | #135 | #141 | 合計 |
|---|---|---|---|---|
| Copilot 意見（case） | 27 | 24 | 72 | 123 |
| 必修已修（抓取率的分母） | 18 | 11 | 24 | 53 |
| 本地 /code-review 先抓到 | 4 | 4 | 9 | 17 |
| **抓取率** | 22% | 36% | 38% | **32%** |
| 本地 findings 總數 | 16 | 25 | 29 | 70 |

- verdict 分佈：必修已修 53、範圍外 35、未回覆 31、誤判 4、可選 0。
- **誤判＋範圍外＝39/123＝32%**（排除未回覆 42%）。範圍外的 35 則有 29 則落在 #141 的 `frozen-paths-guard.mjs`：作者實測確認是繞道，但裁決列為已知極限、不在該 PR 修。
- 本地 70 則 findings 只有 16 則對上 Copilot 的必修——兩者看同一批檔、抓不同缺陷，是互補不是取代。
- 漏抓 36 則的分類：**文件／程式／測試三者描述不同步 18**、邊界值與邏輯 10、shell 相容寫法 4、環境變數與逾時 4。

### 2026-10-12：加上文件與實作一致性專項檢查（#171）

同樣三個 PR、同樣的首次 review commit，`/code-review` 之後再跑 `references/doc-impl-check.md`（sonnet）。專項檢查共 16 則 findings，補抓到 4 則原本漏掉的必修（#135 三則、#141 一則）。

| 指標 | #151 | #135 | #141 | 合計 |
|---|---|---|---|---|
| 只跑 `/code-review` | 4/18 | 4/11 | 9/24 | 17/53＝32% |
| 加專項檢查 | 4/18 | 7/11 | 10/24 | **21/53＝40%** |

- **公平分母**：Copilot 有些意見是在第 5、10 輪才提的，針對的是前幾輪修正時新寫出來的程式；本地只審第 1 輪的版本，那些問題當時還不存在。只算「第 1 輪 commit 就有、或之後沒改過該檔」的 16 則：只跑 `/code-review` 5/16＝31%，加專項檢查 7/16＝44%。
- #151 一則都沒補到：它的 14 則漏抓有 11 則落在後來被改過的檔（例如第 10、11 輪修 curl 逾時才寫出的「5 秒乘 60 次」），第 1 輪版本裡多半還不存在。

對後續 issue 的含意：

- **#171 本地先審**：只能先擋約三分之一 Copilot 必修。給 `/code-review` 的焦點至少要含「文件描述與實作是否一致」，這一類佔漏抓的一半。
- **#173 政策檔**：價值比預期大。把「已裁決的已知極限」寫進 `.github/copilot-instructions.md`，Copilot 才不會再把它們當新問題提（#141 有 29 則屬此類）。效果要等 11 月有額度後用流程 4 驗。

## 注意

- Previously missed 沒有 thread，harvest 只能用「review 之後、寫到同一個 path:line 的第一則留言」當回覆。只寫到同 path 的不算（2026-10-07 重判時 sonnet 指出 12 則對到處理另一則意見的總結留言），所以行號被 Copilot 標偏時會留空、落到「未回覆」，填 verdict 時要人工確認。
- **不可用 PR 編號當 `/code-review` 的目標**——那會審修完後的 head，抓取率沒意義。
- Copilot 給的行號會差 2–4 行（`references/copilot-quirks.md` §4），判定看 path＋描述。
- 同一條 Previously missed 會在後續 review 重複列到修掉為止，harvest 已依 path:line＋缺陷（v2 標題、v1 說明全文）去重。Copilot 在後續 review 改了措辭時會變成另一筆，填 verdict 時要合併。
- 誰消費這份數字：#173 的驗收、`SKILL.md` 第 8 節的目標、`.claude/ops/maintenance.md` §5 的定期健檢。
