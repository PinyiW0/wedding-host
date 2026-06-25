// RSVP 出席管理：發送邀請 / 賓客提交 / 管理員覆寫

export type RsvpChannel = 'line' | 'email'
export type AttendingStatus = 'attending' | 'declined' | 'absent'

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
}

export interface RsvpSubmittedEvent {
  guestId: string
  attending: AttendingStatus
  diet: 'meat' | 'vegetarian'
  plusOneCount: number
  childChairCount: number
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
