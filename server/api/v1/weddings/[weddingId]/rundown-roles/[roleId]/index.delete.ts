import type { H3Event } from 'h3'

import { mockRundownItems, mockRundownRoles } from '../../../../../../mock/data/rundown'

export default defineEventHandler((event: H3Event): void => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const roleId = getRouterParam(event, 'roleId')!

  const index = mockRundownRoles.findIndex(r => r.weddingId === weddingId && r.roleId === roleId)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: '流程角色不存在' })
  }

  mockRundownRoles.splice(index, 1)

  // 級聯清理：從各項目的 roleTasks 移除該角色的條目
  for (const item of mockRundownItems) {
    if (item.weddingId === weddingId && item.roleTasks.some(rt => rt.roleId === roleId))
      item.roleTasks = item.roleTasks.filter(rt => rt.roleId !== roleId)
  }

  setResponseStatus(event, 204)
})
