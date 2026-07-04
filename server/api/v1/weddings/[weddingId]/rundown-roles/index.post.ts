import type { H3Event } from 'h3'
import type { CreateRundownRoleBody, RundownRoleCreatedEvent } from '../../../../../../app/types/api/rundown'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { rundownRoles } from '../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RundownRoleCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateRundownRoleBody>(event)

  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入角色名稱' })
  }
  const db = useDb()
  const [dup] = await db.select().from(rundownRoles).where(and(eq(rundownRoles.weddingId, weddingId), eq(rundownRoles.name, name)))
  if (dup) {
    throw createError({ statusCode: 400, statusMessage: '角色名稱已存在' })
  }

  const roleId = `role-${crypto.randomUUID().slice(0, 8)}`
  await db.insert(rundownRoles).values({ roleId, weddingId, name })

  setResponseStatus(event, 201)
  return { roleId, weddingId, name }
})
