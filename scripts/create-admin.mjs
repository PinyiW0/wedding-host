// 正式環境管理員開通腳本（production 不 seed 示範資料，首位管理員由此建立）
// 用法：
//   NUXT_DATABASE_URL='postgresql://...' node scripts/create-admin.mjs <username> <email> <顯示名稱>
// 密碼由互動式輸入（不留在 shell 歷史）；雜湊格式與 server/utils/password.ts 一致
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import process from 'node:process'
import readline from 'node:readline'
import pg from 'pg'

const [username, email, displayName] = process.argv.slice(2)
const databaseUrl = process.env.NUXT_DATABASE_URL

if (!username || !email || !displayName || !databaseUrl) {
  console.error('用法：NUXT_DATABASE_URL=... node scripts/create-admin.mjs <username> <email> <顯示名稱>')
  process.exit(1)
}

function askPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
    // 關閉回顯：逐字元覆寫提示行
    rl.input.on('keypress', () => {
      readline.moveCursor(process.stderr, -rl.line.length, 0)
      readline.clearLine(process.stderr, 1)
    })
    rl.question(prompt, (answer) => {
      rl.close()
      console.error('')
      resolve(answer)
    })
  })
}

const password = await askPassword('請輸入密碼（至少 8 碼）：')
if (!password || password.length < 8) {
  console.error('密碼至少 8 碼')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64)
const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()
try {
  const dup = await client.query(
    'select user_id from users where (username = $1 or email = $2) and deleted_at is null',
    [username, email],
  )
  if (dup.rowCount > 0) {
    console.error(`帳號或 email 已存在（${dup.rows[0].user_id}），未建立`)
    process.exit(1)
  }
  const userId = `user-${randomUUID().slice(0, 8)}`
  await client.query(
    `insert into users (user_id, username, email, password_hash, display_name, role, wedding_id, deleted_at)
     values ($1, $2, $3, $4, $5, '管理者', null, null)`,
    [userId, username, email, passwordHash, displayName],
  )
  console.log(`已建立管理員 ${userId}（${username} / ${email}）`)
}
finally {
  await client.end()
}
