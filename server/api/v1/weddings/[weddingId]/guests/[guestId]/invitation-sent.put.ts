import type { H3Event } from 'h3'
import type { InvitationSentMarkedEvent, MarkInvitationSentBody } from '../../../../../../../app/types/api/guests'

import { mockGuests } from '../../../../../../mock/data/guests'

// 標記喜帖已寄送：PUT 冪等設值（重複送同值不報錯，可勾選可取消）
export default defineEventHandler(async (event: H3Event): Promise<InvitationSentMarkedEvent> => {
  const guestId = getRouterParam(event, 'guestId')
  const body = await readBody<MarkInvitationSentBody>(event)

  const guest = mockGuests.find(g => g.guestId === guestId && !g.deletedAt)
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }

  guest.invitationSent = body?.sent === true

  return { guestId: guest.guestId, invitationSent: guest.invitationSent }
})
