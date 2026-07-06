import type { H3Event } from 'h3'
import type { BlessingListItem } from '../../../../../../app/types/api/blessings'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { blessings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(blessings).where(eq(blessings.weddingId, weddingId)).orderBy(asc(blessings.seq))
  return rows.map(b => ({
    blessingId: b.blessingId,
    weddingId: b.weddingId,
    guestId: b.guestId,
    guestName: b.guestName,
    message: b.message,
    photoUrl: b.photoUrl,
    status: b.status,
    rejectReason: b.rejectReason,
    // DB 未上牆為 null，維持原本省略 key 的回應形狀
    ...(b.wallStatus ? { wallStatus: b.wallStatus } : {}),
  }))
})
