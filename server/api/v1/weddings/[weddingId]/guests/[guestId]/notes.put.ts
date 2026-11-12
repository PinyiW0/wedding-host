import type { H3Event } from 'h3'
import type { GuestNotesUpdatedEvent, UpdateGuestNotesBody } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

const NOTES_MAX = 500

// 只改備註一欄（issue #217）：接待帳號在報到頁補寫備註用。
// 不走 guests PATCH——那支能改姓名、人數等全部欄位，不能對接待帳號開放
export default defineEventHandler(async (event: H3Event): Promise<GuestNotesUpdatedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<UpdateGuestNotesBody | undefined>(event)

  // 沒帶欄位（含 body 不是物件、欄位拼錯）不能當清空，否則會靜默抹掉既有備註
  const raw: unknown = body && typeof body === 'object' ? body.notes : undefined
  if (raw === undefined) {
    throw createError({ statusCode: 400, statusMessage: '請提供備註' })
  }
  if (raw !== null && typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '備註格式不正確' })
  }
  const trimmed = raw?.trim() ?? ''
  if (trimmed.length > NOTES_MAX) {
    throw createError({ statusCode: 400, statusMessage: `備註最多 ${NOTES_MAX} 字` })
  }
  // 清空存 null，與新增賓客未填備註時一致
  const notes = trimmed || null

  const db = useDb()
  const [updated] = await db
    .update(guests)
    .set({ notes })
    .where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
    .returning({ guestId: guests.guestId })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  return { guestId: updated.guestId, notes }
})
