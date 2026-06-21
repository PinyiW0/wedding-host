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
  plusOneCount: number
  needChildSeat: boolean
}

export interface RsvpSubmittedEvent {
  guestId: string
  attending: AttendingStatus
  diet: 'meat' | 'vegetarian'
  plusOneCount: number
  needChildSeat: boolean
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
