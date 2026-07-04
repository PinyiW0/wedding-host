import type { H3Event } from 'h3'
import type { RundownRoleListItem } from '../../../../../../app/types/api/rundown'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownRoles } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RundownRoleListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select().from(rundownRoles).where(eq(rundownRoles.weddingId, weddingId)).orderBy(asc(rundownRoles.seq))
  return rows.map(r => ({
    roleId: r.roleId,
    weddingId: r.weddingId,
    name: r.name,
  }))
})
