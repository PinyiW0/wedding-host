import type { H3Event } from 'h3'
import type { RundownRoleUpdatedEvent, UpdateRundownRoleBody } from '../../../../../../../app/types/api/rundown'

import { and, eq, ne } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { rundownRoles } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RundownRoleUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const roleId = getRouterParam(event, 'roleId')!
  const body = await readBody<UpdateRundownRoleBody>(event)

  const db = useDb()
  const [role] = await db.select().from(rundownRoles).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId)))
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: '流程角色不存在' })
  }

  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入角色名稱' })
  }
  const [dup] = await db.select().from(rundownRoles).where(and(eq(rundownRoles.weddingId, weddingId), ne(rundownRoles.roleId, roleId), eq(rundownRoles.name, name)))
  if (dup) {
    throw createError({ statusCode: 400, statusMessage: '角色名稱已存在' })
  }

  await db.update(rundownRoles).set({ name }).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.roleId, roleId)))
  return { roleId, name }
})
