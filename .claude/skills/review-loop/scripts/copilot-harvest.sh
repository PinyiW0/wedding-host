#!/bin/sh
# 把 Copilot 在指定 PR 留下的每一則意見整理成 eval 用的 case（TSV）。
# 唯讀，只查 GitHub。verdict 欄一律留空，由之後的判定步驟（evals/README.md）填。
#
# 一則「意見」有兩種來源，都要收，漏任一種 eval 就會低估 Copilot 的產出：
#   1. inline 留言（REST /pulls/N/comments）：有 comment_id、有 thread、有我方回覆。
#   2. review body 裡的「Previously missed」：沒有 comment_id。解析與去重鍵在 copilot-body.jq
#      （missed_items／missed_key，與 copilot-metrics.sh 共用）。
#
# 結束碼契約（與 copilot.sh 一字不差）：0 成功／1 可重試的執行失敗／2 參數錯誤／3 需人工介入（缺 gh／jq）。
# 不用 pipefail、不把 gh 接進管線，理由見 copilot.sh 檔頭。
set -eu

usage() {
  cat <<'USAGE'
用法：
  copilot-harvest.sh [-o <輸出檔>] <PR編號> [<PR編號> ...]
      每個 PR 的每則 Copilot 意見印一列 TSV（第一行是欄名），依 PR 參數順序、再依時間排。
      帶 -o：全部 PR 都成功才換掉輸出檔（失敗時舊檔原封不動），並把舊檔已填的 verdict
      依「pr＋review_id＋comment_id＋path＋line＋body_excerpt」帶到新檔；舊 verdict 是「未回覆」
      而新的一列已有回覆時不帶，留空重判。不要用 `> 檔案`：
      shell 會先清空舊檔，harvest 中途失敗就只剩空檔或半截，已填的 verdict 也會被清掉。

欄位（11 欄，固定順序）：
  pr             PR 編號
  review_id      該意見所屬的 review id
  comment_id     inline 留言的 id；review body 內的「Previously missed」沒有 id，留空
  path, line     檔案與行號（行號來自 Copilot，可能差 2–4 行，只當參考）
  severity       High／Medium／Low，來自 v2 review body 的圖示；v1 沒有，留空
  created_at     留言或 review 的時刻
  body_excerpt   意見內容前 200 字（換行與 tab 換成空白）
  reply_excerpt  我方第一則回覆前 600 字（結論常在後段）。inline 取 thread 內第一則非 Bot 回覆；
                 Previously missed 取 review 之後第一則寫到同一個 path:line 的非 Bot 留言。沒有就空
                 （只寫到同一個 path 的不算：常是回覆同檔另一則意見，會把「未回覆」藏起來）
  is_resolved    thread 是否已 Resolved（true／false）；Previously missed 沒有 thread，留空
  verdict        留空，之後填 必修已修／誤判／範圍外／可選／未回覆

結束碼：0 成功／1 可重試的執行失敗／2 參數錯誤／3 需人工介入。
USAGE
}

die() { printf '%s\n' "$2" >&2; exit "$1"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die 3 "找不到 $1。$2"; }
require_num() {
  case "$2" in
    '' | *[!0-9]*) die 2 "$1 必須是數字，收到：$2" ;;
  esac
}
repo_slug() {
  if ! _slug="$(gh repo view --json nameWithOwner -q .nameWithOwner)"; then
    die 1 "取不到 repo（gh repo view 失敗）：確認 gh 已認證、且目前在 git repo 內。"
  fi
  [ -n "$_slug" ] || die 1 "gh repo view 成功但沒有輸出，無法判斷 repo。"
  printf '%s' "$_slug"
}

# login 白名單見 copilot-logins.sh（三支腳本共用一份）。
. "$(dirname "$0")/copilot-logins.sh"

# 四個來源各抓成一個檔（每檔是「頁的陣列」，jq 裡再攤平），全部抓齊才開始算，中途失敗就整個 PR 放棄。
fetch_sources() {
  slug="$1"; pr="$2"; dir="$3"
  owner="${slug%%/*}"; name="${slug##*/}"

  if ! gh api --paginate "repos/${slug}/pulls/${pr}/comments?per_page=100" --jq '.' > "$dir/comments.json"; then
    die 1 "取 PR #${pr} 的 inline 留言失敗（gh api）。可重試。"
  fi
  if ! gh api --paginate "repos/${slug}/pulls/${pr}/reviews?per_page=100" --jq '.' > "$dir/reviews.json"; then
    die 1 "取 PR #${pr} 的 review 失敗（gh api）。可重試。"
  fi
  if ! gh api --paginate "repos/${slug}/issues/${pr}/comments?per_page=100" --jq '.' > "$dir/issue_comments.json"; then
    die 1 "取 PR #${pr} 的 PR 留言失敗（gh api）。可重試。"
  fi
  # thread 的 Resolved 狀態只有 GraphQL 有。每個 thread 只取第一則留言的 databaseId 當 key，
  # 那就是 Copilot 開 thread 的那則 inline 留言 id。
  if ! gh api graphql --paginate -f owner="$owner" -f name="$name" -F pr="$pr" -f query='
    query($owner:String!,$name:String!,$pr:Int!,$endCursor:String){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          reviewThreads(first:100, after:$endCursor){
            pageInfo{ hasNextPage endCursor }
            nodes{ isResolved comments(first:1){ nodes{ databaseId } } }
          }
        }
      }
    }' --jq '[ .data.repository.pullRequest.reviewThreads.nodes[]
               | { isResolved, firstId: .comments.nodes[0].databaseId } ]' > "$dir/threads.json"; then
    die 1 "取 PR #${pr} 的 review thread 失敗（gh api graphql）。可重試。"
  fi
  for f in comments reviews issue_comments threads; do
    [ -s "$dir/$f.json" ] || die 1 "PR #${pr} 的 $f 回應是空的，狀態不明。可重試。"
  done
}

header() {
  printf 'pr\treview_id\tcomment_id\tpath\tline\tseverity\tcreated_at\tbody_excerpt\treply_excerpt\tis_resolved\tverdict\n'
}

harvest_pr() {
  pr="$1"
  require_num "PR 編號" "$pr"
  slug="$2"
  dir="$(mktemp -d)" || die 1 "建不了暫存目錄。"
  # fetch_sources 失敗時是在同一個 shell 裡 exit，後面接的清理不會執行，所以用 trap 兜底。
  trap 'rm -rf "$dir"' EXIT
  fetch_sources "$slug" "$pr" "$dir"

  if ! jq -L "$(dirname "$0")" -r -n --arg pr "$pr" --argjson logins "$COPILOT_LOGINS" \
        --slurpfile comments "$dir/comments.json" \
        --slurpfile reviews "$dir/reviews.json" \
        --slurpfile issues "$dir/issue_comments.json" \
        --slurpfile threads "$dir/threads.json" '
    include "copilot-body";
    # --paginate 每頁一個陣列；--slurpfile 再包一層。攤成一層並拒絕非陣列（gh 失敗時可能吐物件）。
    def flat: [ .[] | if type == "array" then . else error("GitHub API 回傳非陣列：" + tostring) end | .[] ];
    def oneline: (. // "") | gsub("\r"; "") | gsub("\n+"; " ") | gsub("\t"; " ");
    def excerpt: oneline | .[0:200];
    # 回覆常以「指控成立，已實測驗證…」開頭，結論在 200 字之後；verdict 靠這欄判，所以放寬到 600。
    def reply_excerpt: oneline | .[0:600];
    def is_copilot: (.user.type == "Bot") and (.user.login | IN($logins[]));

    ($comments | flat) as $c
    | ($reviews | flat | map(select(is_copilot)) | sort_by(.id)) as $r
    | ($threads | flat) as $t
    | ($issues | flat | map(select(.user.type != "Bot"))) as $ic

    # v2 body 的 Open／Resolved 清單：每條「圖示 … #discussion_r<id>」→ id → 嚴重度。多則 review 重複列時取最後一次。
    | ([ $r[] | (.body // "")
        | match("alt=\"(High|Medium|Low) severity\"[^\\n]*?#discussion_r([0-9]+)"; "g")
        | { key: .captures[1].string, value: .captures[0].string } ] | from_entries) as $sev
    | ([ $t[] | select(.firstId != null) | { key: (.firstId | tostring), value: .isResolved } ] | from_entries) as $res

    # 來源 1：Copilot 開 thread 的 inline 留言（排除它自己的回覆）；我方回覆＝同 thread 第一則非 Bot。
    | ($c | map(select(is_copilot and .in_reply_to_id == null))) as $ci
    | ($c | map(select(.in_reply_to_id != null and .user.type != "Bot")) | sort_by(.created_at)
        | group_by(.in_reply_to_id) | map({ key: (.[0].in_reply_to_id | tostring), value: .[0].body }) | from_entries) as $rep
    | ($ci | map({
        pr: $pr,
        review_id: (.pull_request_review_id | tostring),
        comment_id: (.id | tostring),
        path: (.path | strip_zw),
        line: ((.line // .original_line // "") | tostring),
        severity: ($sev[(.id | tostring)] // ""),
        created_at,
        body_excerpt: (.body | excerpt),
        reply_excerpt: ($rep[(.id | tostring)] // "" | reply_excerpt),
        # 不能寫 $res[k] // ""：jq 的 // 會把 false 也當成「沒有值」，未解決的 thread 就變成空白。
        is_resolved: ((.id | tostring) as $k | if ($res | has($k)) then ($res[$k] | tostring) else "" end),
        verdict: ""
      })) as $rows_inline

    # 來源 2：review body 的 Previously missed（解析見 copilot-body.jq 的 missed_items）。
    # 同一條會在後續 review 重複列到修掉為止，依 missed_key 去重、留最早那次。
    | ([ $r[] | . as $rv | (.body // "") | missed_items[]
        | . + { review_id: ($rv.id | tostring), created_at: $rv.submitted_at } ]
      | sort_by(.created_at) | group_by(missed_key) | map(.[0])
      | map(. as $m | {
          pr: $pr,
          review_id,
          comment_id: "",
          path, line,
          severity: .sev,
          created_at,
          body_excerpt: ((if .title != "" then .title + " — " else "" end) + .text | excerpt),
          # 只認 review 送出之後、寫到同一個 path:line 的留言。不加時間條件會把「這個問題被提出之前」的留言當成回覆；
          # 不退回「只寫到 path」：那常是回覆同檔另一則意見，會把這則的「未回覆」藏起來。
          # path:line 兩邊都要是邊界：前面不能接路徑字元（`a.md:8` 不可配到 `doc/a.md:8`），
          # 後面不能接數字或「-」（不可配到 `a.md:80`、`a.md:8-10`）。正則每條只算一次。
          # 用正則的前後瞻、不用 indices 切字串：jq 1.7 的字串 indices 回位元組位置，遇到中文會切錯。
          reply_excerpt: (("(?<![A-Za-z0-9_./-])" + (($m.path + ":" + $m.line) | gsub("(?<c>[.*+?^$()\\[\\]{}|\\\\])"; "\\\(.c)")) + "(?![0-9-])") as $re
            | [ $ic[] | select(.created_at >= $m.created_at and (.body | test($re))) ]
            | sort_by(.created_at) | .[0].body // "" | reply_excerpt),
          is_resolved: "",
          verdict: ""
        })) as $rows_missed

    | ($rows_inline + $rows_missed) | sort_by(.created_at) | .[]
    | [ .pr, .review_id, .comment_id, .path, .line, .severity, .created_at,
        .body_excerpt, .reply_excerpt, .is_resolved, .verdict ] | @tsv'; then
    rm -rf "$dir"
    die 1 "PR #${pr} 的資料解析失敗。可重試。"
  fi
  rm -rf "$dir"
}

require_cmd gh "本腳本全部查詢都透過它。請先安裝並 gh auth login。"
require_cmd jq "解析與合併四個來源都要它。請先安裝（brew install jq／apt install jq）。"

out=""
case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  -o) { [ $# -ge 2 ] && [ -n "$2" ]; } || { usage >&2; exit 2; }; out="$2"; shift 2
      # 不含斜線的檔名補 ./：awk 會把 `out=1.tsv` 這種參數當成變數設定、不讀檔，而暫存檔名由它衍生，也要一起帶斜線。
      case "$out" in */*) ;; *) out="./$out" ;; esac ;;
esac
[ $# -ge 1 ] || { usage >&2; exit 2; }
for p in "$@"; do require_num "PR 編號" "$p"; done

slug="$(repo_slug)" || exit $?
if [ -z "$out" ]; then
  header
  for p in "$@"; do
    harvest_pr "$p" "$slug" || exit $?
  done
  exit 0
fi

# -o：先寫到同目錄的暫存檔，全部成功才換上。harvest_pr 自己會設 EXIT trap，所以放進子 shell 跑，
# 失敗時由這裡刪暫存檔。不寫成 `if ! (…)`：`!` 之後的 $? 一律是 0，結束碼契約會被吃掉。
tmp="$(mktemp "${out}.XXXXXX")" || die 1 "建不了暫存檔（$out 所在目錄可寫嗎？）。"
( header; for p in "$@"; do harvest_pr "$p" "$slug" || exit $?; done ) > "$tmp" || {
  rc=$?; rm -f "$tmp"; exit "$rc"
}
# 舊檔已填的 verdict（第 11 欄）依鍵帶過來：鍵是第 1–5 欄與第 8 欄（body_excerpt），
# 用 FILENAME 辨識舊檔、不用 NR == FNR：舊檔是空檔時後者對新檔也成立，新資料會全被 next 丟掉。
# 同一 path:line 的兩個不同缺陷靠第 8 欄分開。舊的「未回覆」在新列已有回覆（第 9 欄）時不帶，留空重判。
if [ -f "$out" ]; then
  if ! awk -F'\t' -v OFS='\t' '
        FILENAME == ARGV[1] { if (FNR > 1 && $11 != "") v[$1 FS $2 FS $3 FS $4 FS $5 FS $8] = $11; next }
        FNR > 1 { k = $1 FS $2 FS $3 FS $4 FS $5 FS $8; if ((k in v) && !(v[k] == "未回覆" && $9 != "")) $11 = v[k] }
        { print }' "$out" "$tmp" > "$tmp.merged"; then
    rm -f "$tmp" "$tmp.merged"; die 1 "帶入舊 verdict 失敗，$out 沒有改動。"
  fi
  mv "$tmp.merged" "$tmp"
fi
mv "$tmp" "$out"
