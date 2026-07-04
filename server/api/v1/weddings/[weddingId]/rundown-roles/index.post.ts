import type { H3Event } from 'h3'
import type { CreateRundownRoleBody, RundownRoleCreatedEvent } from '../../../../../../app/types/api/rundown'

import { mockRundownRoles } from '../../../../../mock/data/rundown'

export default defineEventHandler(async (event: H3Event): Promise<RundownRoleCreatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<CreateRundownRoleBody>(event)

  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入角色名稱' })
  }
  if (mockRundownRoles.some(r => r.weddingId === weddingId && r.name === name)) {
    throw createError({ statusCode: 400, statusMessage: '角色名稱已存在' })
  }

  const roleId = `role-${crypto.randomUUID().slice(0, 8)}`
  mockRundownRoles.push({ roleId, weddingId, name })

  setResponseStatus(event, 201)
  return { roleId, weddingId, name }
})
