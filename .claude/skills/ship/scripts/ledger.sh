#!/bin/sh
# ship ledger — 記錄「這份改動已經跑過哪幾層綠燈」，讓同一輪收尾不重跑。
#
# 設計要點：指紋錨在 merge-base 而不是 HEAD。
#   git diff <merge-base> 同時涵蓋「已 commit」與「未 commit」的內容，
#   所以 /commit 跑完 HEAD 變了，指紋不變 —— Phase 1 掙到的綠燈能活到 Phase 5。
#   若錨在 HEAD，commit 後 diff 變空，綠燈會在送出前全部失效。
#
# 用法：
#   ledger.sh fp <layer>                     印出該層 scope 的內容指紋
#   ledger.sh snapshot                       一次印出所有層的指紋（跑檢查前先存起來）
#   ledger.sh plan                           印出本輪各層該跑或可沿用
#   ledger.sh mark <layer> <status> <fp> [full]  記錄結果。fp 必填，且必須是【跑之前】取的快照；
#                                            L2 green 必須帶第 4 個參數 full（dev 全量），定向綠改記 targeted
#   ledger.sh round <key>                    累加該 key 的修正輪次；超過上限回 exit 2
#   ledger.sh fresh                          作廢整份 ledger（環境有變、想強制重跑時用）
#   ledger.sh close                          一趟 /ship 送出完成時歸零輪次帳（停下交還時由使用者決定）
#   ledger.sh l2                             印出 L2（dev 全量）該不該跑：yes／no
set -eu

# 一律在 repo 根目錄跑：git diff --name-only 印的是根目錄相對路徑，
# 在子目錄跑會讓 [ -f ] 全判成 DELETED、指紋跟內容脫鉤，還會在子目錄另生一份 ledger。
top=$(git rev-parse --show-toplevel) || { echo "ledger.sh：不在 git repo 內" >&2; exit 1; }
cd "$top"

DIR=".claude/tmp/ship"
LEDGER="$DIR/ledger.tsv"
# 輪次帳分開存：它是「禁止第 3 輪重試」的安全閥，不是快取。
# 跟 ledger 放同一個檔的話，切分支或 --fresh 這種純快取操作會順手把上限一起清掉，
# 卡在上限的迴圈只要跑一次 --fresh 就解鎖了。
ROUNDS="$DIR/rounds.tsv"
# 上一趟的輪次帳留一份供診斷；只有 close 會寫它，判定永遠不讀
ROUNDS_PREV="$DIR/rounds.prev.tsv"

# 這串是不是合法的 ERE。grep 的約定：0=有比對到、1=沒比對到、2=pattern 有問題。
ere_ok() {
  rc=0
  printf '' | grep -qE "$1" 2>/dev/null || rc=$?
  [ "$rc" -le 1 ]
}

# L2 不列在上表 —— 它的判定要從 .husky/pre-push 抽，見 l2_should_run()
# 各層 scope。改這裡就改了「哪些檔算動到這一層」。
# 訂 scope 的原則：寧可多跑，不可漏跑 —— 漏跑會讓「✅ 已驗證」蓋在沒驗過的內容上。
layer_pattern() {
  case "$1" in
    # L1 涵蓋全部：eslint 連 md 裡的 code block、json、yaml 都會查，而且它最便宜。
    # 用窄 pattern 反而會讓「只改 README/package.json」漏跑，等 CI 紅燈才發現。
    L1)  echo '.' ;;
    # L15 除了 composable/util/store 本身，還要含測試檔與被測對象 ——
    # fixer 修 unit 紅燈最常見的做法就是改 test/unit/ 裡那支，漏了就不會重驗。
    # 被測對象不只 app/、server/：.claude/hooks/ 的兩支 guard、scripts/deploy-migrate.mjs，
    # 以及 node-version-sync 讀的 .nvmrc／Dockerfile／package.json。app/ 整個納入（app/types 等也被 import），寧可多跑。
    L15) echo '^app/|^server/|^scripts/|^test/unit/|^vitest\.config\.|^\.claude/hooks/|^\.nvmrc$|^Dockerfile|^package\.json$' ;;
    L3)  echo '^app/.*\.vue$|^app/stores/|^server/.*\.ts$' ;;
    # L5 不只 app/、server/：2026-08-20～09-29 的 136 則 Copilot 留言有 134 則落在 app/、server/ 以外，
    # 只看 app/server 等於讓 Copilot 當第一個 reviewer。scope 與 judgment-rubrics 第 5 節、CLAUDE.md 紅線同一份。
    # 建置檔（Dockerfile、package.json、patches/）也在內：#190 只改建置檔，原本拿不到 /code-review。
    # README.md、docs/ 也在內：doc-impl-check 會讀整份 diff 的 .md，不納入的話只改 README 時指紋不變、沿用舊綠燈。
    L5)  echo '^app/|^server/|^\.claude/|^\.github/|^\.husky/|^scripts/|^patches/|^docs/|^Dockerfile|^package\.json$|^README\.md$|\.sh$|\.mjs$|(^|/)osv-scanner\.toml$' ;;
    # L4 = judgment-rubrics 第 5 節的制度層，驗法是 fresh subagent read-back。
    # 漏了它，只改 .claude/ 下的 .md（例如改 skill 本身）時只剩 L1／L5，沒有一層驗規則有沒有消費點；
    # spec/ui-config/ 不在 L5 scope，只改其中 .md 時更是只剩 L1。
    L4)  echo '^\.claude/|^spec/ui-config/' ;;
    # L2 用全 diff 當 scope：「這輪要不要跑」由 l2_should_run 依 pre-push 判準決定，
    # 「跑過的還算不算數」則看指紋。gate 是最貴的一層，沒有去重等於每輪都全量重跑。
    L2)  echo '.' ;;
    AC)  echo '.' ;;
    *)   echo '' ;;
  esac
}

# 注意：不可寫成 `git symbolic-ref ... | sed ... && return 0`。
# 管線的結束碼是 sed 的，而 sed 永遠成功 —— symbolic-ref 失敗時會回傳空字串，
# 一路害 base 退化成 HEAD，ledger 整個失效（實測踩過）。
default_branch() {
  d=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
  if [ -n "$d" ]; then echo "$d"; return 0; fi
  for b in main master; do
    git show-ref --verify --quiet "refs/remotes/origin/$b" && { echo "$b"; return 0; }
  done
  echo main
}

# 算不出 merge-base（沒有 remote、淺 clone）就回 NOBASE。
# 不可 fallback 成 HEAD —— 那會讓指紋在 commit 後歸零，靜默失效比報錯危險。
base_rev() {
  git merge-base "origin/$(default_branch)" HEAD 2>/dev/null || echo NOBASE
}

# 注意：detached HEAD 時 `git branch --show-current` 印空字串但 exit 0，
# 所以不能用 `|| echo DETACHED`（那是死碼）。要判空。
current_branch() {
  b=$(git branch --show-current 2>/dev/null || true)
  if [ -n "$b" ]; then echo "$b"; else echo DETACHED; fi
}

# 某層 scope 的內容指紋。檔案內容變 -> 指紋變 -> 該層自動失效。
# 用 git hash-object 而非 shasum：後者在 macOS 與 Linux 上輸出格式不同。
scope_fp() {
  pattern="$(layer_pattern "$1")"
  [ -n "$pattern" ] || { echo "EMPTY"; return 0; }
  base="$(base_rev)"
  [ "$base" = NOBASE ] && { echo NOBASE; return 0; }
  # --no-renames：git 預設開 rename detection，改名只列新路徑。scope 內的檔搬到 scope 外時
  # 舊路徑會漏掉，該層沿用舊綠燈。關掉後改名拆成「刪舊＋加新」，兩條路徑都進指紋。
  files=$(
    { git -c core.quotePath=false diff "$base" --name-only --no-renames 2>/dev/null || true
      git -c core.quotePath=false ls-files -o --exclude-standard 2>/dev/null || true
    } | sort -u | grep -E "$pattern" 2>/dev/null || true
  )
  [ -n "$files" ] || { echo "EMPTY"; return 0; }
  printf '%s\n' "$files" | while IFS= read -r f; do
    if [ -f "$f" ]; then
      printf '%s %s\n' "$f" "$(git hash-object "$f")"
    else
      printf '%s DELETED\n' "$f"
    fi
  done | git hash-object --stdin | cut -c1-12
}

# L2（gate）要不要跑：判準從 .husky/pre-push 抽，不在這裡抄第二份。
# 抽不到（hook 被改名或改寫）就保守回答「要跑」，不靜默放行。
l2_should_run() {
  hook=".husky/pre-push"
  [ -f "$hook" ] || { echo yes; return 0; }
  skip=$(sed -n "s/^SKIP_PATTERN='\(.*\)'\$/\1/p" "$hook" | head -1)
  force=$(sed -n "s/^FORCE_TEST_PATTERN='\(.*\)'\$/\1/p" "$hook" | head -1)
  [ -n "$skip" ] || { echo yes; return 0; }
  base="$(base_rev)"
  [ "$base" = NOBASE ] && { echo yes; return 0; }
  # 必須與 scope_fp 用同一套 union：未追蹤的新檔（/feature-to-ui 剛產出、還沒 git add 的頁面）
  # 只看 git diff 是看不到的，會讓 gate 被靜默略過，然後在 push 時才炸 —— 那正是要消滅的情況。
  # --no-renames 也要一致（理由見 scope_fp）：改名的舊路徑可能正好命中 FORCE_TEST_PATTERN。
  changed=$(
    { git -c core.quotePath=false diff "$base" --name-only --no-renames 2>/dev/null || true
      git -c core.quotePath=false ls-files -o --exclude-standard 2>/dev/null || true
    } | sort -u
  )
  [ -n "$changed" ] || { echo no; return 0; }
  # 抽出來的字串必須是合法 ERE。無效 pattern 會讓 grep 失敗、remain 變空 → 靜默回 no（略過 gate）。
  # 例如有人在 SKIP_PATTERN 那行尾加了含 * 或 [ 的註解，貪婪 .* 會把註解一起吃進來。
  #
  # 判準是 exit code，不是「有沒有失敗」：grep 對「合法 pattern + 空輸入」回 1（沒比對到），
  # 只有「非法 regex」才回 2。把 1 也當失敗的話這個函式會恆回 yes，對齊機制形同虛設。
  if ! ere_ok "$skip"; then echo yes; return 0; fi
  if [ -n "$force" ]; then
    if ! ere_ok "$force"; then echo yes; return 0; fi
    if printf '%s\n' "$changed" | grep -qE "$force" 2>/dev/null; then echo yes; return 0; fi
  fi
  remain=$(printf '%s\n' "$changed" | grep -vE "$skip" 2>/dev/null || true)
  if [ -n "$remain" ]; then echo yes; else echo no; fi
}

ensure_ledger() {
  mkdir -p "$DIR"
  br="$(current_branch)"; base="$(base_rev)"
  if [ -f "$LEDGER" ]; then
    old_br=$(awk -F'\t' '$1=="branch"{print $2}' "$LEDGER" | head -1)
    old_base=$(awk -F'\t' '$1=="base"{print $2}' "$LEDGER" | head -1)
    # 換了分支或 base 動了（rebase／main 前進）-> 整份作廢，不沿用任何綠燈
    [ "$old_br" = "$br" ] && [ "$old_base" = "$base" ] && return 0
  fi
  { printf 'branch\t%s\n' "$br"; printf 'base\t%s\n' "$base"; } > "$LEDGER"
}

cmd_plan() {
  ensure_ledger
  printf '本輪 ledger：%s → %s\n' "$(current_branch)" "$(default_branch)"
  for layer in L1 L15 L3 L4 L5 AC; do
    fp="$(scope_fp "$layer")"
    if [ "$layer" = AC ]; then
      scope_hit=yes
    elif [ "$fp" = EMPTY ]; then
      scope_hit=no
    else
      scope_hit=yes
    fi
    rec=$(awk -F'\t' -v l="$layer" '$1==l{print $2"\t"$3}' "$LEDGER" | tail -1)
    old_status=$(printf '%s' "$rec" | cut -f1)
    old_fp=$(printf '%s' "$rec" | cut -f2)
    if [ "$scope_hit" = no ]; then
      printf '  %-4s ⊘ 略過（本次改動未觸及此層 scope）\n' "$layer"
    elif [ "$fp" = NOBASE ]; then
      # 算不出 base 時兩輪都會是 NOBASE，比對會誤判成「內容未變」。一律重跑。
      printf '  %-4s ● 要跑（算不出 merge-base，不沿用任何綠燈）\n' "$layer"
    elif { [ "$old_status" = green ] || [ "$old_status" = skipped ]; } && [ "$old_fp" = "$fp" ]; then
      printf '  %-4s ✓ 沿用上輪結果：%s（內容未變，fp=%s）\n' "$layer" "$old_status" "$fp"
    else
      printf '  %-4s ● 要跑（fp=%s）\n' "$layer" "$fp"
    fi
  done
  if [ "$(l2_should_run)" = no ]; then
    printf '  L2   ⊘ 略過（判準取自 .husky/pre-push）\n'
  else
    l2fp="$(scope_fp L2)"
    # 第 5 欄是 mark 的第 4 個參數。L2 的 green 只在它等於 full（dev 全量）時才沿用：
    # 定向綠（targeted）只代表選集，fp 相同也不算 gate 已驗，一律要跑。
    l2rec=$(awk -F'\t' '$1=="L2"{print $2"\t"$3"\t"$5}' "$LEDGER" | tail -1)
    l2st=$(printf '%s' "$l2rec" | cut -f1)
    l2old=$(printf '%s' "$l2rec" | cut -f2)
    l2how=$(printf '%s' "$l2rec" | cut -f3)
    if [ "$l2fp" = NOBASE ]; then
      # 同上方各層：算不出 base 時兩輪都是 NOBASE，比對會誤判成「內容未變」
      printf '  L2   ● 要跑（算不出 merge-base，不沿用任何綠燈）\n'
    elif [ "$l2old" = "$l2fp" ] && { [ "$l2st" = skipped ] || { [ "$l2st" = green ] && [ "$l2how" = full ]; }; }; then
      printf '  L2   ✓ 沿用上輪結果：%s（內容未變，fp=%s）\n' "$l2st" "$l2fp"
    elif [ "$l2old" = "$l2fp" ] && [ "$l2st" = targeted ]; then
      printf '  L2   ● 要跑（上輪只跑定向、尚未 dev 全量；fp=%s）\n' "$l2fp"
    else
      printf '  L2   ● 要跑（fp=%s；diff 未被 pre-push SKIP_PATTERN 全數濾掉）\n' "$l2fp"
    fi
  fi
  rounds=$([ -f "$ROUNDS" ] && awk -F'\t' '{c++} END{print c+0}' "$ROUNDS" || echo 0)
  if [ "$rounds" -gt 0 ]; then printf '  修正輪次：全域 %s / 4\n' "$rounds"; fi
}

# fp 必填，而且必須是「跑那一層之前」取的快照。
# 不可在這裡現算：L2/L3/L5 是併行跑的，等它們回來時 fixer 可能已經改過檔，
# 現算會把「綠燈」記到一份從沒被那層檢查過的內容上 —— 那就是假綠。
cmd_mark() {
  ensure_ledger
  layer="$1"; status="$2"; fp="${3:-}"; reason="${4:-}"
  if [ -z "$fp" ]; then
    {
      echo "拒絕記錄：缺少 fp 參數。"
      echo "指紋要在跑那一層【之前】取，不能事後補算——併行的 fixer 可能已經改過檔，"
      echo "事後算會讓綠燈蓋在從沒被檢查過的內容上。"
      echo "正確用法：FP=\$(ledger.sh fp L1) && npm run eslint && ledger.sh mark L1 green \"\$FP\""
    } >&2
    exit 1
  fi
  # L2 的綠燈只認 dev 全量（/vibe-check --full）。定向綠（煙霧＋選集）只代表選集，
  # 記成 green 會讓 plan 沿用、/ship 跳過必跑的全量——所以 green 要由呼叫端明說是 full，
  # 定向跑完要留紀錄就記 targeted，plan 永遠不沿用它。
  if [ "$layer" = L2 ] && [ "$status" = green ] && [ "$reason" != full ]; then
    {
      echo "拒絕記錄：L2 green 必須標明是 dev 全量。"
      echo "定向綠（煙霧＋選集）不算 gate 已驗，記成 green 會讓 plan 沿用、/ship 跳過必跑的 /vibe-check --full。"
      echo "正確用法：ledger.sh mark L2 green \"\$FP\" full     # /vibe-check --full 綠燈"
      echo "          ledger.sh mark L2 targeted \"\$FP\"      # 定向綠：只留紀錄，plan 不沿用"
    } >&2
    exit 1
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$layer" "$status" "$fp" "$(date +%Y-%m-%dT%H:%M:%S)" "$reason" >> "$LEDGER"
  printf 'marked %s=%s fp=%s\n' "$layer" "$status" "$fp"
}

# 輪次帳。上限規則靠對話記憶撐不住（session compact 後就沒了），存進 ledger 才算數。
# 計數刻意不依分支過濾：上限是安全閥，切分支重開一個 key 就能繞過就失去意義。
# 分支欄位只留著供診斷（見下方寫入行），不參與判定。
# 計數單位是「一趟 /ship」：歸零只靠 close（送出完成時呼叫；停點停下時交給使用者決定），切分支、fresh、compact 都不歸零。
# 沒有 close 的話 rounds.tsv 只增不減，同一個工作目錄累計滿 4 輪後 /ship 的自動修永久失效（issue #154）。
cmd_round() {
  ensure_ledger
  mkdir -p "$DIR"; [ -f "$ROUNDS" ] || : > "$ROUNDS"
  key="$1"; br="$(current_branch)"
  n=$(awk -F'\t' -v k="$key" '$2==k {c++} END{print c+0}' "$ROUNDS")
  n=$((n + 1))
  total=$(awk -F'\t' '{c++} END{print c+0}' "$ROUNDS")
  total=$((total + 1))
  printf '%s 第 %s 輪（全域第 %s 輪）\n' "$key" "$n" "$total"
  # 用 if 而不是 `[ ] && { }`：後者在 set -e 下的行為隨 shell 實作而異（bash vs dash），
  # 這支腳本會在 Docker／CI 裡跑，不要賭。
  if [ "$n" -gt 2 ]; then
    echo "⛔ $key 已達 2 輪上限，禁止第 3 輪同法重試——停下來交還使用者" >&2
    exit 2
  fi
  if [ "$total" -gt 4 ]; then
    echo "⛔ 全域已達 4 輪上限——停下來交還使用者" >&2
    exit 2
  fi
  # 通過檢查才記帳：被擋下的那次若也寫進去，重試同一個指令會一直灌水消耗預算
  printf '%s\t%s\t%s\n' "$br" "$key" "$(date +%Y-%m-%dT%H:%M:%S)" >> "$ROUNDS"
  exit 0
}

case "${1:-}" in
  fp)     shift; scope_fp "${1:?usage: ledger.sh fp <layer>}" ;;
  snapshot) ensure_ledger; for l in L1 L15 L2 L3 L4 L5 AC; do printf '%s=%s\n' "$l" "$(scope_fp "$l")"; done ;;
  plan)   cmd_plan ;;
  mark)   shift; cmd_mark "${1:?layer}" "${2:?status}" "${3:-}" "${4:-}" ;;
  round)  shift; cmd_round "${1:?usage: ledger.sh round <key>}" ;;
  close)  if [ -f "$ROUNDS" ]; then mv "$ROUNDS" "$ROUNDS_PREV"; echo "輪次帳已歸零（上一趟留在 $ROUNDS_PREV 供診斷）"; else echo "本趟沒有修正輪次，無需歸零"; fi ;;
  fresh)  rm -f "$LEDGER"; echo "ledger 已作廢，下輪全部重跑（輪次上限不受影響，那是安全閥不是快取）" ;;
  l2)     l2_should_run ;;
  *)      sed -n '2,18p' "$0"; exit 1 ;;
esac
