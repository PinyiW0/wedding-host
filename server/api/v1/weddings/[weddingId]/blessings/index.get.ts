import type { H3Event } from 'h3'
import type { BlessingListItem } from '../../../../../../app/types/api/blessings'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { blessings } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<BlessingListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(blessings).where(eq(blessings.weddingId, weddingId)).orderBy(asc(blessings.seq))

  // 匿名（僅婚禮簽名，投影牆）只看得到已通過的祝福且不含退件原因（issue #70 / H4）；
  // 登入的管理端／接待員維持全量（審核所需）。middleware 已把登入者掛在 context.authUser。
  const isAuthenticated = !!event.context.authUser
  const visible = isAuthenticated ? rows : rows.filter(b => b.status === 'approved')

  return visible.map(b => ({
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
