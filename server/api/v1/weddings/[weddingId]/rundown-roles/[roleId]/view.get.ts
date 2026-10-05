import type { H3Event } from 'h3'
import type { RundownRoleView } from '../../../../../../../app/types/api/rundown'

import { and, asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { rundownItems, rundownRoles, weddings } from '../../../../../../db/schema'

// 流程表角色版（issue #188）：角色連結（r 簽名）唯一讀得到的端點，只回該角色參與的時段與自己的事項
export default defineEventHandler(async (event: H3Event): Promise<RundownRoleView> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const roleId = getRouterParam(event, 'roleId')!

  const db = useDb()
  const [role] = await db.select().from(rundownRoles).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId)))
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: '流程角色不存在' })
  }

  const [wedding] = await db
    .select({ groomName: weddings.groomName, brideName: weddings.brideName })
    .from(weddings)
    .where(eq(weddings.weddingId, weddingId))
  const rows = await db.select().from(rundownItems).where(eq(rundownItems.weddingId, weddingId)).orderBy(asc(rundownItems.seq))

  const items = sortRundownRows(rows).flatMap((i) => {
    const own = i.roleTasks.find(rt => rt.roleId === roleId)
    if (!own)
      return []
    return [{
      rundownItemId: i.rundownItemId,
      time: i.time,
      durationMinutes: i.durationMinutes,
      title: i.title,
      location: i.location,
      roleSupplies: own.supplies ?? '',
      sharedSupplies: i.supplies,
      note: i.note,
      task: own.task,
      highlight: i.highlight,
    }]
  })

  return {
    roleId: role.roleId,
    roleName: role.name,
    groomName: wedding?.groomName ?? null,
    brideName: wedding?.brideName ?? null,
    items,
  }
})
