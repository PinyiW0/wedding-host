import type { H3Event } from 'h3'

import { and, eq, sql } from 'drizzle-orm'

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

  // 級聯清理：以單一 SQL 從所有含該角色的項目 roleTasks 過濾掉該角色條目（原子、單次往返，
  // 取代原本 select→迴圈逐筆 update 的 N 次非原子往返）；全數移除時回空陣列（issue #71）
  await db.update(rundownItems)
    .set({
      roleTasks: sql`coalesce((select jsonb_agg(elem) from jsonb_array_elements(${rundownItems.roleTasks}) elem where elem->>'roleId' <> ${roleId}), '[]'::jsonb)`,
    })
    .where(and(
      eq(rundownItems.weddingId, weddingId),
      sql`${rundownItems.roleTasks} @> ${JSON.stringify([{ roleId }])}::jsonb`,
    ))

  setResponseStatus(event, 204)
})
