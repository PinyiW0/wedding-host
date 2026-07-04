import type { H3Event } from 'h3'
import type { RundownRoleUpdatedEvent, UpdateRundownRoleBody } from '../../../../../../../app/types/api/rundown'

import { mockRundownRoles } from '../../../../../../mock/data/rundown'

export default defineEventHandler(async (event: H3Event): Promise<RundownRoleUpdatedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const roleId = getRouterParam(event, 'roleId')!
  const body = await readBody<UpdateRundownRoleBody>(event)

  const role = mockRundownRoles.find(r => r.weddingId === weddingId && r.roleId === roleId)
  if (!role) {
    throw createError({ statusCode: 404, statusMessage: '流程角色不存在' })
  }

  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入角色名稱' })
  }
  if (mockRundownRoles.some(r => r.weddingId === weddingId && r.roleId !== roleId && r.name === name)) {
    throw createError({ statusCode: 400, statusMessage: '角色名稱已存在' })
  }

  role.name = name
  return { roleId, name }
})
