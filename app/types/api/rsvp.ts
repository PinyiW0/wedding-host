// RSVP 出席管理：發送邀請 / 賓客提交 / 管理員覆寫

export type RsvpChannel = 'line' | 'email'
export type AttendingStatus = 'attending' | 'declined' | 'absent'

// 與新人的關係：groom = 振茗的親友、bride = 品儀的親友
export type GuestRelationship = 'groom' | 'bride'
// 喜帖需求：電子 / 實體 / 不需要
export type InvitationPreference = 'e-card' | 'physical' | 'none'

export interface SendRsvpInvitationBody {
  channel: RsvpChannel
}

export interface RsvpInvitationSentEvent {
  guestId: string
  channel: RsvpChannel
}

export interface SubmitRsvpBody {
  attending: AttendingStatus
  diet: 'meat' | 'vegetarian'
  // 同行人數（攜伴大人＋會自己坐吃大人菜的小孩；皆佔正常席）
  plusOneCount: number
  // 兒童椅嬰兒數（不吃大人菜、不佔正常席、該桌額外加位）
  childChairCount: number
  // 以下為訪客 RSVP 表單補充欄位（皆選填，不影響既有出席統計契約）
  guestName?: string // 大名
  relationship?: GuestRelationship // 與新人的關係（側別：新郎／新娘）
  relationCategory?: string // 身分類別（家人／朋友／同事…），對應賓客分類
  phone?: string // 聯繫電話
  invitation?: InvitationPreference // 喜帖需求
  mailingAddress?: string // 紙本喜帖寄送地址（3+2 郵遞區號 + 地址）
  blessing?: string // 給新人的祝福留言
  flowerDrawing?: string // 手繪小花（image/png dataURL）
  // 接駁車（限男方親友／高雄地區）：是否搭乘、搭車人數
  needsShuttle?: boolean
  shuttleCount?: number
}

export interface RsvpSubmittedEvent {
  guestId: string
  attending: AttendingStatus
  diet: 'meat' | 'vegetarian'
  plusOneCount: number
  childChairCount: number
  guestName?: string
  relationship?: GuestRelationship
  relationCategory?: string
  phone?: string
  invitation?: InvitationPreference
  mailingAddress?: string
  blessing?: string
  flowerDrawing?: string
  needsShuttle?: boolean
  shuttleCount?: number
}

export interface OverrideRsvpBody {
  attending: AttendingStatus
  reason: string
}

export interface RsvpOverriddenEvent {
  guestId: string
  attending: AttendingStatus
  reason: string
}
