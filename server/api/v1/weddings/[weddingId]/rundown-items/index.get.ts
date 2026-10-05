import type { H3Event } from 'h3'
import type { RundownItemListItem } from '../../../../../../app/types/api/rundown'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownItems } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RundownItemListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(rundownItems).where(eq(rundownItems.weddingId, weddingId)).orderBy(asc(rundownItems.seq))
  return sortRundownRows(rows)
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
