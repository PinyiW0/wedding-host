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
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { normalize, relative, resolve } from 'node:path'

// 凍結清單以本陣列為準（一律小寫）；增刪時須同步 rules/frozen-paths.md（frontmatter paths + 表格）
const FROZEN = ['test/e2e/specs', 'spec/gherkin-feature', 'spec/e2e-flows']

// Bash 寫入類動詞：與凍結路徑同段出現即視為寫入
const WRITE_VERBS = new Set(['tee', 'cp', 'mv', 'rm', 'ln', 'truncate', 'dd'])
// git 會改寫工作區檔案的子指令（git add/diff/log 等唯讀或只動 index 的不算）
const GIT_WRITE_SUBCMDS = new Set(['checkout', 'restore', 'apply', 'mv', 'rm', 'clean', 'stash'])

const realpath = realpathSync.native ?? realpathSync
let projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()
try {
  projectRoot = realpath(projectRoot)
}
catch {}

function matchFrozen(rel) {
  return FROZEN.find(p => rel === p || rel.startsWith(`${p}/`))
}

// 判斷單一 token 是否指向凍結路徑，回傳 repo 相對路徑（小寫），否則 null
function frozenRelOf(word) {
  const expanded = word.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?/, projectRoot)
  // 能落地的路徑：resolve（存在時含 symlink 解析）後對 projectRoot 取相對再比對
  try {
    const abs = resolve(projectRoot, expanded)
    const real = existsSync(abs) ? realpath(abs) : abs
    const rel = relative(projectRoot, real).toLowerCase()
    if (!rel.startsWith('..') && matchFrozen(rel))
      return rel
  }
  catch {}
  // 絕對路徑上面已可精確判定，不再做子字串比對（避免 /tmp/spec/... 誤中）
  if (expanded.startsWith('/'))
    return null
  // 落不了地的 token（帶未知變數前綴、dd 的 of= 等）：子字串比對，寧可誤擋
  const lower = normalize(expanded).toLowerCase()
  for (const p of FROZEN) {
    const idx = lower.indexOf(p)
    if (idx === -1)
      continue
    const before = idx === 0 ? '' : lower[idx - 1]
    const after = lower[idx + p.length]
    if ((!before || before === '/' || before === '=') && (!after || after === '/'))
      return lower.slice(idx)
  }
  return null
}

// 解析 Bash command，回傳會被寫入的凍結路徑清單（repo 相對、小寫）
function bashFrozenWrites(command) {
  const targets = new Set()
  for (const seg of command.split(/\|\||&&|;|\||\n/)) {
    const words = seg.split(/[\s"'()`;&|<>]+/).filter(Boolean)
    const frozen = words.map(frozenRelOf).filter(Boolean)
    if (!frozen.length)
      continue
    const hasWriteVerb = words.some(w => WRITE_VERBS.has(w.slice(w.lastIndexOf('/') + 1)))
      || (words.includes('sed') && words.some(w => /^-[a-z]*i|^--in-place/i.test(w)))
      || (words.includes('git') && words.some(w => GIT_WRITE_SUBCMDS.has(w)))
    if (hasWriteVerb) {
      frozen.forEach(t => targets.add(t))
      continue
    }
    // 無寫入動詞的段落：只有重導向（> >>）目標比中凍結路徑才算寫入
    for (const m of seg.matchAll(/>{1,2}\s*["']?([^\s"'<>|;&]+)/g)) {
      const rel = frozenRelOf(m[1])
      if (rel)
        targets.add(rel)
    }
  }
  return [...targets]
}

// 一次性授權通道：全部目標都在 sentinel 清單內才放行，並一次消耗
function tryConsumeSentinel(rels) {
  const sentinel = resolve(projectRoot, '.claude/tmp/frozen-allow.json')
  if (!existsSync(sentinel))
    return false
  try {
    const allow = JSON.parse(readFileSync(sentinel, 'utf8'))
    const files = Array.isArray(allow?.files) ? allow.files : []
    const used = []
    for (const rel of new Set(rels)) {
      const i = files.findIndex((f, fi) => !used.includes(fi) && String(f).toLowerCase() === rel)
      if (i === -1)
        return false
      used.push(i)
    }
    const remaining = files.filter((_, i) => !used.includes(i))
    if (remaining.length === 0)
      rmSync(sentinel)
    else
      writeFileSync(sentinel, JSON.stringify({ ...allow, files: remaining }, null, 2))
    return true
  }
  catch {
    return false // sentinel 壞掉視同不存在，維持擋下的預設
  }
}

function deny(rels) {
  console.error(
    `凍結區保護：${rels.join('、')} 屬於凍結路徑，禁止修改既有檔案。`
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

  if (input?.tool_name === 'Bash') {
    const command = String(input?.tool_input?.command ?? '')
    if (!command)
      process.exit(0)
    // 只擋「既有檔」；寫入不存在的目標＝新增，放行
    const existing = bashFrozenWrites(command)
      .filter(rel => existsSync(resolve(projectRoot, rel)))
    if (!existing.length)
      process.exit(0)
    if (tryConsumeSentinel(existing))
      process.exit(0)
    deny(existing)
  }

  const filePath = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path
  if (!filePath)
    process.exit(0)

  let abs = resolve(projectRoot, filePath)
  if (existsSync(abs)) {
    try {
      abs = realpath(abs)
    }
    catch {}
  }
  const rel = relative(projectRoot, abs).toLowerCase()
  if (!matchFrozen(rel))
    process.exit(0)

  // Write 到不存在的檔案 = 授權產出者新增合約，放行
  if (input.tool_name === 'Write' && !existsSync(abs))
    process.exit(0)

  if (tryConsumeSentinel([rel]))
    process.exit(0)
  deny([rel])
})
