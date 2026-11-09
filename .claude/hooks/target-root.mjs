// 目標檔所屬 repo 根目錄的解析（frozen-paths-guard 與 server-security-guard 共用；本檔不是 hook，不在 settings 註冊）
// 背景（issue #199）：兩個 hook 原本一律以 CLAUDE_PROJECT_DIR 當 repo root。從主目錄 session 改另一個 git worktree
// 的檔時，路徑會解成 `../<worktree>/spec/…`，比不中凍結清單與 `server/` 前綴，兩道防線都失效。
// 修法：列出目標的「候選 root」逐一比對，任一個比中就算命中：
// - 目標往上每一層含 `.git` 的目錄，但只收「與 session 專案同一個 git repo」的（git 共用目錄相同）——
//   也就是同 repo 的其他 worktree（兄弟目錄或 isolation 分身的 `.claude/worktrees/<name>`）。
//   無關的 repo（家目錄 dotfiles、別的專案、submodule、自己建的假 `.git`）不算，不誤擋也不能拿來繞道。
//   例外：假 `.git` 檔的 gitdir 若直接指向本 repo 的 git 目錄，會被當成同 repo 的 worktree（只會多擋，不會漏放；issue #206）
// - 目標在專案目錄內時，專案目錄本身永遠是候選（放在最後）：凍結目錄底下多一個 `.git` 也蓋不掉原本的判斷
// 不呼叫 `git rev-parse`：Bash 分支對指令裡每個 token 都要解析一次，每個 token 開一個 git 子行程太慢。
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

export const realpath = realpathSync.native ?? realpathSync

// session 的專案目錄（hook 由 Claude Code 執行時帶 CLAUDE_PROJECT_DIR）；解 symlink，與目標路徑同一套比較基準
export function sessionProjectRoot() {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  try {
    return realpath(dir)
  }
  catch {
    return dir
  }
}

// 解 symlink，但目標不存在（新檔、glob 字串）時也要解：找最近一個存在的祖先 realpath，再接回其餘路徑。
// 只在目標存在時才 realpath 的話，經 symlink 寫的 glob／新檔會跟專案目錄（已 realpath）對不上而判成「在專案外」
// 每一層的 realpath 結果依目錄快取（失敗記 null）：Bash 分支對每個 token × 每個基準都會呼叫，
// 長 heredoc 的上千個 token 共用同幾層祖先，不快取時同一層會反覆 realpath（PR #212 /code-review：2000 行約 1.5 秒）
const realpathCache = new Map()
function realpathOrNull(dir) {
  if (!realpathCache.has(dir)) {
    let real = null
    try {
      real = realpath(dir)
    }
    catch {}
    realpathCache.set(dir, real)
  }
  return realpathCache.get(dir)
}

// 由上往下解：上一層不存在時這一層一定不存在，直接接回檔名、不再 realpath。
// 長 heredoc 的 token 多半是互不相同、上層也不存在的假路徑，這樣每個 token 至多 realpath 一次
const looseCache = new Map()
function loose(abs) {
  if (!looseCache.has(abs)) {
    const parent = dirname(abs)
    let r
    if (parent === abs) {
      const real = realpathOrNull(abs)
      r = { path: real ?? abs, exists: real !== null }
    }
    else {
      const p = loose(parent)
      const real = p.exists ? realpathOrNull(abs) : null
      r = real !== null ? { path: real, exists: true } : { path: join(p.path, basename(abs)), exists: false }
    }
    looseCache.set(abs, r)
  }
  return looseCache.get(abs)
}

export function realpathLoose(abs) {
  return loose(abs).path
}

function isInside(root, abs) {
  const rel = relative(root, abs)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// 目錄底下有沒有 `.git`：Bash 分支每個 token 都會沿祖先往上問，同一層只查一次
const dotGitCache = new Map()
function hasDotGit(dir) {
  if (!dotGitCache.has(dir))
    dotGitCache.set(dir, existsSync(resolve(dir, '.git')))
  return dotGitCache.get(dir)
}

// root 的 git 共用目錄：一般 repo 是 `<root>/.git`；worktree 的 `.git` 檔寫 `gitdir: <主 repo>/.git/worktrees/<name>`，
// 該目錄的 `commondir` 檔指回主 repo 的 `.git`。gitdir 沒有 commondir 時，gitdir 本身就是共用目錄：
// `git init --separate-git-dir` 的主工作區（`.git` 檔指向外部 git 目錄）、submodule（指向 `.git/modules/<name>`）都是這樣。
// submodule 的共用目錄與上層 repo 不同，照樣不算同 repo；gitdir 不存在或格式不對回 null（issue #206）。
// 副作用：linked worktree 的 `.git/worktrees/<name>` 若殘缺到沒有 commondir，會被當成獨立 repo（不再跨 worktree 保護；
// 修改前同樣認不出：當時讀 commondir 丟例外而回 null，現在回 gitdir 本身，兩者都不算同 repo）
const commonDirCache = new Map()
function gitCommonDir(root) {
  if (!commonDirCache.has(root)) {
    let common = null
    try {
      const dotGit = resolve(root, '.git')
      if (statSync(dotGit).isDirectory()) {
        common = realpath(dotGit)
      }
      else {
        const gitdir = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1].trim()
        if (gitdir) {
          const dir = resolve(root, gitdir)
          const commondir = resolve(dir, 'commondir')
          common = realpath(existsSync(commondir) ? resolve(dir, readFileSync(commondir, 'utf8').trim()) : dir)
        }
      }
    }
    catch {}
    commonDirCache.set(root, common)
  }
  return commonDirCache.get(root)
}

// session 專案所在 repo 的共用目錄（專案目錄或其上層最近的 `.git`）；不在 git repo 內回 null。
// Bash 分支每個 token 都會問一次，結果依 projectRoot 快取
const projectCommonCache = new Map()
function projectCommonDir(projectRoot) {
  if (!projectCommonCache.has(projectRoot)) {
    let common = null
    for (let dir = projectRoot; ; dir = dirname(dir)) {
      if (hasDotGit(dir)) {
        common = gitCommonDir(dir)
        break
      }
      if (dirname(dir) === dir)
        break
    }
    projectCommonCache.set(projectRoot, common)
  }
  return projectCommonCache.get(projectRoot)
}

// abs 須為絕對路徑。回傳候選 root（內層在前）；呼叫端對每個 root 取相對路徑比對，取第一個比中的。
// 目標在專案目錄內時只往上找到專案目錄為止；在專案目錄外時找到檔案系統根。
// 專案若放在 monorepo 子目錄，同 repo 另一個 worktree 的目標會多一段子目錄前綴而比不中（已知極限）。
export function candidateRoots(abs, projectRoot) {
  const inside = isInside(projectRoot, abs)
  const common = projectCommonDir(projectRoot)
  const roots = []
  if (common) {
    for (let dir = abs; !(inside && dir === projectRoot); dir = dirname(dir)) {
      // 不存在的目錄不可能有 `.git`：先用 loose 的快取判斷，省掉每個假路徑各層的 existsSync
      if (loose(dir).exists && hasDotGit(dir) && gitCommonDir(dir) === common)
        roots.push(dir)
      if (dirname(dir) === dir)
        break
    }
  }
  if (inside)
    roots.push(projectRoot)
  return roots
}
