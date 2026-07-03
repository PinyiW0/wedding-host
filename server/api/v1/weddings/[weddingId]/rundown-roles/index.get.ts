import type { H3Event } from 'h3'
import type { RundownRoleListItem } from '../../../../../../app/types/api/rundown'

import { mockRundownRoles } from '../../../../../mock/data/rundown'

export default defineEventHandler((event: H3Event): RundownRoleListItem[] => {
  const weddingId = getRouterParam(event, 'weddingId')!
  return mockRundownRoles.filter(r => r.weddingId === weddingId)
})
