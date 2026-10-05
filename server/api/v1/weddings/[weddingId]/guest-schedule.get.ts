import type { H3Event } from 'h3'
import type { GuestScheduleItem } from '../../../../../app/types/api/rundown'

import { and, asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { rundownItems } from '../../../../db/schema'

// 賓客版流程（issue #190）：只回勾選賓客可見的時段，白名單挑公開欄位；
// 工作人員用的物品／備註／角色事項只留在 rundown-items（限登入與流程表簽章）
export default defineEventHandler(async (event: H3Event): Promise<GuestScheduleItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db
    .select()
    .from(rundownItems)
    .where(and(eq(rundownItems.weddingId, weddingId), eq(rundownItems.guestVisible, true)))
    .orderBy(asc(rundownItems.seq))
  return sortRundownRows(rows).map(i => ({
    rundownItemId: i.rundownItemId,
    time: i.time,
    durationMinutes: i.durationMinutes,
    title: i.title,
    location: i.location,
    highlight: i.highlight,
  }))
})
