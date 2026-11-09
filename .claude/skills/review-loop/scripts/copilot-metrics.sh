#!/bin/sh
# Copilot review 的度量：每個 PR 請了幾次、回了幾次、幾則留言、撞了幾次配額、首尾相隔多久。
# 唯讀，只查 GitHub；不 request、不留言、不改任何東西。
#
# 用途：給 /review-loop 收尾通知附數字，以及跨 PR 比對 baseline（SKILL.md「目標」節）。
# 沒有這支，#170／#171／#172 的改動上線後說不出「有沒有變好」。
#
# 結束碼契約（與 copilot.sh 一字不差；呼叫端照這個分流，不要只看輸出）：
#   0  成功。輸出可信。
#   1  執行失敗（環境、API、資料異常）。可重試。
#   2  參數或用法錯誤。重試無用。
#   3  需人工介入（缺 gh／jq）。
#
# 與 copilot.sh 相同的兩條寫法規則，理由見該檔檔頭：不用 pipefail（非 POSIX）；
# 一律不把 gh 接進管線——先捕進變數、檢查結束碼，再交給 jq。
set -eu

usage() {
  cat <<'USAGE'
用法：
  copilot-metrics.sh pr <PR編號>
      印出該 PR 的一列 TSV（第一行是欄名）。

  copilot-metrics.sh since <YYYY-MM-DD>
      列出該日（含）之後建立的所有 PR，每 PR 一列，依編號遞增。

欄位（TSV）：
  pr                  PR 編號
  category            程式類（任一改動檔命中 ^app/|^server/）／制度類（其餘）
  created, merged     PR 建立／merge 時刻（UTC ISO 8601；未 merge 為空）
  requests            請 Copilot review 的次數（timeline 的 REVIEW_REQUESTED_EVENT，只數 Bot）
  reviews             Copilot 回的 review 數（含撞配額的空 review）
  quota_hits          其中「已達配額上限」的 review 數
  inline_comments     Copilot 的 inline 留言數
  comments_per_review （inline_comments＋去重後的 Previously missed 條數）÷（reviews − quota_hits），一位小數；
                      分母為 0 時是 -。Previously missed 只在 body、沒有 inline 留言，不算會低估；
                      撞配額的空 review 不算一輪，算進分母會灌水。去重鍵同 copilot-harvest.sh
  first_review_at, last_review_at, span_min
                      第一則／最後一則 Copilot review 的時刻，與兩者相隔的分鐘數
  first_clean_round   第一則「沒有任何待處理問題」的 review 是第幾則；沒有則空。判準與 copilot.sh 的
                      findings_none 同一份（copilot-body.jq 的 is_clean，Previously missed 不算乾淨）
  high_first          第一則 review 開放問題清單裡 High 的條數；沒有開放清單也沒寫「無問題」
                      （v1、撞配額的空 review）為空，代表「無此資訊」，不是 0
  effort_first        第一則 review 標的 effort（Lite／Balanced）；三種寫法見 copilot-body.jq

結束碼：0 成功／1 可重試的執行失敗／2 參數錯誤／3 需人工介入。
USAGE
}

# 本檔所有輸出一律用 printf（理由見 copilot.sh）。
die() { printf '%s\n' "$2" >&2; exit "$1"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die 3 "找不到 $1。$2"
}

require_num() {
  case "$2" in
    '' | *[!0-9]*) die 2 "$1 必須是數字，收到：$2" ;;
  esac
}

require_date() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
    *) die 2 "日期必須是 YYYY-MM-DD，收到：$1" ;;
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

# 請 review 的次數要數 timeline 事件，不能用 reviewRequests 或 totalCount：
# timelineItems(...).totalCount 在 #151 回 106（連非 Bot 與其他事件一起算），與 Bot 節點數 12 不符。
count_requests() {
  owner="$1"; name="$2"; pr="$3"
  if ! pages="$(gh api graphql --paginate -f owner="$owner" -f name="$name" -F pr="$pr" -f query='
    query($owner:String!,$name:String!,$pr:Int!,$endCursor:String){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          timelineItems(first:100, itemTypes:[REVIEW_REQUESTED_EVENT], after:$endCursor){
            pageInfo{ hasNextPage endCursor }
            nodes{ ... on ReviewRequestedEvent {
              requestedReviewer{ __typename ... on Bot { login } } } }
          }
        }
      }
    }' --jq '
      '"$COPILOT_LOGINS"' as $logins
      | [ .data.repository.pullRequest.timelineItems.nodes[]
          | select(.requestedReviewer.__typename == "Bot"
                   and (.requestedReviewer.login | IN($logins[]))) ] | length')"; then
    die 1 "查 PR #${pr} 的 review request 事件失敗（gh api graphql）。可重試。"
  fi
  # --paginate 每頁各印一個數字，加總。
  printf '%s\n' "$pages" | awk '{ s += $1 } END { printf "%d\n", s }'
}

count_inline() {
  slug="$1"; pr="$2"
  if ! raw="$(gh api --paginate "repos/${slug}/pulls/${pr}/comments?per_page=100" --jq '.')"; then
    die 1 "取 PR #${pr} 的 inline 留言失敗（gh api）。可重試。"
  fi
  [ -n "$raw" ] || die 1 "gh api 回 0 但沒有輸出，狀態不明。可重試。"
  if ! printf '%s' "$raw" | jq -s --argjson logins "$COPILOT_LOGINS" '
        [ .[]
          | if type == "array" then . else error("GitHub API 回傳非陣列：" + tostring) end
          | .[]
          | select(.user.type == "Bot" and (.user.login | IN($logins[]))) ] | length'; then
    die 1 "inline 留言資料解析失敗。可重試。"
  fi
}

header() {
  printf 'pr\tcategory\tcreated\tmerged\trequests\treviews\tquota_hits\tinline_comments\tcomments_per_review\tfirst_review_at\tlast_review_at\tspan_min\tfirst_clean_round\thigh_first\teffort_first\n'
}

# 印一列。所有欄位在同一個 jq 程式裡算完再 @tsv，避免 shell 層拼字串時漏欄。
metrics_row() {
  pr="$1"
  # slug 由 dispatcher 解析一次後傳進來，since 跑幾十個 PR 不必每個都再查一次 gh repo view。
  slug="$2"
  owner="${slug%%/*}"; name="${slug##*/}"

  # 改動檔清單走 REST 分頁：gh pr view --json files 只取前 100 個檔，超過就會把程式類誤判成制度類。
  if ! paths="$(gh api --paginate "repos/${slug}/pulls/${pr}/files?per_page=100" --jq '.[].filename')"; then
    die 1 "取 PR #${pr} 的改動檔清單失敗（gh api）。可重試。"
  fi
  if printf '%s\n' "$paths" | grep -qE '^(app|server)/'; then category="程式類"; else category="制度類"; fi

  if ! meta="$(gh pr view "$pr" --json number,createdAt,mergedAt --jq '
        { created: .createdAt, merged: (.mergedAt // "") }')"; then
    die 1 "取不到 PR #${pr}（gh pr view 失敗）：確認 PR 存在且看得到。"
  fi
  [ -n "$meta" ] || die 1 "gh pr view 成功但沒有輸出。可重試。"

  requests="$(count_requests "$owner" "$name" "$pr")" || exit $?
  inline="$(count_inline "$slug" "$pr")" || exit $?

  if ! raw="$(gh api --paginate "repos/${slug}/pulls/${pr}/reviews?per_page=100" --jq '.')"; then
    die 1 "取 PR #${pr} 的 review 失敗（gh api）。可重試。"
  fi
  [ -n "$raw" ] || die 1 "gh api 回 0 但沒有輸出，狀態不明。可重試。"

  if ! printf '%s' "$raw" | jq -L "$(dirname "$0")" -r -s \
        --arg pr "$pr" --arg category "$category" --argjson meta "$meta" \
        --argjson requests "$requests" --argjson inline "$inline" \
        --argjson logins "$COPILOT_LOGINS" '
    # is_quota／is_clean／open_high／review_effort 都在 copilot-body.jq（與 copilot.sh 共用一份）。
    include "copilot-body";
    [ .[]
      | if type == "array" then . else error("GitHub API 回傳非陣列：" + tostring) end
      | .[]
      | select(.user.type == "Bot" and (.user.login | IN($logins[])))
      | {id, submitted_at, body: (.body // "")} ]
    | sort_by(.id)
    | . as $r
    | ($r | length) as $n
    | [
        $pr,
        $category,
        $meta.created,
        $meta.merged,
        $requests,
        $n,
        ([$r[] | select(.body | is_quota)] | length),
        $inline,
        (([$r[] | select(.body | is_quota)] | length) as $q
         | ([$r[].body | missed_items[] | missed_key] | unique | length) as $missed
         | if $n - $q > 0 then ((($inline + $missed) / ($n - $q) * 10 | round) / 10) else "-" end),
        (if $n > 0 then $r[0].submitted_at else "" end),
        (if $n > 0 then $r[-1].submitted_at else "" end),
        (if $n > 0 then ((($r[-1].submitted_at | fromdateiso8601) - ($r[0].submitted_at | fromdateiso8601)) / 60 | floor) else "" end),
        ((first(range($n) as $i
                | select($r[$i].body | is_clean)
                | $i + 1)) // ""),
        # null（無此資訊）輸出成空欄，不是 0。
        (if $n > 0 then ($r[0].body | open_high) // "" else "" end),
        (if $n > 0 then ($r[0].body | review_effort) // "" else "" end)
      ] | @tsv'; then
    die 1 "review 資料解析失敗（回應不是預期的陣列）。可重試。"
  fi
}

cmd_pr() {
  require_num "PR 編號" "$1"
  slug="$(repo_slug)" || exit $?
  header
  metrics_row "$1" "$slug"
}

cmd_since() {
  require_date "$1"
  if ! nums="$(gh pr list --state all --limit 500 --search "created:>=$1" --json number --jq '.[].number')"; then
    die 1 "列 PR 失敗（gh pr list）。可重試。"
  fi
  [ -n "$nums" ] || die 1 "找不到 $1 之後建立的 PR（gh pr list 回空）。日期太新、或 repo 沒 PR。"
  # gh 由新到舊回傳，碰到上限會靜默截掉最舊的；寧可報錯，也不輸出不完整的 baseline
  [ "$(printf '%s\n' "$nums" | wc -l | tr -d ' ')" -lt 500 ] || die 2 "$1 之後的 PR 達 500 筆上限、最舊的會被截掉。改用較新的日期分段查。"
  slug="$(repo_slug)" || exit $?
  header
  for n in $(printf '%s\n' "$nums" | sort -n); do
    metrics_row "$n" "$slug" || exit $?
  done
}

require_cmd gh "本腳本全部查詢都透過它。請先安裝並 gh auth login。"
require_cmd jq "合併 --paginate 的分頁輸出與算欄位都要它。請先安裝（brew install jq／apt install jq）。"

case "${1:-}" in
  -h | --help) usage; exit 0 ;;
  pr)     [ $# -eq 2 ] || { usage >&2; exit 2; }; cmd_pr "$2" ;;
  since)  [ $# -eq 2 ] || { usage >&2; exit 2; }; cmd_since "$2" ;;
  *)      usage >&2; exit 2 ;;
esac
