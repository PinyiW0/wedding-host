// API 路由存取分類（RBAC 授權表）
// 基底：spec/ir/ir-export.json authMatrix（41 command + 19 view 的 allowedActors），
// 對應調整：IR 的 Admin actor 涵蓋現在的「管理者＋新人」（新人受婚禮範圍限制）、
// 管理者為超級角色一律放行；IR 未定義的新模組（gifts/rundown/projection/venue-markers/
// guest-categories）依「管理端預設、接待端白名單、公開頁分享」原則補齊。

export type RouteAccess
  = | { kind: 'public' } // 完全公開：登入、管理員註冊（RegisterAdmin: Anonymous）
    // 婚禮分享資料：有效簽名（w/g）或任一有權使用者。
    // open＝公開三頁（故事／喜帖／相簿）與出席回覆本身需要的那幾支：新人自己那場（landingWeddingId）不帶簽章也放行（issue #163）
    | { kind: 'share', weddingId: string, open?: boolean }
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
  'blessings', // 投影牆讀取（僅簽名連結持有者可達）
  'guests/display-names', // 投影牆賓客名對照：僅 id+name，無 PII（完整賓客資料收回管理端 auth）
])

// 接待端白名單 GET（報到／禮金／喜餅發放所需讀取）
const RECEPTION_GET = new Set([
  'guests', // 接待台報到需讀賓客名單（完整資料限已登入管理端／接待員，公開頁走 guests/display-names）
  'reception-status',
  'tables', // 接待台桌次圖需讀桌次（原漏列導致接待員 403、桌次圖空白）
  'seats', // 全婚禮座位批次查詢（桌次圖入座狀態）
  'cake-box-types',
  'cake-box-types/assignments',
  'cake-box-exclusions',
  'cake-box-extra-orders',
])

// 公開三頁與出席回覆頁「自己就會打」的讀取：婚禮詳情、RSVP 表單設定、LINE 加好友、花田。
// 這幾支對新人自己那場不驗簽章（issue #163）——公開頁已寫死綁一個婚禮 ID、ID 本來就在網址上，簽章沒有多保護什麼，
// 卻是上線後每一次「出席回覆載入失敗」的原因（入口網址少了 ?sig=，喜帖／相簿頁不打 API 看不出來，點到出席回覆才 403）。
// 投影牆（blessings、guests/display-names、projection-settings）與流程表不在此列：那些會列出賓客姓名，維持要簽章
const LANDING_OPEN_GET = new Set(['', 'rsvp-config', 'line-oa', 'flowers'])

// 這個請求是不是「新人自己那場的 open 路由」（issue #163）。landingId 沒設（dev／e2e 是空字串）＝沒有這個例外
export function isLandingOpen(route: RouteAccess, landingId: string | null | undefined): boolean {
  return route.kind === 'share' && route.open === true && !!landingId && route.weddingId === landingId
}

const GUEST_ACTION_RE = /^guests\/([^/]+)\/(?:rsvp|self-check-in|line-binding)$/
const GUEST_LINE_LOGIN_RE = /^guests\/([^/]+)\/line-login$/ // OAuth 起手（GET）：同賓客專屬授權
const THANK_YOU_PUBLIC_RE = /^thank-you-card\/public\/([^/]+)$/
const RECEPTION_ACTION_RE = /^guests\/[^/]+\/(?:check-in|cake-box-distribution)$/
const GIFT_MONEY_RE = /^guests\/[^/]+\/gift-money$/
const BLESSING_REVIEW_RE = /^blessings\/[^/]+\/(?:approve|reject|project)$/
// 現場臨時來賓（issue #138）：接待台當場新增賓客／開桌／入座。
// 原本這三支只放行管理端，接待員登入會 403，現場加人得回頭找管理者
const RECEPTION_ONSITE_CREATE_RE = /^(?:guests|tables|tables\/[^/]+\/seats)$/
const WEDDING_PATH_RE = /^weddings\/([^/]+)(?:\/(.*))?$/

export function classifyRoute(method: string, pathname: string): RouteAccess {
  const rest = pathname.slice('/api/v1/'.length)

  if ((rest === 'auth/login' || rest === 'admins') && method === 'POST')
    return { kind: 'public' }

  // 健康檢查（issue #26）：外部監測用，完全公開
  if (rest === 'health' && method === 'GET')
    return { kind: 'public' }

  // 新人帳號管理（users CRUD）：管理者限定（issue #23，authMatrix 補「管理者限定」定義）
  if (rest === 'users' || rest.startsWith('users/'))
    return { kind: 'auth', weddingId: null, receptionist: false, adminOnly: true }

  const weddingMatch = rest.match(WEDDING_PATH_RE)
  if (!weddingMatch) {
    // weddings 列表／建立與其他未知路由：一律需登入管理端
    const adminOnly = rest === 'weddings' && method === 'POST' // CreateWedding: 管理者
    return { kind: 'auth', weddingId: null, receptionist: false, adminOnly }
  }

  const weddingId = decodeURIComponent(weddingMatch[1]!)
  const sub = weddingMatch[2] ?? ''

  // 賓客專屬操作（簽名需含相符 guestId）
  const guestAction = method === 'POST'
    ? sub.match(GUEST_ACTION_RE)
    : method === 'GET' ? sub.match(GUEST_LINE_LOGIN_RE) : null
  if (guestAction)
    return { kind: 'guest', weddingId, guestId: decodeURIComponent(guestAction[1]!) }
  const thankYouPublic = method === 'GET' ? sub.match(THANK_YOU_PUBLIC_RE) : null
  if (thankYouPublic)
    return { kind: 'guest', weddingId, guestId: decodeURIComponent(thankYouPublic[1]!) }

  // 婚禮分享資料：公開頁讀取＋公開表單／祝福提交（SubmitRsvp、SubmitBlessing: Guest）
  if (method === 'GET' && SHARE_GET.has(sub))
    return LANDING_OPEN_GET.has(sub) ? { kind: 'share', weddingId, open: true } : { kind: 'share', weddingId }
  // 出席回覆提交：跟上面四支讀取同一組，新人那場免簽章
  if (method === 'POST' && sub === 'guests/rsvp-public')
    return { kind: 'share', weddingId, open: true }
  // uploads/presign：公開頁（祝福照片等）與管理端共用的圖片直傳簽名；祝福提交會上牆，兩者維持要簽章
  if (method === 'POST' && (sub === 'blessings' || sub === 'uploads/presign'))
    return { kind: 'share', weddingId }

  // 接待端白名單（CheckInByReception／RecordGiftMoney／DistributeCakeBox／審核祝福）
  const receptionist
    = (method === 'POST' && (RECEPTION_ACTION_RE.test(sub) || GIFT_MONEY_RE.test(sub) || BLESSING_REVIEW_RE.test(sub) || RECEPTION_ONSITE_CREATE_RE.test(sub)))
      || (method === 'PATCH' && GIFT_MONEY_RE.test(sub))
      || (method === 'GET' && RECEPTION_GET.has(sub))

  // 婚禮生命週期（SoftDeleteWedding／RestoreWedding: 管理者）
  const adminOnly
    = (method === 'DELETE' && sub === '')
      || (method === 'POST' && sub === 'restore')

  return { kind: 'auth', weddingId, receptionist, adminOnly }
}
