import type { H3Event } from 'h3'
import type { SignedLinkResponse } from '../../../../../app/types/api/links'

// 產生賓客連結簽名（管理端專用；由統一中介層限管理者/新人）
// 帶 guestId → 賓客專屬簽名（RSVP/謝卡/自助報到/祝福）；帶 roleId → 流程表角色簽名（issue #188）；
// 都不帶 → 婚禮分享簽名（公開表單/流程表/投影/花田）
export default defineEventHandler((event: H3Event): SignedLinkResponse => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const query = getQuery(event)
  const guestId = typeof query.guestId === 'string' && query.guestId ? query.guestId : undefined
  const roleId = typeof query.roleId === 'string' && query.roleId ? query.roleId : undefined
  if (guestId)
    return { sig: signGuestLink(weddingId, guestId) }
  if (roleId)
    return { sig: signRoleLink(weddingId, roleId) }
  return { sig: signWeddingLink(weddingId) }
})
