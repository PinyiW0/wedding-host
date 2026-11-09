// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// frozen-paths-guard.mjs：凍結區門鎖 PreToolUse hook（issue #137，含兩輪對抗審查後的回歸案例）。
// 驅動方式對齊 hook 實際行為：
// - Bash 事件：stdin 讀 { tool_name: 'Bash', tool_input: { command } } JSON
// - Write／Edit 事件：stdin 讀 { tool_name, tool_input: { file_path } } JSON
// 用 CLAUDE_PROJECT_DIR 決定 repo root，擋下時 exit 2、放行時 exit 0。
const HOOK_PATH = fileURLToPath(new URL('../../.claude/hooks/frozen-paths-guard.mjs', import.meta.url))
const FROZEN_FILE = 'test/e2e/specs/01-x.spec.ts'

let tmpDir: string

beforeEach(() => {
  // Arrange：建立假 repo，內含一個已存在的凍結區檔案，以及誤攔回歸案例需要的旁支目錄
  tmpDir = mkdtempSync(join(tmpdir(), 'frozen-guard-'))
  mkdirSync(join(tmpDir, 'test/e2e/specs'), { recursive: true })
  mkdirSync(join(tmpDir, 'spec/e2e-flows'), { recursive: true })
  mkdirSync(join(tmpDir, 'spec/gherkin-feature'), { recursive: true })
  mkdirSync(join(tmpDir, 'spec/report'), { recursive: true })
  mkdirSync(join(tmpDir, 'app/types'), { recursive: true })
  writeFileSync(join(tmpDir, FROZEN_FILE), '// 既有 spec\n')
  writeFileSync(join(tmpDir, 'spec/e2e-flows/a.flow.md'), '# flow\n')
  writeFileSync(join(tmpDir, 'spec/gherkin-feature/a.feature'), 'Feature: x\n')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// 驅動 hook：組成 PreToolUse 的 Bash 事件 payload 餵進 stdin，回傳 spawnSync 結果（status/stderr）
function runGuard(command: string) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    encoding: 'utf8',
    // 正常執行約 80-120ms（見下方 ReDoS 測試），5s 足夠寬裕；
    // 萬一未來重新引入災難性回溯，spawnSync 逾時回傳 status: null，斷言會如實失敗而不是卡住整個 CI
    timeout: 5000,
  })
}

// 驅動 hook：直接指定整包 payload（測非字串 command 等邊界輸入）
function runGuardRaw(payload: unknown) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    encoding: 'utf8',
    timeout: 5000,
  })
}

// 驅動 hook：組成 PreToolUse 的 Write／Edit 事件 payload
function runGuardOnFile(toolName: 'Write' | 'Edit', filePath: string) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { file_path: filePath } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
    encoding: 'utf8',
    timeout: 5000,
  })
}

describe('frozen-paths-guard：直譯器繞道防線', () => {
  it('案例1：python3 heredoc 用 write_text 改既有凍結檔 → 擋下', () => {
    // Arrange：直譯器詞在首行、寫入 API 在後續行，逐段（依 \n 切）判斷會漏放
    const command = [
      'python3 - <<\'PY\'',
      'from pathlib import Path',
      `Path('${FROZEN_FILE}').write_text('hacked')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
  })

  it('案例2：node -e 用 writeFileSync 改既有凍結檔 → 擋下', () => {
    // Arrange
    const command = `node -e "require('fs').writeFileSync('${FROZEN_FILE}','')"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
  })

  it('案例3（既有防線回歸）：sed -i 改既有凍結檔 → 擋下', () => {
    // Arrange
    const command = `sed -i '' 's/a/b/' ${FROZEN_FILE}`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
  })

  it('案例4：cat heredoc 建立全新檔 → 放行', () => {
    // Arrange：目標檔案在假 repo 內不存在，屬於新增
    const command = [
      'cat > test/e2e/specs/99-new.spec.ts <<\'EOF\'',
      '// 新檔',
      'EOF',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('案例5：python3 -c 僅呼叫 open 讀取（唯讀 API，非寫入） → 放行', () => {
    // Arrange
    const command = `python3 -c "print(open('${FROZEN_FILE}').read())"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('案例6a：寫入路徑是字面值（/tmp/out.txt）、字串內另含凍結路徑名 → 放行', () => {
    // Arrange：capture 抓到真正的寫入目標是 /tmp/out.txt（非凍結區），
    // 凍結路徑名只是被寫入的「內容」字串，不應被當成寫入目標（對抗審查修正：不再整條指令 flood）
    const command = [
      'python3 - <<\'PY\'',
      'from pathlib import Path',
      `Path('/tmp/out.txt').write_text('reference: ${FROZEN_FILE}')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('案例6b（已知極限：flood 取捨）：寫入路徑是變數、同指令另含唯讀的凍結路徑字面值 → 一併擋下', () => {
    // Arrange：open(target, 'w') 的 target 是變數，capture 抓不到字面值，
    // 依規格退回整條指令 flood——print() 裡只是被印出來的凍結路徑 token 也一併視為寫入目標。
    // 這是刻意接受的誤擋代價，不是 bug：靜態解析無從得知 target 實際指向哪裡。
    const command = [
      'python3 - <<\'PY\'',
      'import os',
      'target = os.environ.get(\'OUT\')',
      'open(target, \'w\').write(\'x\')',
      `print('ref ${FROZEN_FILE}')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：誤攔回歸（唯讀讀取凍結檔＋寫到別處 → 一律放行）', () => {
  it('node 讀 flow 寫 route-map → 放行', () => {
    // Arrange：flow 檔只是被 readFileSync 讀取內容，真正寫入目標是 spec/report/route-map.yaml
    const command = 'node -e "require(\'fs\').writeFileSync(\'spec/report/route-map.yaml\', '
      + 'require(\'fs\').readFileSync(\'spec/e2e-flows/a.flow.md\',\'utf8\'))"'

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('python heredoc 讀 feature 寫 app/types → 放行', () => {
    // Arrange
    const command = [
      'python3 - <<\'PY\'',
      'src = open(\'spec/gherkin-feature/a.feature\').read()',
      'open(\'app/types/gen.ts\', \'w\').write(src)',
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('git diff 凍結檔 | python3 寫 /tmp → 放行', () => {
    // Arrange：git diff 只是唯讀比對凍結檔，管線後段的寫入目標在 /tmp
    const command = `git diff ${FROZEN_FILE} | python3 -c "open('/tmp/d.txt','w').write(1)"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('grep 搜尋字串含 API 名（整條指令無直譯器詞，直譯器防線不觸發） → 放行', () => {
    // Arrange：grep 本身不是直譯器，SCRIPT_WRITE_API 那條防線根本不會啟動
    const command = 'grep -rn "createWriteStream(" test/e2e/specs/'

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('git commit message 同時含 API 名與凍結路徑（無直譯器） → 放行', () => {
    // Arrange：訊息字串裡帶凍結路徑，才驗得出「有凍結路徑但沒有寫入動詞 → 放行」
    const command = `git commit -m "refactor: writeFileSync(${FROZEN_FILE}) usage"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('playwright 對凍結檔跑測試、輸出重導向到 /tmp（非寫入類動詞） → 放行', () => {
    // Arrange
    const command = `npx playwright test ${FROZEN_FILE} --reporter=json > /tmp/r.json`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('管線唯讀段（cat 凍結檔 | grep > /tmp） → 放行', () => {
    // Arrange：確認引號感知切段沒有讓 | 失去切段能力
    const command = `cat ${FROZEN_FILE} | grep foo > /tmp/o.txt`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('案例 B4：grep 的搜尋樣式含 API 名＋未閉合引號，同段另有直譯器詞 → 放行', () => {
    // Arrange："createWriteStream(" 的引號在 ( 之後就收尾，第一引數閉不起來 ＝ 只是提及，
    // 不算呼叫；node -v 讓直譯器防線啟動，才驗得出「提及不觸發 flood」
    const command = 'grep -rn "createWriteStream(" test/e2e/specs/ && node -v'

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('案例 B5：git add 凍結檔 && commit 訊息含 API 名與省略號引數 → 放行', () => {
    // Arrange：writeFileSync(...) 的第一引數是 `.`，不是可解析的引數 ＝ 只是提及；
    // git add 不在會改寫工作區的子指令清單內
    const command = `git add ${FROZEN_FILE} && git commit -m "refactor: node writeFileSync(...)"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：切段引號感知（引號內的 ; | 不該把動詞與目標拆散）', () => {
  it('sed -i 多個 s 命令用 ; 串接 → 擋下', () => {
    const result = runGuard(`sed -i '' 's/a/b/;s/c/d/' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('sed 正則含跳脫的 \\| → 擋下', () => {
    const result = runGuard(`sed -i '' 's/a\\|b/c/' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('perl -pi 多個表達式用 ; 串接 → 擋下', () => {
    const result = runGuard('perl -pi -e \'s/a/b/; s/c/d/\' spec/e2e-flows/a.flow.md')
    expect(result.status).toBe(2)
  })

  it('ruby -i -pe 內含 ; → 擋下', () => {
    const result = runGuard(`ruby -i -pe 'gsub(/a/,"b"); nil' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('cp 來源檔名含 ; → 擋下', () => {
    const result = runGuard(`cp '/tmp/a;b' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('git checkout pathspec 含 | 與 glob → 擋下', () => {
    // Arrange：glob 目標無法逐一比對，退回檢查最近的非 glob 祖先目錄是否存在（寧可誤擋）
    const result = runGuard('git checkout main -- \'test/e2e/specs/*|x\'')
    expect(result.status).toBe(2)
  })

  it('ex -sc 命令內含 | → 擋下', () => {
    const result = runGuard(`ex -sc '%s/a/b/|x' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('引號外的 && 仍正常切段 → 擋下後段的 tee', () => {
    const result = runGuard(`echo hi && tee ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('引號外的 ; 仍正常切段 → 擋下後段的 cp', () => {
    const result = runGuard(`echo hi; cp a.txt ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('單一 & 背景執行子也切段，echo hi & tee <frozen> → 擋下後段的 tee', () => {
    const result = runGuard(`echo hi & tee ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：open 變形與 `,\'w\')` 形狀降噪', () => {
  it('open(path, \'w\', encoding=...)（mode 後還有引數） → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','w',encoding='utf-8')"`)
    expect(result.status).toBe(2)
  })

  it('open(path, \'w\', newline=\'\') → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}', 'w', newline='')"`)
    expect(result.status).toBe(2)
  })

  it('open(path, \'w\', 1)（buffering 位置引數） → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','w',1)"`)
    expect(result.status).toBe(2)
  })

  it('print(\'x\', \'a\')（第一引數是純短字串，非路徑樣） → 放行', () => {
    // Arrange：'a' 剛好是合法的寫入 mode 字元，只有第一引數的語境條件能把它排除
    const result = runGuard(`python3 -c "print('x', 'a')"; cat ${FROZEN_FILE}`)
    expect(result.status).toBe(0)
  })

  it('字串 replace(\'o\', \'bar\')（第一引數是純短字串） → 放行', () => {
    const result = runGuard(`node -e "console.log('foo'.replace('o', 'bar'))"; cat ${FROZEN_FILE}`)
    expect(result.status).toBe(0)
  })

  it('open(凍結檔, \'w\') → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','w')"`)
    expect(result.status).toBe(2)
  })

  it('變數當路徑 p=凍結檔; open(p, \'w\') → 擋下（capture 抓不到字面值，退回 flood）', () => {
    const result = runGuard(`python3 -c "p='${FROZEN_FILE}'; open(p,'w')"`)
    expect(result.status).toBe(2)
  })

  it('案例 A23：shell 變數包在引號內 open(\'$p\', \'w\') → 擋下', () => {
    // Arrange：'$p' 要 shell 展開才知道指向哪，抓成字面值會誤判成非凍結路徑而放行；
    // 含 $ 的引號字串一律當動態引數，退回 flood 後由指令原文的 p=<凍結檔> token 命中
    const result = runGuard(`p='${FROZEN_FILE}'; python3 -c "open('$p','w')"`)
    expect(result.status).toBe(2)
  })

  it('open(path, mode=\'w\') → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}', mode='w')"`)
    expect(result.status).toBe(2)
  })

  it('open(path, \'r+\')（r+ 視為寫入模式） → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','r+')"`)
    expect(result.status).toBe(2)
  })

  it('open(os.path.join(...), \'w\')（引數是運算式） → 擋下', () => {
    const result = runGuard(`python3 -c "import os; open(os.path.join(os.getcwd(),'${FROZEN_FILE}'),'w')"`)
    expect(result.status).toBe(2)
  })

  it('呼叫 Path(...).open(\'w\') → 擋下', () => {
    const result = runGuard(`python3 -c "from pathlib import Path; Path('${FROZEN_FILE}').open('w')"`)
    expect(result.status).toBe(2)
  })

  it('fs.openSync(path, \'w\') → 擋下', () => {
    const result = runGuard(`node -e "require('fs').openSync('${FROZEN_FILE}','w')"`)
    expect(result.status).toBe(2)
  })

  it('fs.open(path, \'w\', cb)（非同步版） → 擋下', () => {
    const result = runGuard(`node -e "require('fs').open('${FROZEN_FILE}','w',()=>{})"`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：漏防回歸（刪除／截斷／複製類 API、擴充直譯器）', () => {
  it('node rmSync 刪既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').rmSync('${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('node unlinkSync 刪既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').unlinkSync('${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('node rmdirSync 砍凍結資料夾 → 擋下', () => {
    const result = runGuard('node -e "require(\'fs\').rmdirSync(\'test/e2e/specs\')"')
    expect(result.status).toBe(2)
  })

  it('node truncateSync 截斷既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').truncateSync('${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('node truncate（非同步版）截斷既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').truncate('${FROZEN_FILE}',0,()=>{})"`)
    expect(result.status).toBe(2)
  })

  it('node cpSync 複製到既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').cpSync('a.txt','${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('node cp（非同步版）複製到既有凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').cp('/tmp/a','${FROZEN_FILE}',()=>{})"`)
    expect(result.status).toBe(2)
  })

  it('python os.remove 刪既有凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import os; os.remove('${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('python shutil.rmtree 砍凍結資料夾 → 擋下', () => {
    const result = runGuard('python3 -c "import shutil; shutil.rmtree(\'test/e2e/specs\')"')
    expect(result.status).toBe(2)
  })

  it('python os.symlink 覆蓋既有凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import os; os.symlink('/tmp/a','${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('python os.link 覆蓋既有凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import os; os.link('/tmp/a','${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('npx tsx -e 用 writeFileSync 改凍結檔（tsx 直譯器） → 擋下', () => {
    const result = runGuard(`npx tsx -e "require('fs').writeFileSync('${FROZEN_FILE}','x')"`)
    expect(result.status).toBe(2)
  })

  it('python3.11（帶版本號的直譯器）heredoc 寫凍結檔 → 擋下', () => {
    const command = [
      'python3.11 - <<\'PY\'',
      `open('${FROZEN_FILE}','w')`,
      'PY',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it('patch -p1 套用 heredoc diff（diff header 指向凍結檔，無 CLI 明確目標） → 擋下', () => {
    // Arrange：unified diff 常見寫法，patch 從 --- / +++ header 讀出目標檔名，
    // 逐行切段會把 `patch` 動詞與 heredoc 內文的檔名拆到不同段而漏放，故加 heredoc 合併防線
    const command = [
      'patch -p1 <<\'EOF\'',
      `--- a/${FROZEN_FILE}`,
      `+++ b/${FROZEN_FILE}`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'EOF',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
  })

  it('printf 內容透過 ed -s 就地改凍結檔 → 擋下', () => {
    const result = runGuard(`printf 'x' | ed -s ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：rename／move 來源與目的都算目標', () => {
  it('fs.renameSync 目的是凍結檔 → 擋下', () => {
    const result = runGuard(`node -e "require('fs').renameSync('/tmp/a','${FROZEN_FILE}')"`)
    expect(result.status).toBe(2)
  })

  it('fs.renameSync 來源是凍結檔（搬走等同刪除） → 擋下', () => {
    const result = runGuard(`node -e "require('fs').renameSync('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(2)
  })

  it('os.rename 來源是凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import os; os.rename('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(2)
  })

  it('os.replace 來源是凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import os; os.replace('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(2)
  })

  it('shutil.move 來源是凍結檔 → 擋下', () => {
    const result = runGuard(`python3 -c "import shutil; shutil.move('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(2)
  })

  it('ruby File.rename 來源是凍結檔 → 擋下', () => {
    const result = runGuard(`ruby -e "File.rename('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(2)
  })

  it('shutil.copy 來源是凍結檔（不動原檔） → 放行', () => {
    const result = runGuard(`python3 -c "import shutil; shutil.copy('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(0)
  })

  it('fs.cpSync 來源是凍結檔（不動原檔） → 放行', () => {
    const result = runGuard(`node -e "require('fs').cpSync('${FROZEN_FILE}','/tmp/a')"`)
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：heredoc 邊界（<< 左移、內文散字）', () => {
  it('位元左移 1 << 8 不該被當成 heredoc 而吞掉後續指令 → 放行', () => {
    // Arrange：若 << 後允許空白接數字，終止符「8」永遠等不到，
    // 後兩行會被併進同一塊，rm 與凍結路徑同段而誤擋
    const command = [
      'node -e "console.log(1 << 8)"',
      'rm -rf /tmp/cache',
      `cat ${FROZEN_FILE}`,
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('heredoc 內文散落寫入動詞字樣（ed）、真正寫入目標在 /tmp → 放行', () => {
    // Arrange：內文只是文件敘述，動詞只認指令位置的 token
    const command = [
      'cat > /tmp/n.md <<\'EOF\'',
      `see ${FROZEN_FILE} (deprecated ed)`,
      'EOF',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
  })

  it('git commit 訊息字串內含 restore 與凍結路徑 → 放行', () => {
    // Arrange：git 子指令只認緊接 git 之後的第一個非旗標 token（此處是 commit）
    const result = runGuard(`git commit -m "chore: restore 依 ${FROZEN_FILE} 調整"`)
    expect(result.status).toBe(0)
  })

  it('sudo rm 凍結檔（動詞不在第一位但在指令位置） → 擋下', () => {
    const result = runGuard(`sudo rm ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('find -exec rm 凍結目錄（動詞在 -exec 之後） → 擋下', () => {
    const result = runGuard('find test/e2e/specs -name \'*.ts\' -exec rm {} \\;')
    expect(result.status).toBe(2)
  })

  it('bash -c "rm 凍結檔"（動詞在巢狀 shell 字串內） → 擋下', () => {
    const result = runGuard(`bash -c "rm ${FROZEN_FILE}"`)
    expect(result.status).toBe(2)
  })

  it('sh -c \'tee 凍結檔\' → 擋下', () => {
    const result = runGuard(`sh -c 'tee ${FROZEN_FILE}'`)
    expect(result.status).toBe(2)
  })

  it('git -c user.name=x commit 訊息含 restore 與凍結路徑 → 放行', () => {
    // Arrange：git 的 -c 全域選項會吃掉一個值，子指令要往後找到 commit
    const result = runGuard(`git -c user.name=x commit -m "chore: restore 依 ${FROZEN_FILE} 調整"`)
    expect(result.status).toBe(0)
  })

  // PR #141 review 第 1、2、4、6 輪抓出的繞道，2026-09-11 修補後轉為正常回歸案例
  it('<< 後接空白（如 << EOF）也辨識為 heredoc，內文指向凍結檔 → 擋下', () => {
    const command = [
      'patch -p1 << EOF',
      `--- a/${FROZEN_FILE}`,
      `+++ b/${FROZEN_FILE}`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'EOF',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it('heredoc 開啟符不在該行最後一段（如 <<\'EOF\' && echo done）內文歸給開啟符所在段 → 擋下', () => {
    const command = [
      'patch -p1 <<\'EOF\' && echo done',
      `--- a/${FROZEN_FILE}`,
      `+++ b/${FROZEN_FILE}`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'EOF',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it('呼叫 Path(...).open("r+")（r+ 視為寫入模式） → 擋下', () => {
    const result = runGuard(`python3 -c "from pathlib import Path; Path('${FROZEN_FILE}').open('r+')"`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：既有防線回歸（sed/tee/cp/redirect/git/perl）', () => {
  it('tee 寫既有凍結檔 → 擋下', () => {
    const result = runGuard(`echo x | tee ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('cp 覆蓋既有凍結檔 → 擋下', () => {
    const result = runGuard(`cp a.txt ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('echo 重導向覆蓋既有凍結檔 → 擋下', () => {
    const result = runGuard(`echo x > ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('git checkout -- 還原既有凍結檔 → 擋下', () => {
    const result = runGuard(`git checkout -- ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('perl -pi 就地改既有凍結檔 → 擋下', () => {
    const result = runGuard(`perl -pi -e 's/a/b/' ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：Write／Edit 工具路徑', () => {
  it('以 Write 工具改既有凍結檔 → 擋下', () => {
    // Act
    const result = runGuardOnFile('Write', FROZEN_FILE)

    // Assert
    expect(result.status).toBe(2)
  })

  it('以 Write 工具建立全新凍結路徑檔（尚不存在） → 放行', () => {
    // Act
    const result = runGuardOnFile('Write', 'test/e2e/specs/02-new.spec.ts')

    // Assert
    expect(result.status).toBe(0)
  })

  it('以 Edit 工具改既有凍結檔 → 擋下', () => {
    // Act
    const result = runGuardOnFile('Edit', FROZEN_FILE)

    // Assert
    expect(result.status).toBe(2)
  })

  it('以 Edit 工具改非凍結路徑檔 → 放行', () => {
    // Arrange
    mkdirSync(join(tmpDir, 'app'), { recursive: true })
    writeFileSync(join(tmpDir, 'app/foo.ts'), '// 一般檔案\n')

    // Act
    const result = runGuardOnFile('Edit', 'app/foo.ts')

    // Assert
    expect(result.status).toBe(0)
  })

  it('（已知極限）tool_input.command 不是字串 → 放行', () => {
    // Act
    const result = runGuardRaw({ tool_name: 'Bash', tool_input: { command: 123 } })

    // Assert
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：sentinel 一次性授權', () => {
  it('案例7a：sentinel 只列該檔 → 放行，且 sentinel 被刪除（清空）', () => {
    // Arrange
    mkdirSync(join(tmpDir, '.claude/tmp'), { recursive: true })
    const sentinelPath = join(tmpDir, '.claude/tmp/frozen-allow.json')
    writeFileSync(sentinelPath, JSON.stringify({ reason: '測試授權', files: [FROZEN_FILE] }))
    const command = [
      'python3 - <<\'PY\'',
      'from pathlib import Path',
      `Path('${FROZEN_FILE}').write_text('x')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
    expect(existsSync(sentinelPath)).toBe(false)
  })

  it('案例7b：sentinel 列出別的檔 → 仍擋下，且 sentinel 內容不變', () => {
    // Arrange
    mkdirSync(join(tmpDir, '.claude/tmp'), { recursive: true })
    const sentinelPath = join(tmpDir, '.claude/tmp/frozen-allow.json')
    const original = { reason: '測試授權', files: ['test/e2e/specs/other.spec.ts'] }
    writeFileSync(sentinelPath, JSON.stringify(original))
    const command = [
      'python3 - <<\'PY\'',
      'from pathlib import Path',
      `Path('${FROZEN_FILE}').write_text('x')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
    expect(JSON.parse(readFileSync(sentinelPath, 'utf8'))).toEqual(original)
  })

  it('案例7c：sentinel 列兩檔、指令只寫其一 → 放行，且 sentinel 只消耗該檔（剩另一檔）', () => {
    // Arrange
    mkdirSync(join(tmpDir, '.claude/tmp'), { recursive: true })
    const sentinelPath = join(tmpDir, '.claude/tmp/frozen-allow.json')
    const otherFile = 'test/e2e/specs/02-other.spec.ts'
    writeFileSync(sentinelPath, JSON.stringify({ reason: '測試授權', files: [FROZEN_FILE, otherFile] }))
    const command = [
      'python3 - <<\'PY\'',
      'from pathlib import Path',
      `Path('${FROZEN_FILE}').write_text('x')`,
      'PY',
    ].join('\n')

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(0)
    const remaining = JSON.parse(readFileSync(sentinelPath, 'utf8'))
    expect(remaining.files).toEqual([otherFile])
  })
})

describe('frozen-paths-guard：擋下訊息', () => {
  it('擋下時 stderr 含被擋的凍結路徑，方便使用者定位', () => {
    // Arrange
    const command = `sed -i '' 's/a/b/' ${FROZEN_FILE}`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(FROZEN_FILE)
  })

  it('flood 路徑擋下時 stderr 也列出實際被擋的凍結路徑', () => {
    // Arrange：引數是 os.path.join(...) 運算式，capture 抓不到字面值而退回 flood
    const command = `python3 -c "import os; open(os.path.join(os.getcwd(),'${FROZEN_FILE}'),'w')"`

    // Act
    const result = runGuard(command)

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(FROZEN_FILE)
  })

  it('glob 目標擋下時 stderr 列出 glob 字串本身（sentinel 要照這個字串填）', () => {
    // Act
    const result = runGuard('git checkout main -- \'test/e2e/specs/*\'')

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('test/e2e/specs/*')
  })
})

describe('frozen-paths-guard：ReDoS 防護', () => {
  it('80KB 惡意輸入（,\' 後接超長寫入模式字元串）不會回溯爆炸', () => {
    // Arrange：mode 字元類若用無界量詞（[rwaxb+]*[wax+][rwaxb+]*），
    // 這種輸入的比對成本是輸入長度的平方，80KB 要跑十秒以上
    const command = `python3 -c "open(p,'${'w'.repeat(80 * 1024)}"`

    // Act
    const startedAt = Date.now()
    const result = runGuard(command)
    const elapsed = Date.now() - startedAt

    // Assert：實測（darwin, node 22）約 80–120ms；門檻放寬到 1s 只為避開機器負載抖動，
    // 真的回溯爆炸會是數秒到數十秒，仍抓得到
    expect(result.status).toBe(0)
    expect(elapsed).toBeLessThan(1000)
  })
})

// PR #141 review 後續輪抓出的七則繞道，2026-09-11 使用者裁決後修補，轉為正常回歸案例
describe('frozen-paths-guard：MODE／OPEN_ARGS／OPEN_FIRST_ARG 邊界', () => {
  it('open(path, "wt")（Python 文字寫入模式） → 擋下', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','wt')"`)
    expect(result.status).toBe(2)
  })

  it('open(path, "rt")（純讀文字模式） → 放行，避免 t 被誤判成寫入指標', () => {
    const result = runGuard(`python3 -c "open('${FROZEN_FILE}','rt')"`)
    expect(result.status).toBe(0)
  })

  it('open() 第一引數是超過 120 字元的合法運算式（os.path.join 接長變數名） → 仍擋下', () => {
    const longExpr = 'a'.repeat(200)
    const result = runGuard(`python3 -c "open(os.path.join(${longExpr}, '${FROZEN_FILE}'), 'w')"`)
    expect(result.status).toBe(2)
  })

  it('open(1, "w")（數字檔案代號，非路徑） → 放行，不誤判成動態呼叫', () => {
    const result = runGuard(`python3 -c "open(1, 'w')"`)
    expect(result.status).toBe(0)
  })

  it('open(1, "w") 與唯讀提及凍結路徑同指令 → 放行，不因誤判觸發 flood 誤擋', () => {
    const result = runGuard(`python3 -c "open(1, 'w'); print('${FROZEN_FILE}')"`)
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：heredoc 數字終止符與 >& 重導向', () => {
  it('heredoc 數字終止符 <<1（無空白） → 擋下', () => {
    const command = [
      'patch -p1 <<1',
      `--- a/${FROZEN_FILE}`,
      `+++ b/${FROZEN_FILE}`,
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '1',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it('1 << 8 位元左移仍不誤判成 heredoc（新增數字終止符分支後的回歸） → 放行', () => {
    const result = runGuard('console.log(1 << 8)')
    expect(result.status).toBe(0)
  })

  it('echo x >& 既有凍結檔（stdout/stderr 一起導檔） → 擋下', () => {
    const result = runGuard(`echo x >& ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('2>&1（fd 複製，目標是數字非路徑） → 放行', () => {
    const result = runGuard(`echo x 2>&1 | tee /tmp/not-frozen`)
    expect(result.status).toBe(0)
  })

  it('cat 既有凍結檔 &>/dev/null（唯讀讀取） → 放行', () => {
    const result = runGuard(`cat ${FROZEN_FILE} &>/dev/null`)
    expect(result.status).toBe(0)
  })
})

// PR #141 review round 13：驗過的迴歸與新繞道，2026-09-11 使用者裁決後修補
describe('frozen-paths-guard：$(( )) 算術展開不誤判成 heredoc（round 12 的迴歸修復）', () => {
  it('$((1<<1)) 換行後接真正的寫入指令 → 擋下（round 12 曾把它誤判成 heredoc 內文而漏放）', () => {
    const command = `echo $((1<<1))\nrm ${FROZEN_FILE}`
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it('$((1<<1)) 單獨、後面沒有寫入指令 → 放行', () => {
    const result = runGuard('echo $((1<<1))')
    expect(result.status).toBe(0)
  })

  it('算術展開內含巢狀括號 $(( (1+2) << 1 )) → 放行，不誤判', () => {
    const result = runGuard('echo $(( (1+2) << 1 ))')
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：xargs -I {} 吃值旗標', () => {
  it('xargs -I {} rm 既有凍結檔（-I 的替換字串吃掉一個 token） → 擋下', () => {
    const result = runGuard(`xargs -I {} rm ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('xargs -I {} cat（唯讀子指令） → 放行', () => {
    const result = runGuard('find . -name x | xargs -I {} cat {}')
    expect(result.status).toBe(0)
  })
})

// PR #141 收尾：直譯器偵測只認指令位置、不看 heredoc 內文（使用者裁決只修誤擋這一類）
describe('frozen-paths-guard：直譯器偵測只認指令位置', () => {
  it('grep 搜尋樣式含 node 與寫檔呼叫（唯讀，沒有真的跑 node） → 放行', () => {
    const result = runGuard(`grep -R "node writeFileSync('${FROZEN_FILE}')" .`)
    expect(result.status).toBe(0)
  })

  it('heredoc 內文提到 python3 與寫檔呼叫、實際寫到 /tmp/doc → 放行', () => {
    const command = [
      'cat > /tmp/doc <<\'EOF\'',
      `用 python3 跑 writeFileSync('${FROZEN_FILE}', 'x') 會被擋`,
      'EOF',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(0)
  })

  it('echo 一段含 python3 呼叫的字串（沒有真的跑） → 放行', () => {
    const result = runGuard(`echo "python3 -c \\"open('${FROZEN_FILE}','w')\\""`)
    expect(result.status).toBe(0)
  })

  it('python3 -c 引號字串跨行（直譯器與 API 不同行，整條指令掃 API 仍要接住） → 擋下', () => {
    const result = runGuard(`python3 -c "\nopen('${FROZEN_FILE}','w')\n"`)
    expect(result.status).toBe(2)
  })

  it('npx --yes tsx -e 寫凍結檔（套件執行器帶旗標，tsx 仍算指令位置） → 擋下', () => {
    const result = runGuard(`npx --yes tsx -e "require('fs').writeFileSync('${FROZEN_FILE}','x')"`)
    expect(result.status).toBe(2)
  })

  it('heredoc 餵給管線下游的 python3 → 擋下', () => {
    const command = [
      'cat <<\'PY\' | python3',
      `open('${FROZEN_FILE}','w')`,
      'PY',
    ].join('\n')
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：wrapper 吃值旗標後的子指令位置（sudo／git）', () => {
  it('sudo -u alice rm 既有凍結檔（-u 吃掉一個值） → 擋下', () => {
    const result = runGuard(`sudo -u alice rm ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('env -u X rm 既有凍結檔（env 的 -u 吃掉一個值） → 擋下', () => {
    const result = runGuard(`env -u X rm ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('sudo rm 非凍結路徑（無吃值旗標） → 放行，確認沒有過度誤擋', () => {
    const result = runGuard('sudo rm /tmp/not-frozen')
    expect(result.status).toBe(0)
  })

  it('git --work-tree /tmp checkout -- 既有凍結檔（--work-tree 吃掉一個值） → 擋下', () => {
    const result = runGuard(`git --work-tree /tmp checkout -- ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })

  it('git --git-dir /tmp/.git status（唯讀子指令，--git-dir 吃掉一個值） → 放行', () => {
    const result = runGuard('git --git-dir /tmp/.git status')
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：timeout／nice／exec／stdbuf／! 前綴（issue #154）', () => {
  it.each([
    ['timeout 10 rm', `timeout 10 rm ${FROZEN_FILE}`],
    ['timeout -s KILL 10 rm（-s 吃值＋時限位置參數）', `timeout -s KILL 10 rm ${FROZEN_FILE}`],
    ['nice rm', `nice rm ${FROZEN_FILE}`],
    ['nice -n 5 rm（-n 吃值）', `nice -n 5 rm ${FROZEN_FILE}`],
    ['exec rm', `exec rm ${FROZEN_FILE}`],
    ['! rm', `! rm ${FROZEN_FILE}`],
    ['time ! rm（前綴後的 !）', `time ! rm ${FROZEN_FILE}`],
    ['then ! rm（控制結構內的 !）', `if true; then ! rm ${FROZEN_FILE}; fi`],
    ['stdbuf -o0 tee', `echo y | stdbuf -o0 tee ${FROZEN_FILE}`],
    ['stdbuf -o 0 tee（-o 吃值）', `echo y | stdbuf -o 0 tee ${FROZEN_FILE}`],
  ])('%s 既有凍結檔 → 擋下', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it.each([
    ['timeout 10 cat', `timeout 10 cat ${FROZEN_FILE}`],
    ['nice grep', `nice grep x ${FROZEN_FILE}`],
    ['stdbuf -o0 cat', `stdbuf -o0 cat ${FROZEN_FILE}`],
  ])('%s 既有凍結檔（唯讀） → 放行', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(0)
  })

  it.each([
    ['find ! -name tee', `find ${FROZEN_FILE} ! -name tee -print`],
    ['[ ! -f ]', `[ ! -f ${FROZEN_FILE} ] && echo x`],
    ['! grep', `! grep -q x ${FROZEN_FILE}`],
  ])('%s 既有凍結檔（! 不是寫入） → 放行', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(0)
  })

  it('sudo -n rm 既有凍結檔（-n 在 sudo 不吃值，不可沿用 nice 的吃值表） → 擋下', () => {
    const result = runGuard(`sudo -n rm ${FROZEN_FILE}`)
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：絕對路徑前綴與同類繞道（issue #164）', () => {
  // 前綴判斷原本用原始 token 比對 COMMAND_PREFIX，`/usr/bin/env` 這種帶路徑的 wrapper 進不了跳旗標邏輯，
  // 後面的動詞判不成指令位置而漏放；`\rm`、`bash -lc`、`eval` 是同一層的同類寫法
  it.each([
    ['/usr/bin/timeout 10 rm', `/usr/bin/timeout 10 rm ${FROZEN_FILE}`],
    ['/usr/bin/nice rm', `/usr/bin/nice rm ${FROZEN_FILE}`],
    ['/usr/bin/stdbuf -o0 tee', `echo y | /usr/bin/stdbuf -o0 tee ${FROZEN_FILE}`],
    ['/usr/bin/env rm', `/usr/bin/env rm ${FROZEN_FILE}`],
    ['/usr/bin/env python3 -c open(…,\'w\')（帶路徑前綴時直譯器也判不出指令位置）', `/usr/bin/env python3 -c "open('${FROZEN_FILE}','w').write('x')"`],
    ['\\rm（跳過 alias 的反斜線寫法）', `\\rm ${FROZEN_FILE}`],
    ['bash -lc "rm"（-c 併進其他旗標）', `bash -lc "rm ${FROZEN_FILE}"`],
    ['sh -ec "rm"', `sh -ec "rm ${FROZEN_FILE}"`],
    ['ksh -lc "rm"（非 bash 系 shell 的合併旗標）', `ksh -lc "rm ${FROZEN_FILE}"`],
    ['eval "rm"', `eval "rm ${FROZEN_FILE}"`],
  ])('%s 既有凍結檔 → 擋下', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it.each([
    ['/usr/bin/timeout 10 cat', `/usr/bin/timeout 10 cat ${FROZEN_FILE}`],
    ['/usr/bin/env cat', `/usr/bin/env cat ${FROZEN_FILE}`],
    ['bash -lc "cat"', `bash -lc "cat ${FROZEN_FILE}"`],
    ['grep -ic rm（-ic 前面不是 shell，不得當成 -c）', `grep -ic rm ${FROZEN_FILE}`],
  ])('%s 既有凍結檔（唯讀） → 放行', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：找檔管線接 xargs 寫入（issue #165）', () => {
  // 凍結路徑在管線上游、寫入動詞在下游 xargs 段，逐段判斷兩邊都不像寫入而漏放
  it.each([
    ['grep -l | xargs sed -i（glob）', 'grep -l x test/e2e/specs/*.ts | xargs sed -i \'\' \'s/x/y/\''],
    ['grep -l | xargs sed -i（檔名）', `grep -l x ${FROZEN_FILE} | xargs sed -i '' 's/x/y/'`],
    ['grep -rl 目錄 | xargs perl -pi', 'grep -rl x test/e2e/specs | xargs perl -pi -e \'s/x/y/\''],
    ['ls glob | xargs rm', 'ls test/e2e/specs/*.ts | xargs rm'],
    ['find 目錄 | xargs -I {} rm {}', 'find test/e2e/specs -name "*.ts" | xargs -I {} rm {}'],
    ['三段管線，寫入在最後', 'grep -l x test/e2e/specs/*.ts | sort | xargs /usr/bin/sed -i "" "s/x/y/"'],
    ['上游帶 sudo 的 xargs', 'ls test/e2e/specs/*.ts | sudo xargs rm'],
    ['xargs -n 1 rm（吃值旗標，值分開寫）', 'ls test/e2e/specs/*.ts | xargs -n 1 rm'],
    ['xargs -P 4 -L 1 rm', 'ls test/e2e/specs/*.ts | xargs -P 4 -L 1 rm'],
    ['xargs -d 分隔符 rm', 'ls test/e2e/specs/*.ts | xargs -d x rm'],
    ['|& 接管線', 'ls test/e2e/specs/*.ts |& xargs rm'],
    ['xargs -J % rm %（BSD 替換字串旗標）', 'ls test/e2e/specs/*.ts | xargs -J % rm %'],
  ])('%s → 擋下', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(2)
  })

  it.each([
    ['cat | grep（唯讀）', `cat ${FROZEN_FILE} | grep x`],
    ['grep -l | xargs wc -l（xargs 接唯讀）', 'grep -l x test/e2e/specs/*.ts | xargs wc -l'],
    ['find | xargs -I {} cat {}', 'find test/e2e/specs -name x | xargs -I {} cat {}'],
    ['cat | tee /tmp（tee 寫自己的引數，不是上游路徑）', `cat ${FROZEN_FILE} | tee /tmp/out.txt`],
    ['上游凍結路徑在前一條指令（; 不是管線）', `cat ${FROZEN_FILE}; ls /tmp | xargs rm`],
    ['|| 不是管線', `grep -q x ${FROZEN_FILE} || ls /tmp | xargs rm`],
    ['xargs grep -in sed（sed 只是搜尋字）', 'grep -l x test/e2e/specs/*.ts | xargs grep -in sed'],
    ['xargs -i sed -n（-i 是 xargs 的旗標，sed 沒帶 -i）', 'grep -l x test/e2e/specs/*.ts | xargs -i sed -n 1p {}'],
    ['xargs grep "git checkout"（git 只是搜尋字）', 'grep -l x test/e2e/specs/*.ts | xargs grep -l "git checkout"'],
  ])('%s → 放行', (_label, command) => {
    const result = runGuard(command)
    expect(result.status).toBe(0)
  })
})

describe('frozen-paths-guard：跨 worktree 以目標所屬 repo 判斷（issue #199）', () => {
  // 真的 git repo M（session 目錄）＋兩個 worktree：兄弟目錄 B（對應 ../nuxt4-template-issue-N）與
  // 巢狀 M/.claude/worktrees/w1（對應 isolation 分身）；另有無關 repo U 與不在 git repo 內的 plainDir
  let base: string
  let repoM: string
  let wtB: string
  let wtNested: string
  let repoU: string
  let plainDir: string
  const F = 'spec/gherkin-feature/b.feature'
  const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' })

  function seed(root: string) {
    mkdirSync(join(root, 'spec/gherkin-feature'), { recursive: true })
    writeFileSync(join(root, F), 'Feature: b\n')
  }

  // 驅動 hook：session 開在 repoM、工作目錄 cwd（對應 hook 輸入的 cwd 欄位）
  function run(payload: Record<string, unknown>, cwd?: string) {
    return spawnSync('node', [HOOK_PATH], {
      input: JSON.stringify({ ...payload, ...(cwd ? { cwd } : {}) }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: repoM },
      encoding: 'utf8',
      timeout: 5000,
    })
  }
  const edit = (filePath: string, cwd?: string) => run({ tool_name: 'Edit', tool_input: { file_path: filePath } }, cwd)
  const write = (filePath: string) => run({ tool_name: 'Write', tool_input: { file_path: filePath } })
  const bash = (command: string, cwd?: string) => run({ tool_name: 'Bash', tool_input: { command } }, cwd)

  beforeEach(() => {
    // Arrange：M 提交一支凍結檔後開兩個 worktree；B 另放一支只存在於 B 的凍結檔（M 沒有，舊版拿 M 查既有檔會放行）
    base = realpathSync(mkdtempSync(join(tmpdir(), 'frozen-guard-wt-')))
    repoM = join(base, 'm')
    wtB = join(base, 'b')
    wtNested = join(repoM, '.claude/worktrees/w1')
    repoU = join(base, 'u')
    plainDir = join(base, 'plain')
    mkdirSync(repoM)
    git('init', '-q', repoM)
    seed(repoM)
    git('-C', repoM, 'add', '.')
    git('-C', repoM, 'commit', '-qm', 'init')
    git('-C', repoM, 'worktree', 'add', '-q', wtB, '-b', 'wt-b')
    git('-C', repoM, 'worktree', 'add', '-q', wtNested, '-b', 'wt-n')
    writeFileSync(join(wtB, 'spec/gherkin-feature/only-b.feature'), 'Feature: only b\n')
    mkdirSync(join(wtB, '.claude/tmp'), { recursive: true })
    mkdirSync(repoU)
    git('init', '-q', repoU)
    seed(repoU)
    mkdirSync(plainDir)
    seed(plainDir)
  })

  afterEach(() => {
    rmSync(base, { recursive: true, force: true })
  })

  it('跨 worktree：Edit 兄弟 worktree 的既有凍結檔（絕對路徑）→ 擋下，訊息帶出 worktree 與授權位置', () => {
    // Act
    const result = edit(join(wtB, F))

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${F}（worktree：${wtB}`)
  })

  it('跨 worktree：Write 兄弟 worktree 的凍結區新檔 → 放行（新增不受限）', () => {
    // Act
    const result = write(join(wtB, 'spec/gherkin-feature/new.feature'))

    // Assert
    expect(result.status).toBe(0)
  })

  it.each([
    ['絕對路徑 echo >>', () => bash(`echo x >> ${join(wtB, F)}`)],
    ['絕對路徑 sed -i', () => bash(`sed -i '' 's/b/c/' ${join(wtB, F)}`)],
    ['相對路徑 ../b（只存在於 B 的檔）', () => bash('echo x >> ../b/spec/gherkin-feature/only-b.feature')],
    ['cwd 在 B、相對路徑（session cd 過去）', () => bash('echo x >> spec/gherkin-feature/only-b.feature', wtB)],
  ])('跨 worktree：Bash %s 寫既有凍結檔 → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })

  it('巢狀 worktree（isolation 分身位置）：Edit 絕對路徑、cwd 在巢狀 worktree 的相對路徑 Bash → 都擋下', () => {
    // Act
    const byEdit = edit(join(wtNested, F))
    const byBash = bash(`echo x >> ${F}`, wtNested)

    // Assert
    expect(byEdit.status).toBe(2)
    expect(byBash.status).toBe(2)
  })

  it('凍結目錄底下多一個假 .git（submodule 形狀）→ 仍擋下，不能拿來繞道', () => {
    // Arrange
    writeFileSync(join(repoM, 'spec/gherkin-feature/.git'), 'gitdir: ../../.git/modules/x\n')

    // Act
    const result = edit(join(repoM, F))

    // Assert
    expect(result.status).toBe(2)
  })

  it('無關的 git repo、不在 git repo 內的目錄 → 放行（不誤擋別的專案）', () => {
    // Act
    const results = [edit(join(repoU, F)), bash(`echo x >> ${join(repoU, F)}`), edit(join(plainDir, F)), bash(`echo x >> ${join(plainDir, F)}`)]

    // Assert
    expect(results.map(r => r.status)).toEqual([0, 0, 0, 0])
  })

  it('sentinel 寫在 B 自己的 .claude/tmp：放行一次即消耗，第二次仍擋', () => {
    // Arrange
    const sentinelPath = join(wtB, '.claude/tmp/frozen-allow.json')
    writeFileSync(sentinelPath, JSON.stringify({ reason: '測試授權', files: [F] }))

    // Act
    const first = edit(join(wtB, F))
    const second = edit(join(wtB, F))

    // Assert
    expect(first.status).toBe(0)
    expect(existsSync(sentinelPath)).toBe(false)
    expect(second.status).toBe(2)
  })

  it('sentinel 寫在 M（session 目錄）不授權 B 的目標，且 M 的 sentinel 不被消耗', () => {
    // Arrange
    mkdirSync(join(repoM, '.claude/tmp'), { recursive: true })
    const sentinelPath = join(repoM, '.claude/tmp/frozen-allow.json')
    const original = { reason: '測試授權', files: [F] }
    writeFileSync(sentinelPath, JSON.stringify(original))

    // Act
    const result = edit(join(wtB, F))

    // Assert
    expect(result.status).toBe(2)
    expect(JSON.parse(readFileSync(sentinelPath, 'utf8'))).toEqual(original)
  })

  it('一條指令同時寫 M 與 B，只有 B 有授權 → 擋下，B 的 sentinel 不被消耗', () => {
    // Arrange
    const sentinelPath = join(wtB, '.claude/tmp/frozen-allow.json')
    const original = { reason: '測試授權', files: [F] }
    writeFileSync(sentinelPath, JSON.stringify(original))

    // Act
    const result = bash(`echo x >> ${join(wtB, F)}; echo y >> ${join(repoM, F)}`)

    // Assert
    expect(result.status).toBe(2)
    expect(JSON.parse(readFileSync(sentinelPath, 'utf8'))).toEqual(original)
  })
  it.each([
    ['cd 到 B 再用相對路徑 rm', () => bash('cd ../b && rm spec/gherkin-feature/only-b.feature')],
    ['cd 到 B 再 sed -i', () => bash('cd ../b; sed -i "" s/b/c/ spec/gherkin-feature/only-b.feature')],
    ['git -C B rm', () => bash('git -C ../b rm spec/gherkin-feature/only-b.feature')],
    ['cd 絕對路徑再 echo >>', () => bash(`cd ${wtB} && echo x >> spec/gherkin-feature/only-b.feature`)],
  ])('指令內換目錄：%s → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })

  it('指令內換目錄：git -C 只影響自己那一段，下一段的相對路徑回到 M 解析 → 放行（只存在於 B 的檔在 M 不存在）', () => {
    // Act：git -C 指到 B 但只是唯讀；下一段的 echo 對 M 解析，M 沒有 only-b.feature，屬於新增
    const result = bash('git -C ../b status && echo x >> spec/gherkin-feature/only-b.feature')

    // Assert
    expect(result.status).toBe(0)
  })

  it('同一支檔同時被精確定位到 B、子字串比對猜在 M → 兩處都要授權（寧可誤擋），只有 B 的授權時擋下且不消耗', () => {
    // Arrange：dd 的 of= 走子字串比對（root 猜 cwd 所在的 M），絕對路徑精確定位到 B；兩者指向同一個 rel
    const sentinelPath = join(wtB, '.claude/tmp/frozen-allow.json')
    const original = { reason: '測試授權', files: [F] }
    writeFileSync(sentinelPath, JSON.stringify(original))

    // Act
    const result = bash(`dd if=/dev/null of=x/${F}; echo x >> ${join(wtB, F)}`)

    // Assert
    expect(result.status).toBe(2)
    expect(JSON.parse(readFileSync(sentinelPath, 'utf8'))).toEqual(original)
  })

  it.each([
    ['git -C B 的輸出重導向寫回 M 的凍結檔（重導向由 shell 解析，不看 -C）', () => bash(`git -C ../b log > ${F}`)],
    ['cd 到 B 後用 python 寫只存在於 B 的檔', () => bash('cd ../b && python3 -c "open(\'spec/gherkin-feature/only-b.feature\',\'w\').write(\'x\')"')],
    ['cd 到 B 後用 node 寫只存在於 B 的檔', () => bash('cd ../b && node -e "require(\'fs\').writeFileSync(\'spec/gherkin-feature/only-b.feature\',\'x\')"')],
    ['cd -P 帶旗標', () => bash('cd -P ../b && rm spec/gherkin-feature/only-b.feature')],
    ['cd -- 帶結束旗標', () => bash('cd -- ../b && rm spec/gherkin-feature/only-b.feature')],
    ['builtin cd', () => bash('builtin cd ../b && rm spec/gherkin-feature/only-b.feature')],
  ])('指令內換目錄（第 2 輪）：%s → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })

  it('grep 的 -C 不是 git 換目錄：`grep git -C 2` 之後的重導向仍對 cwd 解析，寫只存在於 B 的檔（cwd 在 B）→ 擋下', () => {
    // Act
    const result = bash('grep git -C 2 README > spec/gherkin-feature/only-b.feature', wtB)

    // Assert
    expect(result.status).toBe(2)
  })

  it('經 symlink 指到專案目錄的 glob 寫入（目標字串不存在）→ 擋下', () => {
    // Arrange：專案目錄的 symlink，glob 字串本身不存在，要解最近存在的祖先才對得上專案目錄
    const link = join(base, 'link-m')
    symlinkSync(repoM, link)

    // Act
    const result = bash(`rm ${link}/spec/gherkin-feature/*.feature`)

    // Assert
    expect(result.status).toBe(2)
  })
  it.each([
    ['cd 到打錯字的目錄（cd 失敗、shell 留在 M）再 rm', () => bash(`cd spec/gherkin-feature/typo; rm ${F}`)],
    ['cd 失敗接 || true 再 git checkout', () => bash(`cd spec/gherkin-feature/typo || true; git checkout -- ${F}`)],
    ['grep -c cd <凍結檔> 的 cd 被誤判成指令後再 rm', () => bash(`grep -c cd ${F}; rm ${F}`)],
    ['cd 到 B 後仍寫 M 的檔（cd 是否成功不確定，兩邊都算）', () => bash(`cd ../b; rm ${F}`)],
  ])('指令內換目錄（第 3 輪，不比沒追蹤 cd 時少擋）：%s → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['timeout 10 git -C B checkout', () => bash('timeout 10 git -C ../b checkout -- spec/gherkin-feature/only-b.feature')],
    ['nice -n 5 git -C B rm', () => bash('nice -n 5 git -C ../b rm spec/gherkin-feature/only-b.feature')],
    ['sudo -u x git -C B rm', () => bash('sudo -u x git -C ../b rm spec/gherkin-feature/only-b.feature')],
    ['多個 -C 依序疊加（-C .. -C b）', () => bash('git -C .. -C b rm spec/gherkin-feature/only-b.feature')],
  ])('git -C（第 3 輪）：%s 寫只存在於 B 的檔 → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })
  it.each([
    ['Edit', () => edit(join(repoM, 'spec/gherkin-feature/linked/x.feature'))],
    ['Bash 重導向', () => bash('echo x >> spec/gherkin-feature/linked/x.feature', repoM)],
  ])('凍結目錄底下的子目錄是指向 repo 外的 symlink：%s 既有檔 → 仍以原路徑擋下（PR #205 review）', (_label, act) => {
    // Arrange
    const outside = join(base, 'outside')
    mkdirSync(outside)
    writeFileSync(join(outside, 'x.feature'), 'Feature: x\n')
    symlinkSync(outside, join(repoM, 'spec/gherkin-feature/linked'))

    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })
})

describe('frozen-paths-guard：跨 worktree 補洞（issue #206）', () => {
  // 三種結構：M＋兄弟 worktree B（測 -C 黏連）、M＋路徑含空白的 worktree S、
  // `git init --separate-git-dir` 的主工作區 C（.git 是檔案、沒有 commondir）＋其 worktree D
  let base: string
  let repoM: string
  let wtB: string
  let wtS: string
  let wtR: string
  let repoC: string
  let wtD: string
  const F = 'spec/gherkin-feature/b.feature'
  const ONLY = 'spec/gherkin-feature/only.feature'
  const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' })

  function seedAndCommit(root: string) {
    mkdirSync(join(root, 'spec/gherkin-feature'), { recursive: true })
    writeFileSync(join(root, F), 'Feature: b\n')
    git('-C', root, 'add', '.')
    git('-C', root, 'commit', '-qm', 'init')
  }

  // 驅動 hook：session 開在 projectDir、工作目錄同 projectDir
  function run(projectDir: string, payload: Record<string, unknown>) {
    return spawnSync('node', [HOOK_PATH], {
      input: JSON.stringify({ cwd: projectDir, ...payload }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      encoding: 'utf8',
      timeout: 5000,
    })
  }
  const edit = (projectDir: string, filePath: string) => run(projectDir, { tool_name: 'Edit', tool_input: { file_path: filePath } })
  const bash = (projectDir: string, command: string, cwd = projectDir) => run(projectDir, { tool_name: 'Bash', tool_input: { command }, cwd })

  // 每個案例都只餵 hook、不真的執行指令，結構不會被改動：整組只建一次（每次重建要十幾個 git 子行程）
  beforeAll(() => {
    // Arrange：每個 worktree 各放一支只存在於該 worktree 的凍結檔（session 目錄沒有，改查 session 目錄會放行）
    base = realpathSync(mkdtempSync(join(tmpdir(), 'frozen-guard-206-')))
    repoM = join(base, 'm')
    wtB = join(base, 'b')
    wtS = join(base, 'with space')
    wtR = join(base, 'with rm')
    repoC = join(base, 'c')
    wtD = join(base, 'd')
    mkdirSync(repoM)
    git('init', '-q', repoM)
    seedAndCommit(repoM)
    git('-C', repoM, 'worktree', 'add', '-q', wtB, '-b', 'wt-b')
    git('-C', repoM, 'worktree', 'add', '-q', wtS, '-b', 'wt-s')
    git('-C', repoM, 'worktree', 'add', '-q', wtR, '-b', 'wt-r')
    git('init', '-q', '--separate-git-dir', join(base, 'c.git'), repoC)
    seedAndCommit(repoC)
    git('-C', repoC, 'worktree', 'add', '-q', wtD, '-b', 'wt-d')
    for (const root of [wtB, wtS, wtR, repoC, wtD])
      writeFileSync(join(root, ONLY), 'Feature: only\n')
    writeFileSync(join(repoC, 'spec/gherkin-feature/only-c.feature'), 'Feature: only c\n')
  })

  afterAll(() => {
    rmSync(base, { recursive: true, force: true })
  })

  it.each([
    ['git -C../b rm', 'git -C../b rm spec/gherkin-feature/only.feature'],
    ['git -C../b checkout --', 'git -C../b checkout -- spec/gherkin-feature/only.feature'],
  ])('git -C 與目錄黏連：%s 寫只存在於 B 的凍結檔 → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command)

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['雙引號重導向 echo >>', () => `echo x >> "${join(wtS, ONLY)}"`],
    ['單引號重導向 echo >', () => `echo x > '${join(wtS, ONLY)}'`],
    ['雙引號 rm', () => `rm "${join(wtS, ONLY)}"`],
    ['反斜線跳脫空白 rm', () => `rm ${join(wtS, ONLY).replace(' ', '\\ ')}`],
    ['反斜線跳脫空白的重導向 echo >>', () => `echo x >> ${join(wtS, ONLY).replace(' ', '\\ ')}`],
    ['只有 worktree 部分加引號的重導向 echo >>', () => `echo x >> "${wtS}"/${ONLY}`],
  ])('worktree 路徑含空白：%s 寫只存在於該 worktree 的凍結檔 → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['cd 到含空白的 worktree 再用相對路徑 rm', () => `cd "${wtS}" && rm ${ONLY}`],
    ['git -C 含空白的 worktree（雙引號分開寫）', () => `git -C "${wtS}" rm ${ONLY}`],
    ['git -C 含空白的 worktree（單引號黏連）', () => `git -C'${wtS}' rm ${ONLY}`],
  ])('換目錄到含空白的 worktree（/ship L5）：%s 寫只存在於該 worktree 的凍結檔 → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['dd of=<B 的絕對路徑>', () => `dd if=/dev/null of=${join(wtB, ONLY)}`],
    ['dd of="<含空白 worktree 的絕對路徑>"', () => `dd if=/dev/null of="${join(wtS, ONLY)}"`],
    ['dd of=<B 的相對路徑 ../b/…>', () => `dd if=/dev/null of=../b/${ONLY}`],
    ['第二個 = 之後才是路徑（--define=out=<B 的絕對路徑>）', () => `dd if=/dev/null --define=out=${join(wtB, ONLY)}`],
  ])('`=` 後接其他 worktree 的絕對路徑（/ship L5）：%s → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['git -C "" 空字串引數在 -C../b 之前', () => `git -C "" -C../b rm ${ONLY}`],
    ['直譯器寫入目標由引數傳入、路徑含空白（flood 回退）', () => `node -e 'require("fs").writeFileSync(process.argv[1], "x")' "${join(wtS, ONLY)}"`],
    ['上游有含空白凍結路徑、下游 xargs git -C 含空白目錄 rm', () => `printf '%s\\0' "${join(wtS, ONLY)}" | xargs -0 git -C "${wtS}" rm --`],
  ])('第 207 號 PR review：%s → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['git -C "" status', () => 'git -C "" status'],
    ['直譯器只印出含空白的凍結路徑', () => `node -e 'console.log(process.argv[1])' "${join(wtS, ONLY)}"`],
    ['上游有凍結路徑、下游 xargs git -C 含空白目錄 log', () => `printf '%s\\0' "${join(wtS, ONLY)}" | xargs -0 git -C "${wtS}" log --`],
    ['cd 進凍結目錄後 sed -i "" 改凍結區外的檔（"" 不可解析成凍結目錄本身）', () => `cd ${join(repoM, 'spec/gherkin-feature')} && sed -i '' s/a/b/ ../../README.md`],
  ])('第 207 號 PR review 誤擋對照：%s → 放行', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(0)
  })

  it.each([
    ['cwd 在凍結目錄、dd of=<B 的絕對路徑>（整個 token 先解析成不存在的凍結路徑）', () => `dd if=/dev/null of=${join(wtB, ONLY)}`],
    ['cwd 在凍結目錄、--define=out=<B 的絕對路徑>（中間值不存在）', () => `dd if=/dev/null --define=out=${join(wtB, ONLY)}`],
    ['cwd 在凍結目錄、未知變數開頭的路徑（精確定位不存在，仍要試子字串比對）', () => `rm "$WT/${F}"`],
  ])('第 207 號 PR review 第 2 輪：%s → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command(), join(repoM, 'spec/gherkin-feature'))

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['heredoc 內文先把含空白路徑存變數再 open(p, "w")，內文註解有落單的引號', 2, () => `python3 - <<'PY'\n# don't touch\np = "${join(wtS, ONLY)}"\nopen(p, 'w').write('x')\nPY`],
    ['heredoc 內文同形但只讀取', 0, () => `python3 - <<'PY'\np = "${join(wtS, ONLY)}"\nprint(open(p).read())\nPY`],
    ['xargs -I 替換字串含空白後接 rm 含空白路徑', 2, () => `printf '%s\\n' x | xargs -I "replace me" rm "${join(wtS, ONLY)}" "replace me"`],
    ['echo 字串裡提到 rm 與含空白路徑', 0, () => `echo "rm ${join(wtS, ONLY)}"`],
  ])('第 207 號 PR review 第 2 輪：%s → exit %i', (_label, expected, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(expected)
  })

  it.each([
    ['git -C 目錄名結尾是 rm 的 worktree 後接 status（唯讀）', 0, () => `git -C "${wtR}" status -- ${ONLY}`],
    ['上游有凍結路徑、下游 xargs git -C 目錄名結尾 rm 的 worktree log（唯讀）', 0, () => `printf '%s\\0' "${join(wtR, ONLY)}" | xargs -0 git -C "${wtR}" log --`],
    ['git -C 目錄名結尾是 rm 的 worktree 後接 rm（寫入）', 2, () => `git -C "${wtR}" rm ${ONLY}`],
    ['heredoc 內 Python 三引號跨行、路徑行沒有成對引號，open(p, "w")', 2, () => `python3 - <<'PY'\np = """\n${join(wtS, ONLY)}""".strip()\nopen(p, 'w')\nPY`],
    ['heredoc 內 Python 三引號跨行，只讀取', 0, () => `python3 - <<'PY'\np = """\n${join(wtS, ONLY)}""".strip()\nprint(open(p).read())\nPY`],
  ])('第 207 號 PR review 待決定項：%s → exit %i', (_label, expected, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(expected)
  })

  it.each([
    ['sudo -u git 的使用者名稱不是 git 指令', () => `sudo -u git git rm ${F}`],
    ['GIT_TRACE=/tmp/git 的指派不是 git 指令', () => `GIT_TRACE=/tmp/git git checkout -- ${F}`],
    ['sudo -u git 後的 git -C 換到 B', () => `sudo -u git git -C ../b rm ${ONLY}`],
    ['管線下游 xargs sudo -u git git rm', () => `ls ${F} | xargs sudo -u git git rm`],
    ['多行 python -c 的三引號路徑行（含空白 worktree）', () => `python3 -c '\np = """\n${join(wtS, ONLY)}""".strip()\nopen(p, "w")'`],
  ])('第 207 號 PR 本地覆審：%s → 擋下', (_label, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['xargs rm 的 heredoc 內文是加引號的含空白路徑', 2, () => `xargs rm <<'EOF'\n"${join(wtS, ONLY)}"\nEOF`],
    ['xargs rm 的 heredoc 內文是反斜線跳脫空白的路徑', 2, () => `xargs rm <<'EOF'\n${join(wtS, ONLY).replace(' ', '\\ ')}\nEOF`],
    ['xargs cat 的 heredoc 內文是加引號的含空白路徑（唯讀）', 0, () => `xargs cat <<'EOF'\n"${join(wtS, ONLY)}"\nEOF`],
  ])('第 207 號 PR 第 3 次 review：%s → exit %i', (_label, expected, command) => {
    // Act
    const result = bash(repoM, command())

    // Assert
    expect(result.status).toBe(expected)
  })

  it('worktree 路徑含空白：寫該 worktree 凍結區的新檔 → 放行（新增不受限）', () => {
    // Act
    const result = bash(repoM, `echo x >> "${join(wtS, 'spec/gherkin-feature/new.feature')}"`)

    // Assert
    expect(result.status).toBe(0)
  })

  it.each([
    ['session＝主工作區 C，Edit worktree D 的既有凍結檔', () => edit(repoC, join(wtD, ONLY))],
    ['session＝worktree D，Edit 主工作區 C 的既有凍結檔', () => edit(wtD, join(repoC, 'spec/gherkin-feature/only-c.feature'))],
  ])('--separate-git-dir：%s → 擋下', (_label, act) => {
    // Act
    const result = act()

    // Assert
    expect(result.status).toBe(2)
  })
})
