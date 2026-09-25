import { eq } from 'drizzle-orm'
import { useDb } from '../../../../../db'
import { cakeBoxNotes } from '../../../../../db/schema'

export default defineEventHandler(async (event) => {
  const weddingId = getRouterParam(event, 'weddingId')!
  return useDb().select({ guestId: cakeBoxNotes.guestId, note: cakeBoxNotes.note }).from(cakeBoxNotes).where(eq(cakeBoxNotes.weddingId, weddingId))
})
