// 凍結區門鎖（PreToolUse hook）
// 政策：凍結路徑內「修改既有檔」一律擋下（exit 2）；「建立全新檔」放行。
// 涵蓋面：
// - Edit/Write/NotebookEdit：比對 file_path（NotebookEdit 用 notebook_path）
// - Bash：解析 command，段內比中凍結路徑＋寫入類動詞或重導向目標即視為寫入
//   （不細分 source/dest，寧可誤擋不可漏放；唯讀操作不受影響）
// darwin 檔案系統大小寫不敏感 → 比對前兩側 toLowerCase；目標已存在時先
// realpathSync 解 symlink 再比對，繞道 symlink 一樣被擋。
// 授權通道：正規產出流程（flow 覆寫、spec 全量重生）經使用者確認後，先寫
// .claude/tmp/frozen-allow.json（{ reason, files: [<repo 相對路徑>] }），
// hook 比中一次即從清單移除（清空刪檔），其餘情況照擋。
// 為什麼用 hook 不用 rules/frozen-paths.md：paths 觸發規則在 subagent 內不注入
//（2026-07-06 實測），只有 hook 對主對話與所有 subagent 都生效。
//（2026-11-04 複測：同目錄下含 subagent 仍擋；跨 worktree 見下方 2026-11-05 issue #199 修法）
//
// 維護規則：發現新繞道就在下方按日期補一段（繞道方式＋修法），修補後保留紀錄不刪；
// 回歸測試見 test/unit/frozen-paths-guard.spec.ts。rules/frozen-paths.md 只講政策，不重抄這裡。
//
// 2026-08-24（issue #129）：`perl -pi`／`ruby -i` 等就地改檔工具不在寫入判斷內（原判斷寫死 sed），
// 可繞過 guard 改凍結區既有檔。修法：INPLACE_TOOLS／INPLACE_FLAG 通用判斷涵蓋 sed／perl／ruby／gsed。
//
// 2026-09-08（issue #137）：補直譯器（python/node/ruby/perl/php/deno/bun/tsx/ts-node/vite-node）
// 繞道——上面的逐段判斷以 `\n` 切段，heredoc 把「直譯器在首行、寫入 API 在後續行」拆成
// 兩段各自看都不像寫入，會漏放（且漏放不經過 tryConsumeSentinel，sentinel 不會被消耗）。
// 修法：對「整條指令」（不切段）另外判斷——任一處出現直譯器詞、且該語言的寫入 API
//（SCRIPT_WRITE_API）被實際呼叫時才觸發。此防線與既有逐段防線（sed/tee/cp/mv、redirect、
// git）並存、互不取代。
//
// 對抗審查一輪回饋（同日）：初版「命中即整條指令 flood」誤攔過廣——凍結區檔案只是被
// `git diff`／`cat`／`open()` 唯讀讀取、寫入目標其實在別處時，也會被當成寫入擋下（SDD
// 管線常見寫法：讀 flow/feature 產出 route-map／型別）。修法：SCRIPT_WRITE_API 每一項
// 都拆成 { detect, capture } 一對——capture 在寫入呼叫的目標引數是字面字串時把它擷取出
// 來，只有那些路徑才算寫入目標（rename／move 兩個引數都算，搬走等同刪掉來源）；capture
// 抓不到字面值（引數是變數、`os.path.join(...)` 等運算式）時才對該次呼叫回退成「整條指令
// flood」（把指令中所有比中凍結路徑的 token 都當寫入目標，寧可誤擋）。
//
// 對抗審查二輪回饋（同日）：切段不認引號（`sed -i '' 's/a/b/;s/c/d/' <凍結檔>` 被 `;`
// 切散）、`<<` 位元左移被當 heredoc、heredoc 內文的散字被當寫入動詞、`,'w')` 形狀誤攔。
// 修法：切段時忽略引號內的分隔符；heredoc 終止符必須緊接 `<<`；動詞只認「指令位置」的 token；
// open 類 detect 加上「第一引數是路徑樣或識別字」的語境條件。同輪另補：open() 的 mode 後接
// `encoding=` 等引數時判不出寫入（mode 後允許 `[,)]`）；renameSync／rmdirSync／fs.truncate／os.symlink
// 等 API 漏列（補齊清單；rename／move 兩個引數都當目標，copy 只算目的地）；mode 字元類用無界量詞
// 會 ReDoS（改有界量詞，80KB 惡意輸入實測 80–120ms）。
//
// 對抗審查三輪回饋（同日）：`open('$p','w')`（shell 變數包在引號內）被當字面值抓走而漏放；
// 反過來，API 名只是被「提及」（grep 樣式 `"createWriteStream("` 未閉合引號、commit 訊息裡的
// `writeFileSync(...)`）時 capture 抓不到，被誤判成動態呼叫而 flood。修法：含 `$` 的引號字串
// 不算字面值（走 flood）；detect 命中後還要過 CALL_ARG——第一引數得是閉合的引號字串或
// 識別字／$變數／運算式開頭，否則只算提及、不算呼叫。
//
// 2026-09-11（PR #141 Copilot review 第 1、2、4、6 輪）：①heredoc 內文固定併給該行最後一段，
// `patch -p1 <<'EOF' && echo done` 的內文歸到 echo 段而漏放 ②`<< EOF`（<< 後接空白）不被認成
// heredoc ③`Path(...).open('r+')` 只認 `['"][wax]` 漏掉 r+ ④單一 `&` 不切段，`echo hi & tee <凍結檔>`
// 的 tee 不在指令位置。修法：內文歸「含 << 開啟符的那一段」（heredocTerminators 與 splitSegments
// 同一套引號感知）；`<<-?\s*` 放寬空白（終止符仍限識別字開頭，`1 << 8` 不受影響）；Path.open 的
// mode 改共用 MODE；單一 `&` 也當分隔符（`>&`／`<&`／`&>`／`&>>` 這類 fd 重導向除外）。
// 另排除 here-string `<<<`（不算 heredoc 開啟符）。四案由 it.fails 轉回正常 it，見
// test/unit/frozen-paths-guard.spec.ts。
//
// 2026-09-11（PR #141 Copilot review 後續輪，使用者裁決後修）：①MODE 缺 't'，Python 的
// 'wt'／'at' 文字寫入模式漏放 ②OPEN_ARGS 上限 120 太小，第一引數稍長的合法運算式會讓整個
// open() 呼叫對 hook 隱形 ③OPEN_FIRST_ARG 把數字當識別字，`open(1,'w')` 這種 fd 寫入誤判成
// 動態呼叫，flood 誤擋同指令內單純被提及的凍結路徑 ④HEREDOC_OPEN 終止符限定識別字開頭，
// 數字終止符 `<<1` 判不出來 ⑤重導向偵測只認 `>`／`>>`，`>&`（stdout/stderr 一起導檔）漏放
// ⑥⑦`commandVerbs()`／`gitWriteSubcmd()` 都只認 wrapper 後緊接的下一個 token 當子指令，
// `sudo -u alice rm`、`git --work-tree /tmp checkout` 這類「wrapper 帶了一個吃值的選項」
// 會把真正的動詞／子指令往後推而漏放。修法：MODE 的 't' 只放進兩側可選字元類（不影響
// [wax+] 必要判斷，'rt' 仍不算寫入）；OPEN_ARGS 上限放寬到 2000（仍有界，ReDoS 風險不變）；
// OPEN_FIRST_ARG 第二分支改 `[^\d\W]`（排除開頭數字）；HEREDOC_OPEN 拆成數字／識別字兩分支；
// 重導向 regex 加 `>&`／`&>`／`&>>`；`commandVerbs()`／`gitWriteSubcmd()` 都改成先跳過吃值旗標
// （WRAPPER_VALUE_FLAGS／GIT_VALUE_FLAGS，只收斂 sudo／env／git 實際會用到的旗標，不窮舉）
// 再找子指令位置。
//
// 2026-09-11（PR #141 Copilot review round 13，使用者裁決後修）：①上一輪的數字 heredoc
// 終止符（`<<1`）會誤判 `$((1<<1))` 這種算術展開，把換行後真正的寫入指令吞成「heredoc 內文」
// 而漏放——這是上一輪修補的迴歸，不是新發現的獨立繞道 ②`WRAPPER_VALUE_FLAGS` 沒收 xargs
// 的 `-I`，`xargs -I {} rm <凍結檔>` 的 `{}` 被誤判成子指令，`rm` 判不出來。修法：
// `heredocTerminators()` 加追蹤 `$(( ))`／`(( ))` 括號深度，深度 >0 時的 `<<` 一律不當
// heredoc 開啟符；`WRAPPER_VALUE_FLAGS` 補上 `-I`／`--replace`。
//
// 2026-09-11（PR #141 收尾，使用者裁決「只修誤擋、其餘列已知極限」）：直譯器偵測原本對整條指令
// 所有 token 掃，grep 搜尋樣式裡的 `"node …"`、寫進文件的 heredoc 內文提到 python3，都會被當成
// 真的在跑直譯器而誤擋唯讀／寫到別處的指令。修法：hasScriptInterpreter 改成只認指令位置的 token
// （commandVerbs 同一套判準）、只看 heredoc 開啟行；npx／pnpx／bunx 補進 COMMAND_PREFIX 讓
// `npx tsx -e` 的 tsx 仍算指令位置。寫入 API 的比對維持整條指令掃。
//
// 2026-09-24（issue #154，下游 jwl-2026-frontend 同步時 /code-review 發現）：上面 PR #141 收尾把
// 直譯器偵測收斂到指令位置後，`timeout 10 rm`、`nice rm`、`exec rm`、`! rm`、`stdbuf -o0 tee` 加凍結檔
// 全部漏放——前綴不在 COMMAND_PREFIX，後面的動詞判不成指令位置。修法：timeout／nice／exec／stdbuf 補進 COMMAND_PREFIX，`!` 由 isCommandPosition 遞迴判斷：`!` 本身在指令位置時
// 其後才算指令位置（放進 COMMAND_PREFIX 會把 `find … ! -name tee` 誤擋，只認段首又漏放 `time ! rm`）；
// 只對單一 wrapper 吃值的旗標（nice -n、timeout -s、stdbuf -o…）另列 WRAPPER_OWN_VALUE_FLAGS，
// 不併進共用表（sudo 的 -n／-s／-i 不吃值，併進去反而漏放 `sudo -n rm`）；timeout 的時限位置參數
// 由 WRAPPER_POSITIONALS 跳過。
//
// 2026-09-29（issue #164，下游 jwl-2026-frontend 同步 73202fd 時 Copilot review 發現）：前綴判斷
// （isCommandPosition／commandVerbs／skipWrapperFlags 查表）用原始 token 比對 COMMAND_PREFIX，只有動詞本身
// 有 baseName()。`/usr/bin/timeout 10 rm`、`/usr/bin/nice rm`、`/usr/bin/stdbuf -o0 tee`、`/usr/bin/env rm` 加
// 凍結檔全部漏放（`/bin/rm` 會擋是因為動詞那一層有正規化）。同一層的同類寫法：`/usr/bin/env python3 -c`
// （直譯器判不成指令位置）、`\rm`（跳過 alias 的反斜線）、`bash -lc`／`sh -ec`（-c 併進其他旗標）、`eval "rm …"`。
// 修法：prefixOf() 統一取正規化詞（baseName 去路徑與開頭 `\`；緊接 shell 之後的 `-[a-z]*c` 視同 `-c`），
// 三處前綴判斷都改走它；eval 補進 COMMAND_PREFIX。同輪列為已知極限（第 26–29 條）：`$(which rm)`、
// `find <凍結目錄> -delete`、`rsync`／`install` 寫入、找檔管線接 xargs 寫入（另案 #165；第 29 條已於 #165 改寫）。
//
// 2026-09-29（issue #165）：找檔管線接 xargs 寫入（`grep -l x <凍結目錄>/*.ts | xargs sed -i …`、
// `ls <凍結目錄>/*.ts | xargs rm`）全部漏放——凍結路徑在上游段、寫入動詞在下游段，逐段判斷兩邊都不像寫入。
// 修法：splitPipelineSegments() 多記「這段是否由單一 `|` 接上」；同一條管線內，下游段的指令位置有 xargs、
// 且該段有寫入動詞（xargsWrites）時，把上游各段比中的凍結 token 都當寫入目標。只認 xargs：它是把
// stdin 轉成引數的那一步，`cat <凍結檔> | tee /tmp/x` 的 tee 寫的是自己的引數，不受影響。
// 對抗審查一輪回饋（同日）：①xargs 的吃值旗標（`-n 1`、`-P 4`、`-d x`…）不在 WRAPPER_OWN_VALUE_FLAGS，值被當成
// 子指令而漏放 ②`|&` 的 & 又被當成單一 & 切段，管線斷掉而漏放 ③沿用 hasWriteVerb 會把 `xargs grep -in sed`
// 誤當寫入。修法：補 xargs 吃值旗標表；切段時 `|&` 整個當管線符號；改用只看指令位置的 xargsWrites()。
// 對抗審查二輪回饋（同日）：①xargsWrites 的 git 分支沒看指令位置，`xargs grep -l "git checkout"` 被誤擋
// ②旗標表缺 BSD 的 -J／-S，`xargs -J % rm %` 漏放。修法：git 分支加上「git 在指令位置」條件；表補 -J、-S。
//
// 2026-11-05（issue #199）：repo root 原本一律取 CLAUDE_PROJECT_DIR，從主目錄 session 改另一個 git worktree 的
// 凍結檔時，Edit 的路徑解成 `../<worktree>/spec/…` 比不中；Bash 的絕對路徑同樣比不中（相對路徑靠子字串比對
// 會擋，但「既有檔」改查主目錄，碰巧主目錄沒有同名檔就放行）。2026-11-04 在 issue-193 worktree 實測：分身 Edit、
// 主線 Edit、主線絕對路徑 Bash 全部成功寫入。修法：目標對 target-root.mjs 列出的每個候選 root（同 repo 的
// worktree＋專案目錄）取相對路徑，任一個比中就擋；目標連同比中的 root 一起帶到既有檔判斷與 sentinel——sentinel
// 讀那個 worktree 自己的 `.claude/tmp/frozen-allow.json`。相對路徑改以 hook 輸入的 `cwd` 為基準（session cd 過、
// 或 isolation 分身的工作目錄在巢狀 worktree 時，不能再拿專案目錄解析）。不採「路徑任一段落命中凍結清單」：
// 那會把 `/tmp/x/spec/e2e-flows` 這類與本專案無關的路徑也擋下。
// /code-review 一輪回饋（同日）：初版「往上找最近的 `.git` 當 root」會被凍結目錄底下的 `.git`（submodule 或 AI
// 自己新增的檔）蓋掉、改成放行，且會誤擋無關 repo 的同名路徑。修法：只收同 repo 的 worktree，專案目錄永遠是候選。
// /ship L5 /code-review 回饋（同日）：①`cd ../wt && rm <凍結檔>`、`git -C ../wt rm <凍結檔>` 的相對路徑仍對 session 目錄
// 解析而漏放 ②目標不存在（glob、新檔）時不解 symlink，經 symlink 寫入判成在專案外。修法：bashFrozenWrites 追蹤字面的
// cd／git -C（已知極限第 33 條）；路徑改用 realpathLoose（解最近存在的祖先）。
// 第 2 輪：①`git -C` 的目錄被套到整段，`git -C ../wt log > <主目錄凍結檔>` 的重導向改對 ../wt 解析而漏放（第 1 輪的迴歸）
// ②直譯器防線在迴圈後用起始目錄，`cd ../wt && python3 -c "open(<凍結檔>,'w')"` 漏放 ③`cd -P`／`cd --`／`builtin cd` 追蹤不到
// ④`grep git -C 2` 的 -C 被當成 git 換目錄。修法：解析基準改成參數（不再改模組變數）；git -C 段對 cd 基準與 -C 目錄
// 各解析一次、兩邊都算，重導向只用 cd 基準；直譯器防線對所有出現過的基準都試；cd 跳過旗標；git 必須在指令位置。
// 第 1 輪曾把「子字串比對猜的 root」與精確定位同 rel 的目標去重，第 2 輪發現會丟掉另一個 worktree 的目標，已撤回：
// 兩筆都保留、兩處都要授權（寧可誤擋）。
// 第 3 輪（使用者多給一輪複審）：①cd 目標不存在（打錯字、cd 失敗）或被誤判（`grep -c cd <凍結檔>` 的 cd 被當指令），基準
// 換到不存在的位置後，主目錄自己的凍結檔反而漏放——第 2 輪的迴歸 ②`timeout 10 git -C ../wt rm` 等 wrapper 後的 git 不套 -C
// ③多個 -C 只認第一個。修法：基準只增不減（cd 後對前後所有基準都解析），保證不比沒有 cd 追蹤時少擋；cd／-C 只認既有目錄；
// git 的判定改走 commandVerbs；-C 依序疊加。
//
// 2026-11-06（issue #206）：Copilot 對 PR #205 的 review 在合併前 1 分鐘送達、當時未處理，指出三個洞：①`git -C../wt rm <凍結檔>`（-C 與目錄黏連）
// 不追蹤 ②worktree 路徑含空白時，`echo x >> "<絕對路徑>"`、`rm "<絕對路徑>"` 被 tokenize 與重導向擷取在空白處截斷，
// 後半段只剩相對路徑、改查專案目錄而漏放 ③`git init --separate-git-dir` 的主工作區沒有 commondir，target-root.mjs
// 認不出它與 linked worktree 同 repo，兩邊互改都放行。修法：gitChdir 認 `-C<dir>`；路徑比對多加一份引號感知的
// shellWords（與 tokenize 並用，照 shell 規則處理引號、`\ ` 跳脫與相鄰片段相接），重導向目標也由它補取（原 regex 保留）；
// gitCommonDir 沒有 commondir 時以 gitdir 本身當共用目錄。
// /ship L5 /code-review 回饋（同日，使用者裁決順帶修）：④`cd "/a b"`、`git -C '/a b'` 含空白的換目錄不追蹤 ⑤`dd of=/<其他 worktree>/…`
// 這類 `=` 後接絕對路徑的 token 走子字串比對，root 猜成 session 目錄而漏放（#199 就有，與空白無關）。修法：cd／git -C 對
// tokenize 與 shellWords 兩種拆法都判；frozenRelOf 在子字串比對前，先對每個 `=` 後面的值（相對或絕對路徑）精確定位
//（第 2 輪補上相對路徑 `of=../wt/…` 與第二個 `=` 之後的 `--define=out=/wt/…`）。
// PR #207 Copilot review 與每輪本地覆審（同日）：⑥`git -C "" -C../wt`（shellWords 保留空字串維持旗標對位；空字串在 frozenRelOf
// 入口濾掉，否則解析成 base 本身、cwd 在凍結目錄時整個目錄被誤擋）⑦直譯器 flood 改收各段與 heredoc 內文逐行的 shellWords 字，
// 內文另依引號切段（三引號跨行的路徑行）⑧寫入動詞與 xargs 下游也看 shellWords 的拆法（`xargs -I "x y" rm`、`xargs -0 git -C "/a b" rm`）；
// git 子指令在 shellWords 認得出 git 時以它為準，`git -C "/a rm" status` 不再誤擋 ⑨frozenRelOf 整個 token 與各 `=` 值「既有目標
// 優先」，都不存在時仍試子字串比對（cwd 在凍結目錄時 `of=<別的 worktree>`、`"$WT/<凍結檔>"`）；`~/…` 與 `of=~/…` 展開 ⑩server-security-guard
// 保留每個候選 root 的 `server/` 命中，`server/api/x/.git` 偽造 gitdir 不再讓內層 root 蓋掉外層 `server/api/`；第 3 次 review 補成
// 每個 `server/api/` 命中各偵測一次 ⑪heredoc 內文逐行的 shellWords 字也收進該段路徑候選（`xargs rm <<'EOF'` 內文是含空白的路徑）。
//
// 已知極限（本 hook 是純文字靜態解析，非執行期分析，以下手法擋不住）：
//   1. 先把腳本寫到 /tmp 等非凍結路徑，再另開一條指令執行該腳本檔
//   2. 腳本檔案本身帶 shebang、直接以 `./script.py` 執行（指令原文看不到直譯器詞）
//   3. 指令或腳本內容先 base64／其他編碼再解碼執行
//   4. 動態組出函式名（如 `getattr(p, 'write' + '_text')`）
//   5. 路徑拆成兩段、用 shell 變數組回（如 `T=test/e2e; python3 -c "open('$T/specs/x','w')"`）
//   6. 路徑或 API 名由運算式組出（f-string、`Path(dir) / name`、字串拼接）——capture 抓不到
//      字面值時雖會退回 flood，但路徑本身沒有以字面值出現在指令原文時，flood 也無從比中
//   7. 引號內含 shell 分隔符時只認成對的單／雙引號（涵蓋常見 sed／perl 形式）；跳脫引號
//      （`\'`、`printf "a\"b"`）、`$'...'`、巢狀引號等變體仍可能被誤切段；shellWords 也不認 `$'...'`（`rm $'/a b/…'` 拆成
//      `$/a b/…`，不算絕對路徑）（issue #206 /code-review）
//   8. `vim -es`／`emacs --batch`／`awk -i inplace` 這類編輯器不在 WRITE_VERBS／INPLACE_TOOLS 內
//   9. flood 命中時擋出來的是「指令原文裡比中凍結路徑的 token」，可能是目錄或 glob 字串而不是檔案；
//      要走 sentinel 授權時，files 要照 hook 訊息列出的字串填（是目錄或 glob 字串就照那個字串填）
//  10. `tool_input.command` 不是字串（缺欄位或型別不對）時直接放行
//  11. fail-open 設計：hook 內部 throw 時 node 以 exit 1 結束，Claude Code 視同非阻斷
//      （寧可放行，不讓鎖壞掉癱瘓所有編輯）
//  12. 含 `$` 的引號字串只在 open() 系列的 capture 被排除；renameSync／writeFileSync／shutil.* 等
//      其他 API 的 capture 仍把 '$p' 當字面值路徑，`p=<凍結檔>; node -e "…renameSync('$p',…)"` 會漏放（2026-09-08 回歸實測）
//  13. heredoc 數字終止符（`<<1`）只在緊接 `<<`（無空白）時才被認出；`<< 1`（`<<` 與數字終止符
//      間有空白）目前仍判不出來，是刻意窄化——放寬空白會讓 `1 << 8` 這種位元左移誤判成 heredoc
//
// 以下 14–23 是 PR #141 Copilot review 抓出、經使用者裁決「不修、列為已知極限」的形狀（2026-09-11）。
// 理由：本 hook 防的對象是 Claude 自己（主對話或 subagent 沒讀到規則、順手改了凍結檔），
// 不是刻意繞道的攻擊者；Claude 想改檔用的是 Edit 工具、sed -i、tee、cat >、patch、open(…,'w')、
// writeFileSync，這些全都擋住了。下列形狀是「知道有 guard、故意要繞」才會寫的，而第 1–3 條
// 早已說明刻意繞道三秒就能做到，再堵這些也不會讓 hook 變成防線。
//  14. SCRIPT_INTERPRETERS 認得 php／deno／bun，但 SCRIPT_WRITE_API 沒有這三種語言的寫入 API
//      （file_put_contents／Deno.writeTextFile／Bun.write），等於這三種語言完全不設防
//  15. `os.open(path, os.O_WRONLY | os.O_TRUNC)` 用數字旗標而非 mode 字串，MODE 系列 regex 比不中
//  16. `Path(<凍結檔>).replace(dest)` 完全沒有對應規則（只有 `os.replace(`）；`Path(...).rename(dest)`
//      的接收端來源路徑也沒被 capture，但 detect 命中＋capture 少一個會退回 flood，端到端仍擋得住
//  17. optional chaining：`writeFileSync?.(…)` 這類 `?.(` 呼叫，所有 detect 都要求 API 名緊接 `(`
//  18. `open(path, mode)` 的 mode 是變數而非字面字串時，detect 整段比不中，連 flood 都不會觸發
//      （要堵得把「mode 是識別字」也算呼叫，代價是唯讀的 `mode='r'` 也會被 flood 誤擋）
//  19. `Path(os.path.join(…)).open('w')`：Path.open 的 detect 用 `[^)]*`，建構子引數含巢狀括號就提前收尾
//  20. `if rm <凍結檔>; then …`、`while`／`for`／`{ …; }` 等 shell 控制結構：關鍵字不在 COMMAND_PREFIX，
//      其後的動詞不算指令位置
//  21. heredoc 內文餵給 pipeline 下游寫入指令：`cat <<'EOF' | patch -p1`，內文歸給 `cat` 段、寫入的
//      `patch` 段拿不到路徑（直譯器路線不受影響：`cat <<'PY' | python3` 仍由整條指令掃 API 擋下）
//  22. `>|`（noclobber override）：splitSegments 先把 `|` 當管線切開，重導向 regex 也沒收 `>|`
//  23. 直譯器偵測只認指令位置後，仍有一種殘留誤擋：grep 樣式裡放了引號閉合的完整寫檔呼叫
//      （`grep -rn "writeFileSync('<凍結檔>','x')" . && node -v`），同一行又真的跑直譯器——寫入 API
//      刻意對整條指令掃（跨行 `python3 -c "` 要靠這個），這種形狀就分不出樣式與呼叫
//  24. COMMAND_PREFIX 未收的其他 wrapper（ionice、taskset、chrt、setsid、unbuffer、caffeinate 等）：
//      `ionice -c3 rm <凍結檔>` 仍漏放；只收 AI 實際常用的前綴，不求窮舉（issue #154）
//  25. 字串或參數裡提到「前綴＋寫入動詞＋凍結路徑」會誤擋（`git commit -m "nice rm <凍結檔>"`）：前綴判定只看
//      前一個詞，不檢查前綴本身在指令位置；sudo／env 早就如此，#154 加入新前綴後機率變高。只多擋不漏放，
//      根治會牽動 find -exec、bash -c 的判斷，另案處理（PR #160 review）
//  26. `$(which rm) <凍結檔>`、`` `which rm` <凍結檔> ``：動詞由命令替換算出，指令原文裡只有 which（issue #164）
//  27. `find <凍結目錄> -delete`：`-delete` 是 find 的內建動作，不是指令位置的動詞（`find … -exec rm {} \;` 有擋）（issue #164）
//  28. `rsync`／`install` 把檔案寫進凍結區：兩者不在 WRITE_VERBS，同第 24 條「只收 AI 實際常用的、不求窮舉」（issue #164）
//  29. 管線上游沒有字面凍結路徑的形狀（issue #165 只補「上游有字面路徑＋下游 xargs 寫入」）：
//      `git diff --name-only | xargs sed -i …`（路徑執行期才產生）、`… | while read f; do sed -i … "$f"; done`
//      （不是 xargs）仍漏放；`… | xargs sh -c 'rm "$0"'` 只在上游有字面凍結路徑時擋得住
//  30. 上游有凍結路徑、下游 xargs 的寫入目的地其實在別處時會誤擋（`ls <凍結目錄>/*.ts | xargs cp -t /tmp`）：
//      與 cp 不分 source／dest 的既有取捨一致，只多擋不漏放（issue #165）
//      另外 `-c` 在 COMMAND_PREFIX 裡，`grep -c rm <凍結檔>` 本來就會誤擋，管線版 `… | xargs grep -c rm` 同理
//      （`grep -c "git stash"` 也是）；根治要讓 -c 只在 shell 之後生效，牽動 bash -c／find -exec 判斷，另案
//  31. 反斜線續行（`ls <凍結目錄>/*.ts \⏎ | xargs rm`，連 `rm \⏎ <凍結檔>` 也是）與大括號群組（`{ rm <凍結檔>; }`、
//      `| { xargs rm; }`）：splitHeredocBlocks 先依換行切、`{` 不在 COMMAND_PREFIX，既有缺口，#165 對抗審查發現
//  32. 跨 worktree 判定（issue #199）只認「與 session 專案同一個 git repo 的 worktree 根目錄」：專案若放在 monorepo
//      子目錄，另一個 worktree 的目標會多一段子目錄前綴而比不中；別的 repo（含衍生專案）、不在 git repo 內的絕對路徑照舊不擋
//  33. 指令內換目錄（issue #199 /code-review，#206 補含空白目錄）：
//      (a) 只追蹤字面的 `cd <dir>`（之後各段對 cd 前後的基準都解析；含 `cd -P`、`builtin cd`、含空白的目錄）與 `git -C <dir>`
//          （只加給該段；含 `-C<dir>` 黏連與含空白的目錄）。`cd -`、`pushd`／`popd`、`cd "$VAR"`、CDPATH 不追蹤，仍照 cd 前的
//          基準判斷，不會比沒追蹤時少擋；其他工具的換目錄旗標（`make -C`、`npm --prefix`、`tar -C`）不處理
//      (b) 引號內的巢狀 shell（`bash -c '…'`）整串是同一段、shellWords 把它當一個字：段內 `cd ../wt && rm <凍結檔>` 的寫入只用
//          cd 前的基準；引號內再包一層含空白的路徑（`bash -c "rm '/a b/<凍結檔>'"`、`bash -c "echo x > '/a b/<凍結檔>'"`）
//          也漏放（tokenize 與重導向 regex 在空白處截斷）。只限「引號內再包含空白路徑」；引號內不含空白的仍擋
//      (c) 基準只增不減帶來誤擋：cd 到無關 repo 或 /tmp 後寫同名的相對路徑，仍會被當成本專案的凍結檔擋下（與第 32 條
//          「無關 repo 不擋」不一致，#199 之前就如此）
//  34. 比對前一律轉小寫（darwin 預設大小寫不敏感），在大小寫敏感的檔案系統（Linux、大小寫敏感的 APFS）上，含大寫的
//      既有凍結檔（`Login.flow.md`）會被判成「不存在＝新增」而放行；sentinel 比對同理。既有行為，#199 只是讓它也套到
//      其他 worktree（issue #199 /code-review 第 2 輪）
// 這些只能靠 Bash 權限策略或人審補位。
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { normalize, relative, resolve } from 'node:path'
import { candidateRoots, realpathLoose, sessionProjectRoot } from './target-root.mjs'

// 凍結清單以本陣列為準（一律小寫）；增刪時須同步 rules/frozen-paths.md（frontmatter paths + 表格）
const FROZEN = ['test/e2e/specs', 'spec/gherkin-feature', 'spec/e2e-flows']

// Bash 寫入類動詞：出現在「指令位置」且與凍結路徑同段即視為寫入
// patch／ed／ex 皆能就地改檔（patch -p1 直接套用；ed／ex 是行編輯器，非互動下用 script 或 stdin 一樣能寫檔）
const WRITE_VERBS = new Set(['tee', 'cp', 'mv', 'rm', 'ln', 'truncate', 'dd', 'patch', 'ed', 'ex'])
// 指令位置：段落第一個 token（段落已在 |、;、&&、|| 處切開）。
// 下列前綴後的第一個 token 一併視為指令位置，免得 `sudo rm <凍結檔>`、
// `find … -exec rm {} \;`、`bash -c "rm <凍結檔>"` 這類寫法因為動詞不在第一位而漏放。
// npx／pnpx／bunx 是套件執行器：直譯器偵測改成只認指令位置後，`npx tsx -e …` 的 tsx 要靠
// 這裡才會被算進指令位置（PR #141 review）。
// timeout／nice／exec／stdbuf 是 AI 自己跑指令時常加的前綴，#141 把動詞判定收斂到指令位置後
// 它們不在此表，`timeout 10 rm <凍結檔>` 這類寫法整段漏放（issue #154）。`!` 不放這裡，見 isCommandPosition。
// eval 把字串當指令跑，與 `bash -c` 同一條路（issue #164）。比對前一律先經 prefixOf() 正規化，帶路徑的 wrapper
//（`/usr/bin/env`）才進得了這張表。
const COMMAND_PREFIX = new Set(['sudo', 'env', 'time', 'command', 'nohup', 'xargs', 'npx', 'pnpx', 'bunx', 'then', 'do', 'else', '-exec', '-execdir', '-c', 'timeout', 'nice', 'exec', 'stdbuf', 'eval'])
// git 會改寫工作區檔案的子指令（git add/diff/log 等唯讀或只動 index 的不算）
const GIT_WRITE_SUBCMDS = new Set(['checkout', 'restore', 'apply', 'mv', 'rm', 'clean', 'stash'])
// 支援 -i／--in-place 就地改檔的串流編輯器與直譯器：帶 in-place 旗標時視為寫入。
// perl 的 -i 常與其他旗標黏在一起（-pi、-pe -i、-i.bak），ruby 同理；
// 註：2026-08-24 實測 perl -pi 曾繞過本 guard 改到凍結區的 flow/spec 註解，故補上。
const INPLACE_TOOLS = new Set(['sed', 'perl', 'ruby', 'gsed'])
// 不忽略大小寫：就地改檔旗標一律小寫慣例（-i、-pi、-i.bak、--in-place），
// 忽略大小寫會讓 perl -Ilib（include path，純讀取）之類的大寫旗標被誤判成寫入。
const INPLACE_FLAG = /^-(?!-)[a-z]*i|^--in-place/

// 腳本直譯器：比對 token 去路徑前綴後的最後一段（如 /usr/bin/python3.11 → python3.11）。
// 含版本號變體（python3.11）與本 repo node_modules/.bin 常見的 tsx／ts-node／vite-node。
const SCRIPT_INTERPRETERS = /^(?:python\d*(?:\.\d+)?|node|ruby|perl|php|deno|bun|tsx|ts-node|vite-node)$/

// 寫入模式字串（'w'、'a'、'x'、'r+'、'wb'、'wt'…）。字元類一律用有界量詞：無界的
// [rwaxbt+]* 兩側夾一個 [wax+] 會在長字串上回溯爆炸（ReDoS）。
// 不可簡化成 [rwaxbt+]+ —— 那會把 'r'／'rb'／'rt' 這種唯讀模式也當成寫入。
// 't' 只是文字模式修飾字，本身不代表寫入，所以只出現在兩側的可選字元類，不在必要的
// [wax+] 裡——否則 'rt'（純讀文字模式）會被誤判成寫入（PR #141 review）。
const MODE = `['"][rwaxbt+]{0,3}[wax+][rwaxbt+]{0,3}['"]`
// open() 第一引數的語境條件：路徑樣字面值（含 / 或 .）、含 shell 變數的字串（'$p'、"${p}"）、
// 或以識別字／下標起頭的運算式（變數、os.path.join(...)）。
// 純短字串（print('x','a')、'foo'.replace('o','bar')）不算，藉此把 `,'w')` 形狀的誤攔降噪。
// 第一段刻意寫成 [^'"/.$]* 起頭（遇 / . $ 或引號就停），避免兩個無界 [^'"]* 造成回溯爆炸。
// 第二分支排除開頭數字（[^\d\W] 而非 \w）——純數字是檔案代號（如 open(1,'w')），不是路徑／
// 識別字，原本 \w 會把它也當成呼叫，抓不到字面值時整條 flood，誤擋同指令內單純被提及的
// 凍結路徑（PR #141 review）；fd 寫入本來就不是本 hook 要防的目標，直接不算呼叫更準確。
const OPEN_FIRST_ARG = `(?:['"][^'"/.$]*[./$][^'"]*['"]|[^\\d\\W]|\\[)`
// 引數區掃描：有界惰性重複，且引號字串整段吃掉；兩個分支在同一位置互斥，不會回溯爆炸。
// 上限從 120 放寬到 2000——原上限會讓第一引數是稍長運算式（如 os.path.join 接長變數名）
// 的合法呼叫整段比不中、anyCall 都不會是 true，比抓不到字面值退回 flood 更嚴重（等於這次
// 呼叫對 hook 完全隱形）；2000 字元對正常程式碼綽綽有餘，仍是有界量詞，ReDoS 風險不變
// （已用 80KB 惡意輸入實測，見 test/unit/frozen-paths-guard.spec.ts）。
const OPEN_ARGS = `(?:[^;'"]|['"][^'"]*['"]){0,2000}?`
const OPEN_WRITE_DETECT = new RegExp(`\\bopen(?:Sync)?\\s*\\(\\s*${OPEN_FIRST_ARG}${OPEN_ARGS},\\s*(?:mode\\s*=\\s*)?${MODE}\\s*[,)]`, 'g')
// capture 的路徑不收含 $ 的字串：`open('$p','w')` 的 $p 要 shell 展開才知道指向哪，
// 抓成字面值會誤判成「非凍結路徑」而放行；排除後它算不出字面值 → 退回 flood。
const OPEN_WRITE_CAPTURE = new RegExp(`\\bopen(?:Sync)?\\s*\\(\\s*['"]([^'"$]+)['"]\\s*,\\s*(?:mode\\s*=\\s*)?${MODE}`, 'g')

// 判斷 detect 命中處是不是「真的呼叫」：括號後第一個引數必須是「閉合的引號字串」
// 或識別字／$變數／運算式開頭（[A-Za-z_$([]）。
// 第一引數是 `.`（如 commit 訊息裡的 `writeFileSync(...)`）、`)`（空引數）、
// 或引號但整條指令內都閉不起來（如 grep 的 `"createWriteStream("`）→ 只是「提及」，不算呼叫。
// 用 sticky（y）旗標從指定位置起比對，不必切字串。
const CALL_ARG = /\s*(?:['"][^'"]*['"]|[A-Za-z_$([])/y

// 各語言常見寫入／刪除 API：對「整條指令原文」做 regex 比對（不切段，heredoc 內容也要吃到）。
// 每項 { detect, capture, argsChecked }：
// - detect：判斷此類呼叫是否存在（不要求引數是字面值，寧可多算）。detect 以 `\(` 收尾者，
//   命中後還要過 CALL_ARG 才算呼叫；detect 本身已把引數形狀寫進去的標 argsChecked: true
// - capture：引數是字面字串時，擷取真正的寫入／刪除目標路徑（所有 capture group 都算目標）
// 呼叫次數 > capture 命中次數 → 代表至少一次呼叫的引數是變數／運算式（如
// os.path.join(...)），該情況才需要對整條指令做 flood（見 bashFrozenWrites）。
// 只挑會落地寫檔／刪檔的 API，純讀取（如 python 的 open(path) 預設 'r'）刻意不比中。
// rename／move 類的 capture 有兩個 group（來源、目的）：來源被搬走等同刪除，一樣要擋；
// copy 類只收目的地 group，來源是凍結檔仍放行（不動原檔）。
const SCRIPT_WRITE_API = [
  // ---- node：write／append／stream ----
  { detect: /\b(?:writeFileSync|writeFile)\s*\(/g, capture: /\b(?:writeFileSync|writeFile)\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /\b(?:appendFileSync|appendFile)\s*\(/g, capture: /\b(?:appendFileSync|appendFile)\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /\bcreateWriteStream\s*\(/g, capture: /\bcreateWriteStream\s*\(\s*['"]([^'"]+)['"]/g },
  // rename／renameSync：同時涵蓋 python 的 os.rename 與 ruby 的 File.rename（皆為 `.rename(` 形狀）
  { detect: /\b(?:renameSync|rename)\s*\(/g, capture: /\b(?:renameSync|rename)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g },
  // copy 類：只有目的地算寫入目標
  { detect: /\b(?:copyFileSync|copyFile|cpSync|cp)\s*\(/g, capture: /\b(?:copyFileSync|copyFile|cpSync|cp)\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g },
  // 刪除類（含非同步版與 rmdir）
  { detect: /\b(?:rmSync|unlinkSync|rmdirSync|rm|unlink|rmdir)\s*\(/g, capture: /\b(?:rmSync|unlinkSync|rmdirSync|rm|unlink|rmdir)\s*\(\s*['"]([^'"]+)['"]/g },
  // 截斷類（含非同步版；os.truncate 亦命中）
  { detect: /\b(?:truncateSync|ftruncateSync|truncate|ftruncate)\s*\(/g, capture: /\b(?:truncateSync|ftruncateSync|truncate|ftruncate)\s*\(\s*['"]([^'"]+)['"]/g },
  // symlink／hard link：第二引數是被建立／覆蓋的路徑
  { detect: /(?:\b(?:symlinkSync|linkSync)|os\.(?:symlink|link))\s*\(/g, capture: /(?:\b(?:symlinkSync|linkSync)|os\.(?:symlink|link))\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g },

  // ---- python：write_text／write_bytes／Path.open／shutil／os ----
  { detect: /Path\s*\([^)]*\)\s*\.\s*(?:write_text|write_bytes|unlink)\s*\(/g, capture: /Path\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*(?:write_text|write_bytes|unlink)\s*\(/g },
  // Path(...).open(mode)：mode 與 open() 系列共用 MODE（'w'／'a'／'x'／'r+'／'rb+'…皆算寫入，'r'／'rb' 不算），
  // 同樣接受 mode='w' 關鍵字引數形式；只認 `['"][wax]` 會漏掉 'r+'（PR #141 review）
  { detect: new RegExp(`Path\\s*\\([^)]*\\)\\s*\\.\\s*open\\s*\\(\\s*(?:mode\\s*=\\s*)?${MODE}`, 'g'), capture: new RegExp(`Path\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)\\s*\\.\\s*open\\s*\\(\\s*(?:mode\\s*=\\s*)?${MODE}`, 'g'), argsChecked: true },
  // open(path, 'w'|'a'|'x'|'r+'…)：同時涵蓋 node 的 fs.open/openSync 與 ruby 的 File.open
  { detect: OPEN_WRITE_DETECT, capture: OPEN_WRITE_CAPTURE, argsChecked: true },
  { detect: /shutil\.copy\w*\s*\(/g, capture: /shutil\.copy\w*\s*\([^,]+,\s*['"]([^'"]+)['"]/g },
  { detect: /shutil\.move\s*\(/g, capture: /shutil\.move\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g },
  { detect: /shutil\.rmtree\s*\(/g, capture: /shutil\.rmtree\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /os\.replace\s*\(/g, capture: /os\.replace\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g },
  { detect: /os\.(?:remove|unlink|truncate|rmdir)\s*\(/g, capture: /os\.(?:remove|unlink|truncate|rmdir)\s*\(\s*['"]([^'"]+)['"]/g },

  // ---- ruby：File.write／IO.write／File.delete／FileUtils ----
  { detect: /(?:File|IO)\.write\s*\(/g, capture: /(?:File|IO)\.write\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /File\.delete\s*\(/g, capture: /File\.delete\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /FileUtils\.(?:rm_rf|rm_r|rm)\s*\(/g, capture: /FileUtils\.(?:rm_rf|rm_r|rm)\s*\(\s*['"]([^'"]+)['"]/g },
  { detect: /FileUtils\.cp\w*\s*\(/g, capture: /FileUtils\.cp\w*\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/g },
  { detect: /FileUtils\.mv\s*\(/g, capture: /FileUtils\.mv\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g },

  // ---- perl：open(..., '>'...)（追加、覆寫皆以 '>' 開頭；'>>' 也命中）----
  // 3-arg 形式：open($fh, '>', 'file')——mode 自己是一個完整字串，檔名是下一個字串
  { detect: /open\s*\([^,]+,\s*['"]>>?['"]\s*,/g, capture: /open\s*\([^,]+,\s*['"]>>?['"]\s*,\s*['"]([^'"]+)['"]/g, argsChecked: true },
  // 2-arg 形式：open($fh, '>file')——mode 與檔名黏在同一個字串裡
  { detect: /open\s*\([^,]+,\s*['"]>>?[^'"]+['"]/g, capture: /open\s*\([^,]+,\s*['"]>>?([^'"]+)['"]/g, argsChecked: true },
]

// 取檔名：去掉路徑（`/usr/bin/env` → `env`）與開頭的 `\`（`\rm` 是跳過 alias 的寫法，issue #164）
function baseName(word) {
  const bare = word.startsWith('\\') ? word.slice(1) : word
  return bare.slice(bare.lastIndexOf('/') + 1)
}

// shell 直譯器：它們的 `-c` 常與其他旗標併寫（`bash -lc`、`sh -ec`），要視同 `-c`
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'csh', 'tcsh'])

// 前綴判斷用的正規化詞：先取 baseName（帶路徑的 wrapper 才進得了 COMMAND_PREFIX 與跳旗標表），再把
// 「緊接在 shell 之後、以 c 結尾的合併旗標」正規化成 `-c`。只認前一個詞是 shell 的情況：`grep -ic rm <凍結檔>`
// 的 `-ic` 不會被當成 -c 而把 rm 誤判成指令位置（issue #164）。
function prefixOf(words, i) {
  const word = baseName(words[i])
  if (/^-[a-zA-Z]*c$/.test(word) && word !== '-c' && i > 0 && SHELLS.has(baseName(words[i - 1])))
    return '-c'
  return word
}

// 指令是否真的在「跑」直譯器：只認指令位置的 token（段首、sudo／npx／-c／變數指派之後），
// 且只看 heredoc 的開啟行、不看內文。原本對整條指令所有 token 掃，grep 搜尋樣式裡的 `"node …"`、
// 寫進文件的 heredoc 內文提到 python3，都會被當成真的在跑直譯器，接著把樣式／內文裡的 API 字樣
// 當成呼叫而誤擋唯讀或寫到別處的指令（PR #141 review）。
// 只收窄「觸發條件」；寫入 API 的比對（scriptWriteAnalysis）仍對整條指令做——
// `python3 -c "` 跨行的引號字串會把直譯器與 API 拆到不同行，切段掃會漏。
function hasScriptInterpreter(command) {
  for (const { head } of splitHeredocBlocks(command)) {
    for (const seg of splitSegments(head)) {
      if (commandVerbs(tokenize(seg)).some(v => SCRIPT_INTERPRETERS.test(v)))
        return true
    }
  }
  return false
}

// detect 命中處之後接的是不是可解析的引數（見 CALL_ARG）
function isCallArgs(command, index) {
  CALL_ARG.lastIndex = index
  return CALL_ARG.test(command)
}

// 分析整條指令的腳本寫入呼叫：回傳是否有呼叫、是否有呼叫的引數抓不到字面值（需 flood）、
// 以及所有抓得到的字面值寫入／刪除目標路徑
function scriptWriteAnalysis(command) {
  let anyCall = false
  let anyDynamic = false
  const literalPaths = []
  for (const { detect, capture, argsChecked } of SCRIPT_WRITE_API) {
    let callCount = 0
    for (const m of command.matchAll(detect)) {
      if (argsChecked || isCallArgs(command, m.index + m[0].length))
        callCount++
    }
    if (!callCount)
      continue
    anyCall = true
    const captured = [...command.matchAll(capture)]
    for (const m of captured) {
      for (const group of m.slice(1)) {
        if (group)
          literalPaths.push(group)
      }
    }
    if (captured.length < callCount)
      anyDynamic = true
  }
  return { anyCall, anyDynamic, literalPaths }
}

const projectRoot = sessionProjectRoot()
// 相對路徑的起始基準：hook 輸入的 cwd（讀到輸入後設定一次），沒有就用專案目錄。
// 指令內 cd／git -C 換出來的基準一律以參數傳給 frozenRelOf，不改這個值
let cwdBase = projectRoot

function matchFrozen(rel) {
  return FROZEN.find(p => rel === p || rel.startsWith(`${p}/`))
}

// 凍結目標一律帶著比中的 root：{ root, rel }（rel 為 root 相對、小寫）。
// root 不一定是 projectRoot——目標可能在同 repo 的另一個 worktree（issue #199，見 target-root.mjs）
function frozenTargetOf(abs) {
  try {
    // 先看實體路徑（認 worktree 別名），比不中再看未解 symlink 的原路徑：
    // 凍結目錄底下的子目錄指向 repo 外時，實體路徑落在 repo 外，只看它會放行（PR #205 review）
    for (const p of [realpathLoose(abs), abs]) {
      for (const root of candidateRoots(p, projectRoot)) {
        const rel = relative(root, p).toLowerCase()
        if (!rel.startsWith('..') && matchFrozen(rel))
          return { root, rel }
      }
    }
  }
  catch {}
  return null
}

// 子字串比對（落不了地的 token）命中時用的 root：base 所在的 worktree，不在同 repo 內就用專案目錄。
// 這只是猜測；同一支檔若另被精確定位到別的 worktree，兩筆都保留、兩處都要授權（寧可誤擋）
function baseRoot(base) {
  return candidateRoots(base, projectRoot)[0] ?? projectRoot
}

// 判斷單一 token（相對路徑以 base 解析）是否指向凍結路徑，回傳 { root, rel }，否則 null
function frozenRelOf(word, base) {
  // 空字串（shellWords 為了旗標對位保留的 `""`）不是路徑：resolve(base, '') 會變成 base 本身，base 在凍結目錄時整個目錄被誤擋
  if (!word)
    return null
  // 展開 $CLAUDE_PROJECT_DIR 與開頭的 ~（同 dirArg）：`~/…/<worktree>/spec/…` 不展開會落到子字串比對、root 猜成 base（PR #207 review）
  const expanded = word.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?/, projectRoot).replace(/^~(?=\/|$)/, process.env.HOME || '~')
  // 能落地的路徑：resolve（存在時含 symlink 解析）後對所屬 repo root 取相對再比對。
  // `of=/abs/…`、`of=../wt/…`、`--define=out=/abs/…`：每個 `=` 後面的值也當路徑（相對的以 base 解析）精確定位，
  // 否則下面的子字串比對把 root 猜成 base，只存在於別的 worktree 的凍結檔會改查 session 目錄而放行（issue #206 /code-review）。
  // 整個 token 與各 `=` 值都試，**既有的目標優先**：cwd 在凍結目錄時，整個 `of=…` 會先解析成一個不存在的凍結路徑，
  // 不能讓它（或不存在的中間值）擋掉後面真正的既有目標（PR #207 review）。都不存在才回第一個比中的
  const candidates = [expanded]
  if (!expanded.startsWith('/')) {
    for (let eq = expanded.indexOf('='); eq !== -1; eq = expanded.indexOf('=', eq + 1)) {
      if (eq + 1 < expanded.length) // bash 對 `of=~/…` 這種像指派的引數也展開 ~
        candidates.push(expanded.slice(eq + 1).replace(/^~(?=\/|$)/, process.env.HOME || '~'))
    }
  }
  let firstHit = null
  for (const c of candidates) {
    const t = frozenTargetOf(resolve(base, c))
    if (t && targetExists(t))
      return t
    firstHit ??= t
  }
  // 絕對路徑上面已可精確判定，不再做子字串比對（避免 /tmp/spec/... 誤中）
  if (expanded.startsWith('/'))
    return firstHit
  // 精確定位都不存在時仍試子字串比對：cwd 在凍結目錄時 `"$WT/test/e2e/specs/x"` 會先解析成一個不存在的凍結路徑，
  // 不能讓它蓋掉子字串比對猜中的既有檔（PR #207 review）
  const guessed = substringFrozen(expanded, base)
  return guessed && (!firstHit || targetExists(guessed)) ? guessed : firstHit
}

// 落不了地的 token（帶未知變數前綴、dd 的 of= 等）：子字串比對，寧可誤擋
function substringFrozen(expanded, base) {
  const lower = normalize(expanded).toLowerCase()
  for (const p of FROZEN) {
    const idx = lower.indexOf(p)
    if (idx === -1)
      continue
    const before = idx === 0 ? '' : lower[idx - 1]
    const after = lower[idx + p.length]
    if ((!before || before === '/' || before === '=') && (!after || after === '/'))
      return { root: baseRoot(base), rel: lower.slice(idx) }
  }
  return null
}

// 目標是否指向「既有檔」：本 hook 只擋既有檔，新增放行。
// glob 樣式（*、?、[）沒辦法逐一比對，退回檢查最近的非 glob 祖先目錄——
// 目錄在就當作可能命中既有檔（寧可誤擋），例如 `git checkout main -- 'test/e2e/specs/*'`。
function targetExists({ root, rel }) {
  if (existsSync(resolve(root, rel)))
    return true
  const globAt = rel.search(/[*?[]/)
  if (globAt === -1)
    return false
  const prefix = rel.slice(0, globAt).replace(/\/[^/]*$/, '')
  return Boolean(prefix) && existsSync(resolve(root, prefix))
}

// heredoc（<<EOF、<< EOF、<<'EOF'、<<-EOF、<<1）感知切塊：把開啟行與各 heredoc 的內文分開回傳，
// 避免下面逐行切分時把「動詞在首行、目標路徑在 heredoc 內文」拆成兩段各自看都不像寫入
// 而漏放（如 `patch -p1 <<'EOF'` 接 unified diff 內文指向凍結檔；issue #137 對抗審查）。
// 前置 (?<!<) 排除 here-string `<<< "text"`。sticky（y）旗標配合 heredocTerminators 從指定位置比對。
// 兩個分支刻意分開：`<<` 緊接數字終止符（如 `<<1`）才算 heredoc（group 1）；
// 識別字終止符允許 `<<` 後有空白（如 `<< EOF`，group 3）。
// 數字終止符不比對「`<<` 後有空白」是刻意的——這樣 `1 << 8` 這種位元左移（有空白）
// 才不會被誤判成 heredoc；`<< 1`（數字終止符前有空白）目前仍判不出來，是已知殘留限制
// （見本檔檔頭「已知極限」第 13 條）。
const HEREDOC_OPEN = /(?<!<)<<-?(?:(\d+)|\s*(['"]?)([A-Za-z_]\w*)\2)/y

// 引號感知的 heredoc 開啟符掃描：回傳 text 內引號外每個 `<<EOF` 的終止符（依出現順序）。
// 與 splitSegments 用同一套單／雙引號判斷，`node -e "a << b"` 這種引號內的 << 不算開啟符；
// 對整行與對切段後的單一 segment 呼叫都給出一致的計數，bashFrozenWrites 靠這點把內文歸段。
//
// 額外追蹤 $(( ))／(( ) 算術展開的括號深度：裡面的 << 是位元左移，不是 heredoc。
// 數字終止符分支放寬後，`$((1<<1))` 會被誤判成 heredoc（`<<1` 緊接數字），把後面真正的
// 寫入指令吞成「內文」而漏放（PR #141 review，round 13）；`1 << 8`（<< 前後有空白）不受
// 影響，本來就不會比中數字終止符分支，這裡是專門堵 `$((...))` 這種「數字緊貼 <<」的算術寫法。
function heredocTerminators(text) {
  const terminators = []
  let quote = ''
  let arithDepth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote)
        quote = ''
      continue
    }
    if (arithDepth > 0) {
      if (c === '(')
        arithDepth++
      else if (c === ')')
        arithDepth--
      continue
    }
    if (c === '(' && text[i + 1] === '(') {
      arithDepth = 2
      i++ // 跳過第二個 (，深度已算進去
      continue
    }
    if (c === '<' && text[i + 1] === '<') {
      HEREDOC_OPEN.lastIndex = i
      const m = HEREDOC_OPEN.exec(text)
      if (m) {
        terminators.push(m[1] ?? m[3]) // group 1 = 數字終止符，group 3 = 識別字終止符
        i += m[0].length - 1 // 整個 <<'EOF' 一起跳過，終止符外的引號不進入引號狀態
        continue
      }
    }
    if (c === '\'' || c === '"')
      quote = c
  }
  return terminators
}

function splitHeredocBlocks(command) {
  const lines = command.split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i]
    const bodies = []
    for (const terminator of heredocTerminators(head)) {
      let body = ''
      while (i + 1 < lines.length) {
        i++
        body += `${lines[i]}\n`
        if (lines[i].trim() === terminator)
          break
      }
      bodies.push(body)
    }
    blocks.push({ head, bodies })
  }
  return blocks
}

// 依 |、;、&、&&、|| 切段，但引號內（單／雙引號）的分隔符不算——
// 否則 `sed -i '' 's/a/b/;s/c/d/' <凍結檔>` 會被 `;` 切散，動詞與目標分屬不同段而漏放。
// 單一 `&`（背景執行）也是指令分隔符，否則 `echo hi & tee <凍結檔>` 整條併一段、tee 不在
// 指令位置而漏放；但 `>&`／`<&`／`&>`／`&>>`（含 `2>&1`）是同段內的 fd 重導向，不切。
// 逐字元掃描而非 regex：避免遮蔽／還原佔位符，也沒有回溯成本。
// 同上，但每段多記 piped：這段是否由單一 `|` 接在前一段後面（`||` 不算），管線的 xargs 判斷要用（issue #165）
function splitPipelineSegments(text) {
  const segments = []
  let cur = ''
  let quote = ''
  let piped = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      cur += c
      if (c === quote)
        quote = ''
      continue
    }
    if (c === '\'' || c === '"') {
      quote = c
      cur += c
      continue
    }
    const prev = text[i - 1]
    const next = text[i + 1]
    const isSeparator = c === ';' || c === '|'
      || (c === '&' && (next === '&' || (prev !== '>' && prev !== '<' && next !== '>')))
    if (!isSeparator) {
      cur += c
      continue
    }
    const nextPiped = c === '|' && next !== '|'
    // `|&`（stdout＋stderr 一起接管線）的 & 屬於這個管線符號，不是另一個分隔符
    if (c === '|' && next === '&')
      i++
    if ((c === '&' && next === '&') || (c === '|' && next === '|'))
      i++
    segments.push({ text: cur, piped })
    cur = ''
    piped = nextPiped
  }
  segments.push({ text: cur, piped })
  return segments
}

function splitSegments(text) {
  return splitPipelineSegments(text).map(s => s.text)
}

function tokenize(text) {
  return text.split(/[\s"'()`;&|<>]+/).filter(Boolean)
}

// 引號感知的拆字（照 bash 的規則）：引號內的空白不拆、引號本身拿掉，引號外的 `\ ` 當字面空白，雙引號內的 `\"`／`\\`
// 只留後一字，相鄰的引號與非引號片段併成同一個字（`"/a b"/spec/…`）。tokenize 在引號內的空白處也拆，`"/a b/spec/…"`
// 會變成 `/a`＋`b/spec/…` 兩半，含空白的 worktree 絕對路徑比不中（issue #206）。
// 回傳 { words, redirects }：redirects 是引號外 `>`／`>>`／`>&`／`&>` 之後的那個字（重導向目標）。
// 用途：多找凍結路徑（與 tokenize、重導向 regex 的結果一起比對），以及 cd／git -C／寫入動詞／xargs 判斷的第二種拆法。
// 寫入動詞與就地改檔旗標是兩種拆法任一判成寫入就算；git 子指令例外，只看 gitWordsOf 選的那一種（shellWords 認得出
// 執行中的 git 時以它為準），所以 shellWords 拆錯 git 子指令時不再有 tokenize 兜底。改它的空字串或跳脫規則會連動寫入判斷
function shellWords(text) {
  const words = []
  const redirects = []
  let cur = ''
  let quote = ''
  let inWord = false
  let pendingRedirect = false
  const flush = () => {
    if (inWord) {
      words.push(cur)
      if (pendingRedirect)
        redirects.push(cur)
      pendingRedirect = false
    }
    cur = ''
    inWord = false
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote)
        quote = ''
      else if (quote === '"' && c === '\\' && '"\\$`'.includes(text[i + 1] ?? ''))
        cur += text[++i]
      else
        cur += c
    }
    else if (c === '\'' || c === '"') {
      quote = c
      inWord = true
    }
    else if (c === '\\' && i + 1 < text.length) {
      cur += text[++i]
      inWord = true
    }
    else if (/[\s;&|<>()`]/.test(c)) {
      flush()
      // `>` 開始一個重導向；`>>`、`>&`、`&>` 的其餘符號與空白不打斷，等下一個字當目標（`2>&1` 的 1 是 fd，比不中凍結路徑）
      if (c === '>')
        pendingRedirect = true
      else if (c === '<' || c === ';' || c === '|')
        pendingRedirect = false
    }
    else {
      cur += c
      inWord = true
    }
  }
  flush()
  // words 保留引號產生的空字串（`git -C "" -C../b`）：濾掉會讓旗標與值錯位，-C 的目錄被吃掉（PR #207 review）
  return { words, redirects: redirects.filter(Boolean) }
}

// COMMAND_PREFIX 裡的 wrapper（sudo／env／xargs 會這樣用）常接一個吃值的旗標，
// 旗標的值會把真正的子指令往後推一位：`sudo -u alice rm <凍結檔>` 原本只認「wrapper 後
// 緊接的 token」，`-u` 之後是值 `alice` 不是子指令，`rm` 判不出指令位置而漏放（PR #141
// review）；`xargs -I {} rm <凍結檔>` 同理，`-I` 的替換字串 `{}` 被誤判成子指令，`rm` 判不出來
// （PR #141 review，round 13）。只收斂 sudo／env／xargs 實際會用到的旗標，不求窮舉每個工具。
const WRAPPER_VALUE_FLAGS = new Set(['-u', '--user', '-g', '--group', '-C', '--chdir', '-R', '--chroot', '-I', '--replace'])
// 只對特定 wrapper 吃值的旗標：`-n`／`-s`／`-i` 在 sudo 是不吃值的開關（`sudo -n rm`），
// 放進共用表會把真正的子指令當成值跳掉，所以按 wrapper 分開（issue #154）。
const WRAPPER_OWN_VALUE_FLAGS = {
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  nice: new Set(['-n', '--adjustment']),
  stdbuf: new Set(['-i', '-o', '-e', '--input', '--output', '--error']),
  exec: new Set(['-a']),
  // xargs：值分開寫時（`xargs -n 1 rm`）會被當成子指令；-i／-l／-e 的值只能黏著寫，不列（issue #165）。
  // -J／-S 是 BSD（macOS）xargs 的替換字串與長度旗標，`xargs -J % rm %` 在 macOS 很常見
  xargs: new Set(['-n', '-L', '-s', '-P', '-d', '-a', '-E', '-J', '-S', '--max-args', '--max-lines', '--max-chars', '--max-procs', '--delimiter', '--arg-file', '--eof']),
}
// 旗標之後、子指令之前還有固定位置參數的 wrapper：`timeout 10 rm` 的 10 是時限，不是子指令
const WRAPPER_POSITIONALS = { timeout: 1 }

// 從 wrapper 後一個 token 開始，跳過旗標（吃值旗標額外多跳一個 token 當它的值）與固定位置參數，
// 回傳子指令 token 的索引（可能等於 words.length，代表找不到）。
function skipWrapperFlags(words, start, wrapper) {
  const ownFlags = WRAPPER_OWN_VALUE_FLAGS[wrapper]
  let i = start
  while (i < words.length && words[i].startsWith('-'))
    i += WRAPPER_VALUE_FLAGS.has(words[i]) || ownFlags?.has(words[i]) ? 2 : 1
  return i + (WRAPPER_POSITIONALS[wrapper] ?? 0)
}

// `!`（pipeline 取反）本身在指令位置時，其後的 token 也是指令位置：`! rm`、`time ! rm`、`then ! rm`。
// 不把 `!` 放進 COMMAND_PREFIX：那會觸發跳旗標邏輯，把 `find … ! -name tee` 的 tee 誤判成子指令（issue #154）。
function isCommandPosition(words, i) {
  if (i === 0) return true
  const prev = prefixOf(words, i - 1)
  return COMMAND_PREFIX.has(prev) || /^\w+=/.test(words[i - 1]) || (prev === '!' && isCommandPosition(words, i - 1))
}

// 只有「指令位置」的 token 才算動詞：段落第一個 token，或 sudo／xargs／find -exec 等前綴
// 之後、或 shell 變數指派之後。這樣 heredoc 內文與訊息字串裡散落的 ed／restore 不會被誤判。
function commandIndices(words) {
  const indices = []
  for (let i = 0; i < words.length; i++) {
    if (isCommandPosition(words, i))
      indices.push(i)
    const prefix = prefixOf(words, i)
    if (COMMAND_PREFIX.has(prefix)) {
      const subcmdIndex = skipWrapperFlags(words, i + 1, prefix)
      if (subcmdIndex < words.length && subcmdIndex !== i + 1)
        indices.push(subcmdIndex)
    }
  }
  return indices
}

function commandVerbs(words) {
  return commandIndices(words).map(i => baseName(words[i]))
}

// 真正被執行的那個 git 的位置：先找指令位置上的 git（`VAR=…/git` 這種指派不算），找不到才回退成第一個叫 git 的字
//（`if git rm` 這類控制結構的關鍵字不在 COMMAND_PREFIX，見已知極限第 20 條）。只認第一個叫 git 的字會把
// `sudo -u git git rm`、`GIT_TRACE=/tmp/git git checkout` 的前一個 git 當成指令而漏放（PR #207 本地覆審）
function isGitWord(word) {
  return baseName(word) === 'git' && !/^\w+=/.test(word)
}
function gitIndex(words) {
  return commandIndices(words).find(i => isGitWord(words[i])) ?? words.findIndex(isGitWord)
}
function runsGit(words) {
  return commandIndices(words).some(i => isGitWord(words[i]))
}

// git 全域旗標裡會吃一個值的（-C／-c 之外，--work-tree／--git-dir／--namespace 同樣把
// 下一個 token 當值，不是子指令；`git --work-tree /tmp checkout -- <凍結檔>` 原本只跳
// -C/-c，把 /tmp 誤判成子指令位置，真正的 checkout 判不出來，PR #141 review）。
const GIT_VALUE_FLAGS = new Set(['-C', '-c', '--work-tree', '--git-dir', '--namespace'])

// git 的子指令只認緊接 git 之後的第一個非旗標 token（吃值旗標會多跳一個 token），
// 否則 `git commit -m "… restore …"` 的訊息內文會被當成 git restore。
function gitWriteSubcmd(words) {
  const gi = gitIndex(words)
  if (gi === -1)
    return false
  for (let i = gi + 1; i < words.length; i++) {
    if (GIT_VALUE_FLAGS.has(words[i])) {
      i++
      continue
    }
    if (words[i].startsWith('-'))
      continue
    return GIT_WRITE_SUBCMDS.has(words[i])
  }
  return false
}

// 管線下游 xargs 段專用的寫入判斷：就地改檔工具必須在指令位置、-i 旗標必須在它之後。hasWriteVerb 的
// 就地改檔判斷不看位置，`… | xargs grep -in sed` 會被誤當寫入（issue #165 對抗審查）
function xargsWrites(words, lexedWords = words) {
  const plain = (w) => {
    const verbs = commandVerbs(w)
    const at = w.findIndex(x => INPLACE_TOOLS.has(baseName(x)) && verbs.includes(baseName(x)))
    return verbs.some(v => WRITE_VERBS.has(v)) || (at !== -1 && w.slice(at + 1).some(x => INPLACE_FLAG.test(x)))
  }
  const g = gitWordsOf(words, lexedWords)
  return plain(words) || plain(lexedWords) || (runsGit(g) && gitWriteSubcmd(g))
}

// 寫入判斷：動詞與就地改檔旗標對 tokenize、shellWords 兩種拆法都看（任一判成寫入就算）；git 子指令只看 gitWordsOf 選的那一種
function hasWriteVerb(words, lexedWords = words) {
  const plain = w => commandVerbs(w).some(v => WRITE_VERBS.has(v))
    || (w.some(x => INPLACE_TOOLS.has(baseName(x))) && w.some(x => INPLACE_FLAG.test(x)))
  return plain(words) || plain(lexedWords) || gitWriteSubcmd(gitWordsOf(words, lexedWords))
}

// git 子指令用哪一種拆法：shellWords 在指令位置認得出 git 時以它為準——`git -C "/a rm" status` 的 rm 是目錄名，
// tokenize 卻把它拆到子指令位置而誤擋；認不出（巢狀 `bash -c "git rm …"` 整串是一個字）才回退 tokenize（PR #207 review）
function gitWordsOf(words, lexedWords) {
  return runsGit(lexedWords) ? lexedWords : words
}

// cd／git -C 的目錄引數：展開 $CLAUDE_PROJECT_DIR 與開頭的 ~，對 base 解析（含 symlink）；不是既有目錄回 null
//（cd 打錯字會失敗、shell 留在原地；`grep -c cd <檔>` 這類誤判出來的「目錄」其實是檔案）
function dirArg(base, word) {
  const expanded = word.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?/, projectRoot).replace(/^~(?=\/|$)/, process.env.HOME || '~')
  const dir = realpathLoose(resolve(base, expanded))
  try {
    return statSync(dir).isDirectory() ? dir : null
  }
  catch {
    return null
  }
}

// 這一段的 `git -C <dir>`（git 要是這段真正執行的指令，判準同 commandVerbs：`timeout 10 git -C …` 算、
// `grep git -C 2` 不算）：git 在該目錄下解析它自己的引數。多個 -C 依序疊加（`-C .. -C wt`）。回傳目錄，沒有回 null
// 黏連寫法 `-C../wt` 同樣認（issue #206）
function gitChdir(words, base) {
  if (!runsGit(words))
    return null
  const gi = gitIndex(words)
  let dir = null
  for (let i = gi + 1; i < words.length && words[i].startsWith('-'); i++) {
    const arg = words[i] === '-C' ? words[i + 1] : words[i].startsWith('-C') ? words[i].slice(2) : null
    if (arg) {
      dir = dirArg(dir ?? base, arg)
      if (!dir)
        return null
    }
    if (GIT_VALUE_FLAGS.has(words[i]))
      i++
  }
  return dir
}

// 這一段的 `cd <dir>`（含 `builtin cd`、`cd -P`／`-L`／`--`）：回傳目錄引數字串；不是 cd、`cd -`、或沒有引數回 null
function cdArg(words) {
  const ci = words.findIndex((w, i) => baseName(w) === 'cd' && (isCommandPosition(words, i) || words[i - 1] === 'builtin'))
  if (ci === -1)
    return null
  let i = ci + 1
  while (i < words.length && words[i].startsWith('-') && words[i] !== '-')
    i++
  return i < words.length && words[i] !== '-' ? words[i] : null
}

// 一行文字依單／雙引號切開、各段 trim：Python 三引號跨行時路徑那一行沒有成對引號，shellWords 會在空白處拆散
function quotePieces(line) {
  return line.split(/['"]/).map(piece => piece.trim()).filter(Boolean)
}

// 解析 Bash command，回傳會被寫入的凍結目標清單（{ root, rel }，同 root＋rel 只留一筆）。
// 同一條指令裡的 `cd <dir>` 會改變之後各段相對路徑的基準（`cd ../wt && rm <凍結檔>`，issue #199 /code-review）。
// 靜態解析不知道 cd 有沒有成功，所以基準只增不減：cd 之後的段對「cd 前後所有出現過的基準」都解析一次、任一個比中就算，
// 保證不會比沒有 cd 追蹤時少擋（寧可誤擋）。`git -C <dir>` 只加給 git 自己那一段；重導向由 shell 解析，不用 -C 目錄。
// 都只追蹤字面目錄，`cd -`、`pushd`、引號內的 `bash -c 'cd …'` 見檔頭已知極限第 33 條
function bashFrozenWrites(command) {
  const found = new Map()
  const addTarget = t => found.set(`${t.root}\n${t.rel}`, t)
  const shellBases = new Set([cwdBase]) // shell 自己的工作目錄可能是哪幾個
  const seenBases = new Set([cwdBase]) // 直譯器防線看整條指令，分不出寫入發生在哪個 cd 之後，所有出現過的基準都試
  const lexedWords = new Set() // 各段 shellWords 的字，給直譯器 flood 用（逐段算，引號狀態不跨段、不跨 heredoc 內文）
  for (const { head, bodies } of splitHeredocBlocks(command)) {
    // 指令行也依引號切段收進 flood 候選：多行 `python3 -c '…'` 的三引號路徑行沒有成對引號（PR #207 本地覆審）
    quotePieces(head).forEach(w => lexedWords.add(w))
    let bodyAt = 0
    let upstream = [] // 同一條管線裡前面各段比中的凍結 token（issue #165）
    for (const { text: seg, piped } of splitPipelineSegments(head)) {
      if (!piped)
        upstream = []
      const words = tokenize(seg)
      const lexed = shellWords(seg)
      lexed.words.forEach(w => lexedWords.add(w))
      const segBases = [...shellBases]
      // cd／git -C 對 tokenize 與 shellWords 兩種拆法都判一次：含空白的目錄（`cd "/a b"`、`git -C '/a b'`）只有 shellWords 拆得完整（issue #206）
      const gitBases = [...new Set(segBases.flatMap(b => [gitChdir(words, b), gitChdir(lexed.words, b)]).filter(Boolean))]
      const bases = [...segBases, ...gitBases]
      for (const cd of new Set([cdArg(words), cdArg(lexed.words)].filter(Boolean))) {
        for (const b of segBases) {
          const dir = dirArg(b, cd)
          if (dir)
            shellBases.add(dir)
        }
      }
      for (const b of [...bases, ...shellBases])
        seenBases.add(b)
      // heredoc 內文歸給「含 << 開啟符的那一段」（動詞在指令行、目標在內文，如
      // `patch -p1 <<'EOF' && echo done`——內文屬於 patch 段，不是 echo 段）；
      // 一行多個 heredoc 時依開啟符出現順序各歸各段。內文只用來找凍結路徑，不參與動詞與重導向判斷。
      const opened = heredocTerminators(seg).length
      const segBodies = bodies.slice(bodyAt, bodyAt + opened)
      // heredoc 內文逐行用 shellWords 拆，整段的字也收進本段路徑候選：`xargs rm <<'EOF'` 的內文是 `"/a b/<凍結檔>"` 時，
      // tokenize 會在空白處拆散路徑而放行（PR #207 review）。逐行拆，內文註解裡落單的 `'` 不會把後面幾行黏成一個字
      const bodyLexed = segBodies.flatMap(body => body.split('\n')).flatMap(line => shellWords(line).words)
      const bodyWords = [...segBodies.flatMap(tokenize), ...bodyLexed]
      // 直譯器 flood 另收每行依引號切開、各段 trim 後的字：Python 三引號跨行時路徑那一行沒有成對引號
      //（`/a b/<凍結檔>""".strip()`），shellWords 會在空白處拆散（PR #207 review）
      bodyLexed.forEach(w => lexedWords.add(w))
      segBodies.flatMap(body => body.split('\n')).flatMap(quotePieces).forEach(w => lexedWords.add(w))
      bodyAt += opened
      const pathWords = [...new Set([...words, ...lexed.words, ...bodyWords])]
      const frozen = bases.flatMap(b => pathWords.map(w => frozenRelOf(w, b))).filter(Boolean)
      // 管線下游的 xargs 把上游輸出的路徑當引數餵給寫入動詞：`grep -l x <凍結目錄>/*.ts | xargs sed -i …`
      // `xargs -0 git -C "/a b" rm`：tokenize 把 `b` 拆成 git 子指令位置，下游寫入判斷也要看 shellWords 的拆法（PR #207 review）
      if (upstream.length && commandVerbs(words).includes('xargs') && xargsWrites(words, lexed.words))
        upstream.forEach(addTarget)
      upstream.push(...frozen)
      if (!frozen.length)
        continue
      // `git -C "/a b" rm`、`xargs -I "x y" rm`：tokenize 把引號內的字拆成子指令位置，寫入判斷也要看 shellWords 的拆法
      //（issue #206、PR #207 review）
      if (hasWriteVerb(words, lexed.words)) {
        frozen.forEach(addTarget)
        continue
      }
      // 無寫入動詞的段落：只有重導向（>、>>、>&、&>、&>>）目標比中凍結路徑才算寫入。
      // >& 是 bash 把 stdout/stderr 一起導到目標檔的簡寫（等同 > file 2>&1），漏了這個形狀
      // 會讓 `echo x >& <凍結檔>` 這種寫入漏放（PR #141 review）；`2>&1` 這類 fd 複製會被
      // 一併掃到 capture，但目標是純數字 fd、比不中任何真實凍結路徑，frozenRelOf 自然濾掉。
      // regex 會在空白處截斷含空白的目標（`"/a b/…"`、`/a\ b/…`），另由 shellWords 照 shell 規則取出的重導向目標補上；
      // regex 保留，因為它吃得到引號內、不含空白的重導向目標（`bash -c "echo x > <凍結檔>"`）；shellWords 把引號內整段視為
      // 一個字，不會再拆出內層的重導向。引號內又含空白的目標兩邊都抓不到，見已知極限第 33 條 (b)（issue #206）。
      const redirectTargets = [...seg.matchAll(/(?:>{1,2}&?|&>{1,2})\s*["']?([^\s"'<>|;&]+)/g)].map(m => m[1])
      for (const w of new Set([...redirectTargets, ...lexed.redirects])) {
        for (const b of segBases) {
          const rel = frozenRelOf(w, b)
          if (rel)
            addTarget(rel)
        }
      }
    }
  }
  // 直譯器防線：對「整條指令」（跨 \n、不切段）判斷，heredoc 把直譯器詞與寫入 API
  // 拆到不同行也吃得到。優先用 capture 抓到的字面值路徑當寫入目標（精準，不誤傷同指令
  // 內被唯讀讀取的凍結檔）；只有引數抓不到字面值（變數／運算式）時才回退整條指令 flood。
  // flood 也收各段 shellWords 的完整字：`node -e '…writeFileSync(process.argv[1],…)' "/a b/<凍結檔>"` 的路徑含空白（PR #207 review）
  const allWords = [...new Set([...tokenize(command), ...lexedWords])]
  if (hasScriptInterpreter(command)) {
    const { anyCall, anyDynamic, literalPaths } = scriptWriteAnalysis(command)
    if (anyCall) {
      for (const b of seenBases) {
        for (const p of literalPaths) {
          const rel = frozenRelOf(p, b)
          if (rel)
            addTarget(rel)
        }
        if (anyDynamic) {
          for (const rel of allWords.map(w => frozenRelOf(w, b)).filter(Boolean))
            addTarget(rel)
        }
      }
    }
  }
  return [...found.values()]
}

// 一次性授權通道：全部目標都在 sentinel 清單內才放行，並一次消耗。
// sentinel 讀「目標所屬 repo」的 .claude/tmp/frozen-allow.json（issue #199）：worktree 內的正規產出流程
// 在自己的 worktree 寫授權。一條指令橫跨多個 repo 時，先逐一檢查全部通過才寫回，避免只消耗一半。
function tryConsumeSentinel(targets) {
  const byRoot = new Map()
  for (const { root, rel } of targets) {
    if (!byRoot.has(root))
      byRoot.set(root, [])
    byRoot.get(root).push(rel)
  }
  const plans = []
  try {
    for (const [root, rels] of byRoot) {
      const sentinel = resolve(root, '.claude/tmp/frozen-allow.json')
      if (!existsSync(sentinel))
        return false
      const allow = JSON.parse(readFileSync(sentinel, 'utf8'))
      const files = Array.isArray(allow?.files) ? allow.files : []
      const used = []
      for (const rel of new Set(rels)) {
        const i = files.findIndex((f, fi) => !used.includes(fi) && String(f).toLowerCase() === rel)
        if (i === -1)
          return false
        used.push(i)
      }
      plans.push({ sentinel, allow, remaining: files.filter((_, i) => !used.includes(i)) })
    }
    for (const { sentinel, allow, remaining } of plans) {
      if (remaining.length === 0)
        rmSync(sentinel)
      else
        writeFileSync(sentinel, JSON.stringify({ ...allow, files: remaining }, null, 2))
    }
    return true
  }
  catch {
    return false // sentinel 壞掉視同不存在，維持擋下的預設
  }
}

// 擋下訊息：本專案的目標照舊只列 repo 相對路徑（sentinel files 照這個字串填）；別的 worktree 的目標補上
// sentinel 要寫的位置，否則照慣例寫進專案目錄的授權永遠不會被讀到
function deny(targets) {
  const labels = targets.map(({ root, rel }) => root === projectRoot ? rel : `${rel}（worktree：${root}，授權寫在該目錄的 .claude/tmp/frozen-allow.json）`)
  console.error(
    `凍結區保護：${labels.join('、')} 屬於凍結路徑，禁止修改既有檔案。`
    + `依 .claude/rules/frozen-paths.md 處理：停下來，向使用者說明衝突並列出選項`
    + `（調整目標／走 spec 變更迭代流／由使用者自行修改規格）。新增全新檔案不受此限。`,
  )
  process.exit(2)
}

let raw = ''
process.stdin.on('data', (c) => { raw += c })
process.stdin.on('end', () => {
  let input
  try {
    input = JSON.parse(raw)
  }
  catch {
    process.exit(0) // 輸入解析失敗時不擋，避免鎖壞掉時癱瘓所有編輯
  }

  if (typeof input?.cwd === 'string' && input.cwd) {
    try {
      cwdBase = realpathLoose(resolve(projectRoot, input.cwd))
    }
    catch {}
  }

  if (input?.tool_name === 'Bash') {
    const command = typeof input?.tool_input?.command === 'string' ? input.tool_input.command : ''
    if (!command)
      process.exit(0)
    // 只擋「既有檔」；寫入不存在的目標＝新增，放行
    const existing = bashFrozenWrites(command).filter(targetExists)
    if (!existing.length)
      process.exit(0)
    if (tryConsumeSentinel(existing))
      process.exit(0)
    deny(existing)
  }

  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path
  if (!filePath)
    process.exit(0)

  const abs = resolve(cwdBase, filePath)
  const target = frozenTargetOf(abs)
  if (!target)
    process.exit(0)

  // Write 到不存在的檔案 = 授權產出者新增合約，放行
  if (input.tool_name === 'Write' && !existsSync(abs))
    process.exit(0)

  if (tryConsumeSentinel([target]))
    process.exit(0)
  deny([target])
})
