// 祝福留言：提交 / 審核通過 / 審核拒絕

export type BlessingStatus = 'submitted' | 'approved' | 'rejected'

export interface BlessingListItem {
  blessingId: string
  weddingId: string
  guestId: string
  message: string
  photoUrl: string | null
  status: BlessingStatus
  rejectReason: string | null
}

export interface SubmitBlessingBody {
  guestId: string
  message: string
  photoUrl?: string
}

export interface BlessingSubmittedEvent {
  blessingId: string
  guestId: string
  message: string
  photoUrl: string | null
}

export interface BlessingApprovedEvent {
  blessingId: string
  status: BlessingStatus
}

export interface RejectBlessingBody {
  reason: string
}

export interface BlessingRejectedEvent {
  blessingId: string
  status: BlessingStatus
  reason: string
}
