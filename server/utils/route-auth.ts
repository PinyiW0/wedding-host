// API 路由存取分類（RBAC 授權表）
// 基底：spec/ir/ir-export.json authMatrix（41 command + 19 view 的 allowedActors），
// 對應調整：IR 的 Admin actor 涵蓋現在的「管理者＋新人」（新人受婚禮範圍限制）、
// 管理者為超級角色一律放行；IR 未定義的新模組（gifts/rundown/projection/venue-markers/
// guest-categories）依「管理端預設、接待端白名單、公開頁分享」原則補齊。

export type RouteAccess
  = | { kind: 'public' } // 完全公開：登入、管理員註冊（RegisterAdmin: Anonymous）
    | { kind: 'share', weddingId: string } // 婚禮分享資料：有效簽名（w/g）或任一有權使用者
    | { kind: 'guest', weddingId: string, guestId: string } // 賓客專屬：相符的 g 簽名或有權使用者
    | { kind: 'auth', weddingId: string | null, receptionist: boolean, adminOnly?: boolean }

// 公開頁（RSVP／謝卡／自助報到／投影／流程表／花田）讀取的婚禮層級資料
const SHARE_GET = new Set([
  '', // 婚禮詳情（各公開頁共用）
  'rsvp-config',
  'line-oa',
  'flowers',
  'projection-settings',
  'rundown-items',
  'rundown-roles',
  'blessings', // 投影牆讀取（含賓客名單：僅簽名連結持有者可達，讀取模型瘦身列 M9）
  'guests',
])

// 接待端白名單 GET（報到／禮金／喜餅發放所需讀取）
const RECEPTION_GET = new Set([
  'reception-status',
  'cake-box-types',
  'cake-box-types/assignments',
  'cake-box-exclusions',
  'cake-box-extra-orders',
])

const GUEST_ACTION_RE = /^guests\/([^/]+)\/(?:rsvp|self-check-in|line-binding)$/
const THANK_YOU_PUBLIC_RE = /^thank-you-card\/public\/([^/]+)$/
const RECEPTION_ACTION_RE = /^guests\/[^/]+\/(?:check-in|cake-box-distribution)$/
const GIFT_MONEY_RE = /^guests\/[^/]+\/gift-money$/
const BLESSING_REVIEW_RE = /^blessings\/[^/]+\/(?:approve|reject|project)$/
const WEDDING_PATH_RE = /^weddings\/([^/]+)(?:\/(.*))?$/

export function classifyRoute(method: string, pathname: string): RouteAccess {
  const rest = pathname.slice('/api/v1/'.length)

  if ((rest === 'auth/login' || rest === 'admins') && method === 'POST')
    return { kind: 'public' }

  const weddingMatch = rest.match(WEDDING_PATH_RE)
  if (!weddingMatch) {
    // weddings 列表／建立與其他未知路由：一律需登入管理端
    const adminOnly = rest === 'weddings' && method === 'POST' // CreateWedding: 管理者
    return { kind: 'auth', weddingId: null, receptionist: false, adminOnly }
  }

  const weddingId = decodeURIComponent(weddingMatch[1]!)
  const sub = weddingMatch[2] ?? ''

  // 賓客專屬操作（簽名需含相符 guestId）
  const guestAction = method === 'POST' ? sub.match(GUEST_ACTION_RE) : null
  if (guestAction)
    return { kind: 'guest', weddingId, guestId: decodeURIComponent(guestAction[1]!) }
  const thankYouPublic = method === 'GET' ? sub.match(THANK_YOU_PUBLIC_RE) : null
  if (thankYouPublic)
    return { kind: 'guest', weddingId, guestId: decodeURIComponent(thankYouPublic[1]!) }

  // 婚禮分享資料：公開頁讀取＋公開表單／祝福提交（SubmitRsvp、SubmitBlessing: Guest）
  if (method === 'GET' && SHARE_GET.has(sub))
    return { kind: 'share', weddingId }
  // uploads/presign：公開頁（祝福照片等）與管理端共用的圖片直傳簽名
  if (method === 'POST' && (sub === 'guests/rsvp-public' || sub === 'blessings' || sub === 'uploads/presign'))
    return { kind: 'share', weddingId }

  // 接待端白名單（CheckInByReception／RecordGiftMoney／DistributeCakeBox／審核祝福）
  const receptionist
    = (method === 'POST' && (RECEPTION_ACTION_RE.test(sub) || GIFT_MONEY_RE.test(sub) || BLESSING_REVIEW_RE.test(sub)))
      || (method === 'PATCH' && GIFT_MONEY_RE.test(sub))
      || (method === 'GET' && RECEPTION_GET.has(sub))

  // 婚禮生命週期（SoftDeleteWedding／RestoreWedding: 管理者）
  const adminOnly
    = (method === 'DELETE' && sub === '')
      || (method === 'POST' && sub === 'restore')

  return { kind: 'auth', weddingId, receptionist, adminOnly }
}
