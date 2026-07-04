import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

// 賓客連結 HMAC 簽名：防止裸 id 枚舉（連結由新人人工傳送，簽名擋轉傳外洩後的鄰近 id 竄改）
// 格式：
//   婚禮分享連結（公開 RSVP／流程表／花田／投影）→ w.<digest>
//   賓客專屬連結（RSVP／謝卡／自助報到／祝福）  → g.<guestId>.<digest>
// digest 綁定 weddingId（＋guestId），不含過期時間：連結人工傳送且需長期有效（婚後謝卡），
// 需失效時輪換 NUXT_GUEST_LINK_SECRET 即可

function hmac(payload: string): string {
  return createHmac('sha256', useRuntimeConfig().guestLinkSecret).update(payload).digest('base64url')
}

export function signWeddingLink(weddingId: string): string {
  return `w.${hmac(`w:${weddingId}`)}`
}

export function signGuestLink(weddingId: string, guestId: string): string {
  return `g.${guestId}.${hmac(`g:${weddingId}:${guestId}`)}`
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

// 驗證簽名是否授權存取該婚禮；requiredGuestId 給定時僅接受相符的賓客簽名
// （賓客簽名可通行婚禮層級的分享資料；婚禮分享簽名不可通行賓客專屬操作）
export function verifyLinkSig(sig: string, weddingId: string, requiredGuestId?: string): boolean {
  const parts = sig.split('.')
  if (parts[0] === 'g' && parts.length === 3) {
    const [, guestId, digest] = parts
    if (requiredGuestId && guestId !== requiredGuestId)
      return false
    return safeEqual(digest!, hmac(`g:${weddingId}:${guestId}`))
  }
  if (parts[0] === 'w' && parts.length === 2) {
    if (requiredGuestId)
      return false
    return safeEqual(parts[1]!, hmac(`w:${weddingId}`))
  }
  return false
}
