import type { H3Event } from 'h3'
import type { RundownItemListItem } from '../../../../../../app/types/api/rundown'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownItems } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RundownItemListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(rundownItems).where(eq(rundownItems.weddingId, weddingId)).orderBy(asc(rundownItems.seq))
  // 排序：time null（未定時段）置頂，其餘依 time 字串升冪
  return rows
    .sort((a, b) => {
      if (a.time === null && b.time === null)
        return 0
      if (a.time === null)
        return -1
      if (b.time === null)
        return 1
      return a.time.localeCompare(b.time)
    })
    .map(i => ({
      rundownItemId: i.rundownItemId,
      weddingId: i.weddingId,
      time: i.time,
      durationMinutes: i.durationMinutes,
      title: i.title,
      location: i.location,
      supplies: i.supplies,
      note: i.note,
      roleTasks: i.roleTasks,
      highlight: i.highlight,
      guestVisible: i.guestVisible,
    }))
})
