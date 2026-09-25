import { and, eq, isNull } from 'drizzle-orm'
import { useDb } from '../../../../../db'
import { cakeBoxNotes, guests } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const guestId = getRouterParam(event, 'guestId')!
  const body = await readBody<{ note?: unknown }>(event)
  if (typeof body?.note !== 'string' || body.note.length > 2000)
    throw createError({ statusCode: 400, statusMessage: '備註須為 2000 字內的文字' })
  const db = useDb()
  const [guest] = await db.select({ guestId: guests.guestId }).from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest)
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  const note = body.note.trim()
  await db.insert(cakeBoxNotes).values({ weddingId, guestId, note }).onConflictDoUpdate({ target: [cakeBoxNotes.weddingId, cakeBoxNotes.guestId], set: { note } })
  return { guestId, note }
})
