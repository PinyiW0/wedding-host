// server 安全防線（PostToolUse hook）
// 政策：編輯 server/**/*.ts 時（1）首次注入 server-security 8 條摘要到 context；
// （2）對 server/api/** handler 檔機械偵測高信心違規（規則 1 巢狀 IDOR、規則 3 mass
// assignment），命中 exit 2 由 stderr 回饋模型修正——PostToolUse 不擋寫入，回饋即防線。
// 誤報豁免通道：經使用者確認後寫 .claude/tmp/server-security-allow.json
//（{ reason, files: [<repo 相對路徑>] }），hook 比中一次即從清單移除，與凍結區
// frozen-allow.json 分開（語意不同：一個授權修改、一個豁免誤報）。
// 為什麼用 hook 不用 rules/server-security.md 的 paths：paths 觸發規則在 subagent 內
// 不注入（2026-07-06 實測），只有 hook 對主對話與所有 subagent 都生效。
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

// 摘要與 .claude/rules/server-security.md 的 8 條表格同步；改表格時須同步本陣列
const RULE_SUMMARY = [
  '1 巢狀端點查詢必含全部父層 path 參數（防跨租戶 IDOR）',
  '2 同目錄兄弟 handler 的 scope 過濾逐字等價（動手前先讀兄弟檔）',
  '3 寫入禁止 spread body（`...body`／`Object.assign`），逐欄白名單手構；id／owner／租戶／狀態機欄位由 server 決定',
  '4 寫入端點必經 runtime 驗證（數字整數＋範圍、enum 白名單、字串長度上限，違反回 400）',
  '5 操作者身分只取自 auth context，不信 body/query 的 xxxId',
  '6 回應白名單挑欄位；密碼雜湊／token／內部備註不進回應；公開端點只回已發布資料的公開層',
  '7 secret 一律走 env（runtimeConfig），production 啟動守衛擋 dev 預設值',
  '8 錯誤訊息用固定文案不帶 stack／DB 原文；歸屬檢查失敗回 404 不洩漏存在性',
]

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let raw = ''
process.stdin.on('data', (c) => { raw += c })
process.stdin.on('end', () => {
  try {
    main()
  }
  catch {
    process.exit(0) // hook 自身任何錯誤一律放行，不癱瘓編輯
  }
})

function main() {
  let input
  try {
    input = JSON.parse(raw)
  }
  catch {
    process.exit(0)
  }

  const filePath = input?.tool_input?.file_path
  if (!filePath)
    process.exit(0)

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const abs = resolve(projectDir, filePath)
  const rel = relative(projectDir, abs)
  if (!(rel.startsWith('server/') && rel.endsWith('.ts')))
    process.exit(0)

  // 機械偵測只跑 server/api/** handler 檔（server/mock/data/** 種子資料 spread 複製合法，
  // 天然不在範圍內），命中即 exit 2；utils／middleware 等只吃摘要注入
  if (rel.startsWith('server/api/')) {
    const violations = detect(abs, rel)
    if (violations.length > 0 && !consumeAllowSentinel(projectDir, rel)) {
      console.error(
        `server 安全機械偵測（檔案已寫入，請立即修正）：\n${violations.map(v => `- ${v}`).join('\n')}\n`
        + `完整判準與正確寫法讀 .claude/rules/server-security.md。`
        + `若確認誤報，向使用者說明後寫 .claude/tmp/server-security-allow.json`
        + `（{ "reason": "...", "files": ["${rel}"] }）再重試，比中一次即消耗。`,
      )
      process.exit(2)
    }
  }

  // 首次觸碰某檔時注入 8 條摘要（每 session 每檔一次，控噪音）
  if (markFirstTouch(projectDir, input?.session_id, rel)) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          `本專案 server 端安全慣例（每條對應實戰漏洞，完整判準與示例在 .claude/rules/server-security.md）：\n${
            RULE_SUMMARY.map(r => `- ${r}`).join('\n')}`,
      },
    }))
  }
  process.exit(0)
}

// 規則 1（巢狀 IDOR）＋規則 3（mass assignment）的可 grep 子集，
// 與 feature-to-api phase-1-mock-api 步驟 6.6 安全自查對應
function detect(abs, rel) {
  let content
  try {
    content = readFileSync(abs, 'utf8')
  }
  catch {
    return []
  }
  const violations = []

  // 規則 3：spread body／Object.assign 流入寫入
  content.split('\n').forEach((line, i) => {
    // 剝行註解／跳過註解行：解釋「不可用 ...body」的註解本身不是違規（實測誤報來源）
    const code = line.replace(/\/\/.*$/, '').trim()
    if (!code || code.startsWith('*') || code.startsWith('/*'))
      return
    // `return { ...body }` 是回應組裝不是 DB 寫入；真寫入（`return db.insert(x).values({ ...body })`）仍會被抓
    if (/^return\s*\{/.test(code) && !/\b(?:insert|update|values|set)\b/.test(code))
      return
    if (/\.\.\.body\b|Object\.assign\(/.test(code))
      violations.push(`規則 3（mass assignment）：${rel}:${i + 1} 出現 \`${code}\` ——寫入須逐欄白名單手構，不得 spread body`)
  })

  // 規則 1：路徑含 ≥2 個動態參數，但父層參數在檔內完全未出現（只抓最壞情況，誤報最低）
  const params = [...rel.matchAll(/\[([^\]/]+)\]/g)].map(m => m[1])
  if (params.length >= 2 && !params.some(p => p.startsWith('...'))) {
    for (const parent of params.slice(0, -1)) {
      if (!new RegExp(`\\b${escapeRegex(parent)}\\b`).test(content))
        violations.push(`規則 1（巢狀 IDOR）：${rel} 的父層參數 \`${parent}\` 在檔內完全未被引用——查詢條件必含全部父層參數`)
    }
  }
  return violations
}

// 誤報豁免 sentinel：比中一次即從清單移除（清空刪檔）
function consumeAllowSentinel(projectDir, rel) {
  const sentinel = resolve(projectDir, '.claude/tmp/server-security-allow.json')
  if (!existsSync(sentinel))
    return false
  try {
    const allow = JSON.parse(readFileSync(sentinel, 'utf8'))
    const files = Array.isArray(allow?.files) ? allow.files : []
    const idx = files.indexOf(rel)
    if (idx === -1)
      return false
    files.splice(idx, 1)
    if (files.length === 0)
      rmSync(sentinel)
    else
      writeFileSync(sentinel, JSON.stringify({ ...allow, files }, null, 2))
    return true
  }
  catch {
    return false // sentinel 壞掉視同不存在
  }
}

// 以 session 為單位記錄已注入過摘要的檔案，回傳是否首次觸碰
function markFirstTouch(projectDir, sessionId, rel) {
  try {
    const marker = resolve(projectDir, `.claude/tmp/server-security-guard/${sessionId || 'unknown'}.json`)
    let seen = []
    if (existsSync(marker)) {
      const parsed = JSON.parse(readFileSync(marker, 'utf8'))
      seen = Array.isArray(parsed) ? parsed : []
    }
    if (seen.includes(rel))
      return false
    mkdirSync(dirname(marker), { recursive: true })
    writeFileSync(marker, JSON.stringify([...seen, rel]))
    return true
  }
  catch {
    return false // 記錄失敗寧可不注入，也不重複灌噪音
  }
}
