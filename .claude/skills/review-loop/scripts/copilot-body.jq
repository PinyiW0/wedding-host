# Copilot review body 的判準。copilot.sh、copilot-metrics.sh 都用 `jq -L <scripts 目錄> 'include "copilot-body"; …'`
# 讀這一份，SKILL.md 與 references/copilot-quirks.md 也指向這裡——Copilot 換格式時只改這個檔。
# 各格式的樣本與日期見 references/copilot-quirks.md 第 3 節。
#
# 三種格式都要認：
#   v1（2026-09 前）  Comments generated:** N new／Suppressed comments
#   v2 舊（09-23 起） **Findings:** None／<strong>Open (N)</strong>／<strong>Previously missed (N)</strong>／**Review effort:** X
#   v2 新（11-02 起） **No open issues**／<strong>N open issues</strong>／<strong>N previously missed issues</strong>／<sub>Review effort: X</sub>
# 一律不分大小寫：Copilot 在同一格式裡也大小寫不一（Open／open）。

# 撞配額的空 review：body 以「Copilot was unable to review」開頭、且含「quota」。不綁整句：
# 2026-10-28 句尾從「reached their quota limit」換成「insufficient remaining quota」，綁整句就會再壞一次。
# 要錨在開頭：正常 review 的摘要或意見也可能引用這兩個詞（例如審的正是配額判準）。
def is_quota: test("^\\s*Copilot was unable to review"; "i") and test("quota"; "i");

# 這一則「沒有任何待處理問題」。乾淨訊號要有一個，待處理訊號一個都不能有。
# Previously missed（之前漏報、這次補報）一律算待處理：v2 的「Findings: None／No open issues」
# 只代表沒有新的 Open，同一則 body 可能同時帶 2 previously missed（2026-11 實際發生，曾被當成共識）。
def is_clean:
  (is_quota | not)
  and test("\\*\\*Findings:\\*\\* None|\\*\\*No open issues\\*\\*|Comments generated:\\*\\* 0 new|Approval recommended|No issues found"; "i")
  and (test("<strong>(Open|Previously missed) \\([1-9]|<strong>[1-9][0-9]* (open|previously missed) issues?</strong>|\\*\\*Previously missed \\([1-9]|Suppressed comments|Comments generated:\\*\\* [1-9]"; "i") | not);

# 標在 body 上的 effort（Lite／Balanced…）；沒有則 null。
# 不寫成兩個同名捕捉群組的 alternation：jq 會取到沒匹配的那一組（實測 v1 回 null）。
def review_effort:
  (capture("(\\*\\*|<sub>)Review effort( level)?:(\\*\\*)? (?<e>[A-Za-z]+)"; "i") | .e) // null;

# 開放問題清單裡 High 的條數；body 沒有開放清單也沒寫「無問題」（v1、撞配額）→ null，代表無此資訊，不是 0。
# 只數開放清單那一段：Previously missed、resolved 清單也帶同樣的 alt 圖示，數全文會重複計。
def open_high:
  ([scan("<strong>(?:Open \\([0-9]+\\)|[0-9]+ open issues?)</strong>[\\s\\S]*?</details>"; "i")] | first) as $open
  | if $open != null then ($open | [scan("alt=\"High severity\"")] | length)
    elif test("\\*\\*Findings:\\*\\* None|\\*\\*No open issues\\*\\*"; "i") then 0
    else null end;

# 去掉零寬空白（U+200B）：v2 body 的路徑在每個斜線後夾一個，比對前要先清掉。
def strip_zw: gsub("\u200b"; "");

# Previously missed 的每一條（沒有 comment id、沒有 thread）：[{sev, title, path, line, text}]。
#   v2（兩種寫法相同）：巢狀 <details>，summary 是嚴重度圖示＋標題，接一行反引號 `path:line` 與完整說明
#   v1：`**path:line**` 接一行 `* 說明`，沒有嚴重度與標題
# 行號可能是範圍（`path:10-20`），整段照收。v2 的路徑夾著零寬空白（U+200B），先清掉。
def missed_items:
  [ match("<details>\\s*<summary><picture>[\\s\\S]*?alt=\"(High|Medium|Low) severity\"[\\s\\S]*?</picture>\\s*([^<\\n]*?)</summary>\\s*`([^`\\n]+?):([0-9]+(?:-[0-9]+)?)`\\s*([\\s\\S]*?)\\s*</details>"; "g")
    | { sev: .captures[0].string, title: .captures[1].string,
        path: (.captures[2].string | strip_zw), line: .captures[3].string, text: .captures[4].string } ]
  + [ match("\\*\\*([^*\\n]+?):([0-9]+(?:-[0-9]+)?)\\*\\*\\s*\\n\\* ([^\\n]+)"; "g")
    | { sev: "", title: "",
        path: (.captures[0].string | strip_zw), line: .captures[1].string, text: .captures[2].string } ];

# 同一條 Previously missed 的識別鍵：會在後續每一則 review 重列到修掉為止，所以不含 review id；
# 同一 path:line 可能有兩個不同缺陷，所以要帶缺陷（v2 標題、v1 說明全文）。
# SKILL.md 第 3 節第 4 步的「已處理」鍵與 copilot-harvest.sh 的去重鍵都用這一個。
def missed_key: .path + ":" + .line + ":" + (if .title != "" then .title else .text end);
