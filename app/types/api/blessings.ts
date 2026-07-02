// 祝福留言：提交 / 審核通過 / 審核拒絕

export type BlessingStatus = 'submitted' | 'approved' | 'rejected'
// 上牆狀態（僅 approved 有意義）：待上牆 / 已上牆（避免投影重播）
export type BlessingWallStatus = 'pending_wall' | 'on_wall'

export interface BlessingListItem {
  blessingId: string
  weddingId: string
  guestId: string
  message: string
  photoUrl: string | null
  status: BlessingStatus
  rejectReason: string | null
  // approved 後的上牆狀態；未通過審核為 undefined
  wallStatus?: BlessingWallStatus
}

export interface BlessingProjectedEvent {
  blessingId: string
  wallStatus: BlessingWallStatus
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
