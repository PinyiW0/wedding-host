import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { rundownItems, rundownRoles } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const roleId = getRouterParam(event, 'roleId')!

  const db = useDb()
  const [role] = await db.select().from(rundownRoles).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId)))
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: '流程角色不存在' })
  }

  await db.delete(rundownRoles)
    .where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId)))

  // 級聯清理：從各項目的 roleTasks 移除該角色的條目
  const items = await db.select().from(rundownItems).where(eq(rundownItems.weddingId, weddingId))
  for (const item of items) {
    if (item.roleTasks.some(rt => rt.roleId === roleId)) {
      await db.update(rundownItems)
        .set({ roleTasks: item.roleTasks.filter(rt => rt.roleId !== roleId) })
        .where(eq(rundownItems.rundownItemId, item.rundownItemId))
    }
  }

  setResponseStatus(event, 204)
})
