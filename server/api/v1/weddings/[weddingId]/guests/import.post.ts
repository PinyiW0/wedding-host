import type { H3Event } from 'h3'
import type { CreateGuestBody, GuestsImportedEvent, ImportGuestsBody } from '../../../../../../app/types/api/guests'

import { useDb } from '../../../../../db'
import { guests } from '../../../../../db/schema'

// 僅允許 .xlsx / .xls 副檔名
const excelExtension = /\.xlsx?$/i
const MAX_ROWS = 1000

function assertText(value: unknown, label: string, max: number, required = false): string {
  value ??= ''
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw createError({ statusCode: 400, statusMessage: `${label}格式不正確` })
  return value.trim()
}

// 瀏覽器已把 Excel 解析成逐列賓客（issue #205）；這裡逐欄白名單重驗，全部合法才一次寫入
export default defineEventHandler(async (event: H3Event): Promise<GuestsImportedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<ImportGuestsBody>(event)
  const fileName = body?.fileName ?? ''

  if (!excelExtension.test(fileName)) {
    throw createError({ statusCode: 400, statusMessage: '檔案格式不正確，僅支援 .xlsx 或 .xls 格式' })
  }
  const rows: unknown = body?.guests
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
    throw createError({ statusCode: 400, statusMessage: `匯入名單需有 1～${MAX_ROWS} 位賓客` })
  }

  const parsed = rows.map((raw: Partial<CreateGuestBody> | null) => {
    const row = raw ?? {}
    const partySize = row.partySize ?? 1
    const childChairCount = row.childChairCount ?? 0
    assertPositiveInt(partySize, '總人數', 999)
    assertPositiveInt(childChairCount, '兒童椅數', 99)
    if (partySize < 1)
      throw createError({ statusCode: 400, statusMessage: '總人數格式不正確' })
    assertEnum(row.side, ['groom', 'bride'], '男女方')
    assertEnum(row.diet ?? 'meat', ['meat', 'vegetarian'], '飲食偏好')
    const notes = assertText(row.notes, '備註', 500)
    return {
      name: assertText(row.name, '賓客姓名', 100, true),
      side: row.side!,
      diet: row.diet ?? 'meat',
      category: assertText(row.category, '分類', 50),
      contact: assertText(row.contact, '聯絡方式', 100),
      partySize,
      childChairCount,
      notes: notes || null,
    }
  })

  const db = useDb()
  // 分類名稱 find-or-create 成 categoryId（同 index.post.ts）；同名只解析一次
  const categoryByName = new Map<string, Awaited<ReturnType<typeof resolveCategory>>>()
  for (const name of new Set(parsed.map(g => g.category).filter(Boolean)))
    categoryByName.set(name, await resolveCategory(db, weddingId, name))

  const groomRelativeIds: string[] = []
  const values = parsed.map((g) => {
    const category = g.category ? categoryByName.get(g.category) ?? null : null
    const guestId = `guest-${crypto.randomUUID().slice(0, 8)}`
    if (isGroomRelative(g.side, category?.tier))
      groomRelativeIds.push(guestId)
    return {
      guestId,
      weddingId,
      name: g.name,
      side: g.side,
      diet: g.diet,
      categoryId: category?.categoryId ?? null,
      contact: g.contact,
      childChairCount: g.childChairCount,
      notes: g.notes,
      lineUserId: null,
      rsvpAttending: null,
      checkedInAt: null,
      giftAmount: null,
      cakeBoxDistributedTypeId: null,
      invitedPartySize: g.partySize,
      partySize: g.partySize,
      tableName: null,
      deletedAt: null,
      invitationSent: false,
      source: 'import' as const,
    }
  })

  // neon-http 沒有 transaction：單一 INSERT 語句寫入全部列，要嘛全進、要嘛全不進
  await db.insert(guests).values(values)

  // 男方親屬預設不發放喜餅（issue #105）
  await syncGroomRelativeNoBoxBulk(db, weddingId, groomRelativeIds, [])

  setResponseStatus(event, 201)
  return { importedCount: values.length }
})
