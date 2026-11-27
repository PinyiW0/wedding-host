// 一次性搬移：把賓客表裡 base64 的手繪花圖搬到 R2，欄位改存網址（issue #226）
// 用法（預設只列出將改動的筆數，不寫入任何東西）：
//   NUXT_DATABASE_URL='postgresql://...' NUXT_R2_ENDPOINT=... NUXT_R2_ACCESS_KEY_ID=... \
//   NUXT_R2_SECRET_ACCESS_KEY=... NUXT_R2_BUCKET=... NUXT_PUBLIC_R2_PUBLIC_URL=... \
//   node scripts/migrate-flowers-to-r2.mjs            # 試跑
//   node scripts/migrate-flowers-to-r2.mjs --apply    # 真的搬
// 可重複執行：只挑 flower_drawing 以 data: 開頭的列，搬過的列是 https 網址、不會再被挑到。
// 每一列先寫 R2、再改資料庫；UPDATE 帶「仍是 data:」條件，中途中斷重跑不會重複改寫。
// 中斷時最多留下一個沒人引用的 R2 檔案，不影響資料。
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'

const apply = process.argv.includes('--apply')
const env = process.env
const required = ['NUXT_DATABASE_URL', 'NUXT_R2_ENDPOINT', 'NUXT_R2_ACCESS_KEY_ID', 'NUXT_R2_SECRET_ACCESS_KEY', 'NUXT_R2_BUCKET', 'NUXT_PUBLIC_R2_PUBLIC_URL']
// 試跑只讀資料庫，不需要 R2 的設定
const missing = required.filter(name => !env[name] && (apply || name === 'NUXT_DATABASE_URL'))
if (missing.length) {
  console.error(`缺少環境變數：${missing.join(', ')}`)
  process.exit(1)
}

// base64 與 percent-encoded 文字（示範資料的 SVG）兩種編碼都收
const DATA_URL_RE = /^data:image\/(png|jpeg|webp|gif|svg\+xml)((?:;[^;,]+)*),(.*)$/s
const EXT = { 'png': 'png', 'jpeg': 'jpg', 'webp': 'webp', 'gif': 'gif', 'svg+xml': 'svg' }

const host = new URL(env.NUXT_DATABASE_URL).hostname
console.log(`資料庫主機：${host}`)
console.log(apply ? '模式：寫入（--apply）' : '模式：試跑（不寫入；加 --apply 才會搬）')

const s3 = apply
  ? new S3Client({
      region: 'auto',
      endpoint: env.NUXT_R2_ENDPOINT,
      credentials: { accessKeyId: env.NUXT_R2_ACCESS_KEY_ID, secretAccessKey: env.NUXT_R2_SECRET_ACCESS_KEY },
      // 與 server/utils/r2.ts 相同：R2 不需要 SDK 預設加的 checksum
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })
  : null
const publicBase = (env.NUXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')

const client = new pg.Client({ connectionString: env.NUXT_DATABASE_URL })
await client.connect()
let moved = 0
let skipped = 0
let failed = 0
try {
  // 只取主鍵與長度，花圖本體一列一列讀：一次全讀會把所有 base64 一口氣拉出資料庫
  const { rows } = await client.query(
    `select guest_id, wedding_id, length(flower_drawing) as chars from guests where flower_drawing like 'data:%' order by guest_id`,
  )
  const totalChars = rows.reduce((sum, r) => sum + Number(r.chars), 0)
  console.log(`待搬移：${rows.length} 筆，合計約 ${Math.round(totalChars / 1024)} KB`)

  if (apply) {
    for (const row of rows) {
      try {
        const { rows: [full] } = await client.query(`select flower_drawing from guests where guest_id = $1 and flower_drawing like 'data:%'`, [row.guest_id])
        if (!full)
          continue
        const match = full.flower_drawing.match(DATA_URL_RE)
        if (!match) {
          // 不是圖片 dataURL（格式不明）：不動它，列出來讓人判斷
          console.warn(`略過 ${row.guest_id}：不是圖片 dataURL`)
          skipped++
          continue
        }
        const key = `weddings/${row.wedding_id}/flower/${randomUUID()}.${EXT[match[1]]}`
        const url = `${publicBase}/${key}`
        await s3.send(new PutObjectCommand({
          Bucket: env.NUXT_R2_BUCKET,
          Key: key,
          Body: match[2].includes(';base64') ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8'),
          ContentType: `image/${match[1]}`,
        }))
        // 改資料庫前先確認公開網址真的讀得到：NUXT_PUBLIC_R2_PUBLIC_URL 帶錯時，原圖還留在資料庫
        const check = await fetch(url)
        if (!check.ok)
          throw new Error(`公開網址讀不到（${check.status}）：${url}。請檢查 NUXT_PUBLIC_R2_PUBLIC_URL`)
        // 條件帶原內容的 md5：讀出到改寫之間賓客剛好重送新花時，不拿舊花的網址蓋掉新花
        const res = await client.query(
          `update guests set flower_drawing = $1 where guest_id = $2 and md5(flower_drawing) = md5($3)`,
          [url, row.guest_id, full.flower_drawing],
        )
        moved += res.rowCount ?? 0
      }
      catch (error) {
        failed++
        console.error(`失敗 ${row.guest_id}：${error.message}`)
        // 第一筆就失敗多半是設定錯（金鑰、公開網址）：不再往下試
        if (moved === 0)
          break
      }
    }
    console.log(`已搬移：${moved} 筆；略過：${skipped} 筆；失敗：${failed} 筆`)
  }

  const { rows: [left] } = await client.query(`select count(*)::int as n from guests where flower_drawing like 'data:%'`)
  const { rows: [urls] } = await client.query(`select count(*)::int as n from guests where flower_drawing like 'http%'`)
  console.log(`目前狀態：仍是 base64 的 ${left.n} 筆；已是網址的 ${urls.n} 筆`)
}
finally {
  await client.end()
}
if (failed)
  process.exit(1)
