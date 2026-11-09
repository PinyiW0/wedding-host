// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// server-security-guard.mjs：server 安全 PostToolUse hook。
// 驅動方式與 frozen-paths-guard.spec.ts 相同：stdin 餵 { tool_name, tool_input: { file_path } }，
// CLAUDE_PROJECT_DIR 指向 session 目錄；機械偵測命中時 exit 2、其餘 exit 0。
const HOOK_PATH = fileURLToPath(new URL('../../.claude/hooks/server-security-guard.mjs', import.meta.url))
const HANDLER = 'server/api/items/index.post.ts'
// 規則 3（mass assignment）的必中寫法：spread body 流入 DB 寫入。
// 本專案 hook 放行 `return { ...body }`（回應組裝）與註解行，所以不能沿用模板以 `return { ...body }` 當範例
const VIOLATING = 'export default defineEventHandler(async (event) => {\n  const body = await readBody(event)\n  return db.insert(items).values({ ...body })\n})\n'

let base: string
let repoM: string
let wtB: string
let repoU: string

const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' })

function writeHandler(root: string) {
  mkdirSync(join(root, 'server/api/items'), { recursive: true })
  writeFileSync(join(root, HANDLER), VIOLATING)
}

function runGuard(filePath: string) {
  return spawnSync('node', [HOOK_PATH], {
    input: JSON.stringify({ tool_name: 'Edit', session_id: 'test', tool_input: { file_path: filePath } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoM },
    encoding: 'utf8',
    timeout: 5000,
  })
}

beforeEach(() => {
  // Arrange：session 目錄 M 是真的 git repo，B 是 M 的 worktree，U 是無關的 git repo，三處各放一支違規 handler
  base = realpathSync(mkdtempSync(join(tmpdir(), 'server-guard-')))
  repoM = join(base, 'm')
  wtB = join(base, 'b')
  repoU = join(base, 'u')
  mkdirSync(repoM)
  git('init', '-q', repoM)
  writeFileSync(join(repoM, 'README.md'), 'x\n')
  git('-C', repoM, 'add', '.')
  git('-C', repoM, 'commit', '-qm', 'init')
  git('-C', repoM, 'worktree', 'add', '-q', wtB, '-b', 'wt-b')
  mkdirSync(repoU)
  git('init', '-q', repoU)
  for (const root of [repoM, wtB, repoU])
    writeHandler(root)
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('server-security-guard：跨 worktree 以目標所屬 repo 判斷（issue #199）', () => {
  it('session 目錄內的違規 handler → exit 2（基準）', () => {
    // Act
    const result = runGuard(HANDLER)

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${HANDLER}:3`)
  })

  it('同 repo 另一個 worktree 的違規 handler（絕對路徑）→ 與 session 目錄一致，exit 2，訊息指出該 worktree 的豁免檔位置', () => {
    // Act
    const result = runGuard(join(wtB, HANDLER))

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${HANDLER}:3`)
    expect(result.stderr).toContain(join(wtB, '.claude/tmp/server-security-allow.json'))
  })

  it('另一個 worktree 的豁免 sentinel 寫在該 worktree 自己的 .claude/tmp → 放行一次', () => {
    // Arrange
    mkdirSync(join(wtB, '.claude/tmp'), { recursive: true })
    writeFileSync(join(wtB, '.claude/tmp/server-security-allow.json'), JSON.stringify({ reason: '測試誤報', files: [HANDLER] }))

    // Act
    const first = runGuard(join(wtB, HANDLER))
    const second = runGuard(join(wtB, HANDLER))

    // Assert
    expect(first.status).toBe(0)
    expect(second.status).toBe(2)
  })

  it('無關的 git repo → 不偵測（不誤擋別的專案）', () => {
    // Act
    const result = runGuard(join(repoU, HANDLER))

    // Assert
    expect(result.status).toBe(0)
  })

  it('server/ 底下多一個假 .git → 仍偵測，不能拿來繞道', () => {
    // Arrange
    writeFileSync(join(repoM, 'server/.git'), 'gitdir: ../.git/modules/x\n')

    // Act
    const result = runGuard(HANDLER)

    // Assert
    expect(result.status).toBe(2)
  })

  it('handler 是指向 repo 外的 symlink → 仍以編輯路徑判斷，exit 2', () => {
    // Arrange
    const outside = join(base, 'shared.ts')
    writeFileSync(outside, VIOLATING)
    mkdirSync(join(repoM, 'server/api/links'), { recursive: true })
    symlinkSync(outside, join(repoM, 'server/api/links/index.post.ts'))

    // Act
    const result = runGuard('server/api/links/index.post.ts')

    // Assert
    expect(result.status).toBe(2)
  })

  it('server/api 底下的子目錄是指向 repo 外的 symlink → 仍以編輯路徑判斷，exit 2（PR #205 review）', () => {
    // Arrange
    const outsideDir = join(base, 'outside')
    mkdirSync(outsideDir)
    writeFileSync(join(outsideDir, 'x.post.ts'), VIOLATING)
    symlinkSync(outsideDir, join(repoM, 'server/api/linked'))

    // Act
    const result = runGuard(join(repoM, 'server/api/linked/x.post.ts'))

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('server/api/linked/x.post.ts:3')
  })

  it('server/api 外的子目錄是指向 server/api 的 symlink → 以實體路徑偵測，exit 2', () => {
    // Arrange：server/utils/link → server/api/items，編輯路徑不在 server/api/，實體路徑在
    mkdirSync(join(repoM, 'server/utils'), { recursive: true })
    symlinkSync(join(repoM, 'server/api/items'), join(repoM, 'server/utils/link'))

    // Act
    const result = runGuard('server/utils/link/index.post.ts')

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${HANDLER}:3`)
  })

  it('經 repo 外的別名目錄（symlink 指向 worktree B 的 server/）進入 → 編輯路徑比不中，以實體路徑認出 B，exit 2', () => {
    // Arrange
    const alias = join(base, 'srv-b')
    symlinkSync(join(wtB, 'server'), alias)

    // Act
    const result = runGuard(join(alias, 'api/items/index.post.ts'))

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(join(wtB, '.claude/tmp/server-security-allow.json'))
  })
  it('repo 外的檔名 symlink 指向 server/api 的 handler → 連檔名一起解出實體路徑，exit 2（PR #205 review）', () => {
    // Arrange
    const link = join(base, 'h.ts')
    symlinkSync(join(repoM, HANDLER), link)

    // Act
    const result = runGuard(link)

    // Assert
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${HANDLER}:3`)
  })
})

describe('server-security-guard：--separate-git-dir 結構（issue #206）', () => {
  it('主工作區 C 的 .git 是檔案、沒有 commondir：session 在 C，worktree D 的違規 handler → 與 C 一致，exit 2', () => {
    // Arrange：C 用 --separate-git-dir 建立，D 是 C 的 worktree，兩處各放一支違規 handler
    const repoC = join(base, 'c')
    const wtD = join(base, 'd')
    git('init', '-q', '--separate-git-dir', join(base, 'c.git'), repoC)
    writeFileSync(join(repoC, 'README.md'), 'x\n')
    git('-C', repoC, 'add', '.')
    git('-C', repoC, 'commit', '-qm', 'init')
    git('-C', repoC, 'worktree', 'add', '-q', wtD, '-b', 'wt-d')
    writeHandler(repoC)
    writeHandler(wtD)
    const run = (filePath: string) => spawnSync('node', [HOOK_PATH], {
      input: JSON.stringify({ tool_name: 'Edit', session_id: 'test', tool_input: { file_path: filePath } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: repoC },
      encoding: 'utf8',
      timeout: 5000,
    })

    // Act
    const inC = run(join(repoC, HANDLER))
    const inD = run(join(wtD, HANDLER))

    // Assert
    expect(inC.status).toBe(2)
    expect(inD.status).toBe(2)
  })
})

describe('server-security-guard：候選 root 全部保留（PR #207 review）', () => {
  it('server/api/items/.git 偽造 gitdir 指回本 repo：編輯 server/api/items/server/utils/x.post.ts 仍以外層 server/api/ 偵測，exit 2', () => {
    // Arrange：內層 root 會把檔案看成 server/utils/x.post.ts（不偵測），外層 root 才是 server/api/
    const inner = join(repoM, 'server/api/items')
    mkdirSync(join(inner, 'server/utils'), { recursive: true })
    writeFileSync(join(inner, '.git'), `gitdir: ${join(repoM, '.git')}\n`)
    writeFileSync(join(inner, 'server/utils/x.post.ts'), VIOLATING)

    // Act
    const result = runGuard(join(inner, 'server/utils/x.post.ts'))

    // Assert
    expect(result.status).toBe(2)
  })

  it.each([
    ['只引用 itemId，漏掉外層 tenantId', 2, 'getRouterParam(event, \'itemId\')'],
    ['tenantId 與 itemId 都引用', 0, '[getRouterParam(event, \'tenantId\'), getRouterParam(event, \'itemId\')]'],
  ])('server/api/[tenantId]/[itemId]/.git 偽造 gitdir：編輯其下 server/api/index.get.ts，%s → exit %i', (_label, expected, body) => {
    // Arrange：內層 root 的相對路徑 server/api/index.get.ts 沒有動態參數，外層 root 才看得到 [tenantId]/[itemId]
    const inner = join(repoM, 'server/api/[tenantId]/[itemId]')
    mkdirSync(join(inner, 'server/api'), { recursive: true })
    writeFileSync(join(inner, '.git'), `gitdir: ${join(repoM, '.git')}\n`)
    writeFileSync(join(inner, 'server/api/index.get.ts'), `export default defineEventHandler(event => ${body})\n`)

    // Act
    const result = runGuard(join(inner, 'server/api/index.get.ts'))

    // Assert
    expect(result.status).toBe(expected)
  })
})

describe('server-security-guard：本專案的兩條誤報豁免（issue #208）', () => {
  it('註解裡提到 ...body 不算違規 → exit 0', () => {
    // Arrange：仿 venue-layout.put.ts 的說明註解
    writeFileSync(join(repoM, HANDLER), 'export default defineEventHandler(async () => {\n  // 不可用 ...body 展開，否則 body.weddingId 會覆蓋 URL 值\n  return { ok: true }\n})\n')

    // Act
    const result = runGuard(HANDLER)

    // Assert
    expect(result.status).toBe(0)
  })

  it('return { ...body } 組裝回應、沒有寫入 DB → exit 0', () => {
    // Arrange：仿 seats/move.post.ts 的回應組裝
    writeFileSync(join(repoM, HANDLER), 'export default defineEventHandler(async (event) => {\n  const body = await readBody(event)\n  return { ...body, swapped: false }\n})\n')

    // Act
    const result = runGuard(HANDLER)

    // Assert
    expect(result.status).toBe(0)
  })
})

describe('server-security-guard：豁免要全部命中才消耗（PR #212 /code-review）', () => {
  it('同一次編輯有兩個 server/api 命中、只豁免其中一個 → 擋下，且豁免不被用掉', () => {
    // Arrange：server/api/alias 是指向 server/api/items 的 symlink，編輯路徑與實體路徑各算一個命中
    symlinkSync(join(repoM, 'server/api/items'), join(repoM, 'server/api/alias'))
    mkdirSync(join(repoM, '.claude/tmp'), { recursive: true })
    const sentinel = join(repoM, '.claude/tmp/server-security-allow.json')
    writeFileSync(sentinel, JSON.stringify({ reason: '測試誤報', files: [HANDLER] }))

    // Act
    const result = runGuard('server/api/alias/index.post.ts')

    // Assert
    expect(result.status).toBe(2)
    expect(JSON.parse(readFileSync(sentinel, 'utf8')).files).toEqual([HANDLER])
  })

  it('兩個命中都豁免 → 放行，兩筆一起消耗', () => {
    // Arrange
    symlinkSync(join(repoM, 'server/api/items'), join(repoM, 'server/api/alias'))
    mkdirSync(join(repoM, '.claude/tmp'), { recursive: true })
    const sentinel = join(repoM, '.claude/tmp/server-security-allow.json')
    writeFileSync(sentinel, JSON.stringify({ reason: '測試誤報', files: [HANDLER, 'server/api/alias/index.post.ts'] }))

    // Act
    const result = runGuard('server/api/alias/index.post.ts')

    // Assert
    expect(result.status).toBe(0)
    expect(existsSync(sentinel)).toBe(false)
  })
})
