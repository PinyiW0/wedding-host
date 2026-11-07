import type { H3Event } from 'h3'
import type { CreateRundownRoleBody, RundownRoleCreatedEvent } from '../../../../../../app/types/api/rundown'

import { and, eq, sql } from 'drizzle-orm'

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
  // 新角色排在最右邊（issue #207）。位置在 INSERT 語句裡直接算：先讀 MAX 再寫入的話，
  // 中間剛好有人排序，新角色會拿到舊的最大值而被夾在中間（neon-http 沒有 transaction，只能靠單一語句）
  await db.insert(rundownRoles).values({
    roleId,
    weddingId,
    name,
    position: sql`(select coalesce(max(${rundownRoles.position}), -1) + 1 from ${rundownRoles} where ${rundownRoles.weddingId} = ${weddingId})`,
  })

  setResponseStatus(event, 201)
  return { roleId, weddingId, name }
})
