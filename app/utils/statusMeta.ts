// 業務狀態的「文字 + 語意色」單一事實來源（SSOT）
//
// 設計原則：
// - label 為凍結 e2e 合約（getByText 定位），必須與各頁現行文字逐字一致，不得更動。
// - color 未被任何 e2e 斷言，於此集中收斂，消除「同一狀態跨頁不同色」的視覺不一致。
// - variant / size 由 StatusBadge 統一，不在此處決定。

import type { BlessingStatus } from '~/types/api/blessings'
import type { AttendingStatus } from '~/types/api/rsvp'

// 對齊 nuxt.config 的 ui.theme.colors（即 NuxtUI 語意色）
export type SemanticColor
  = | 'primary'
    | 'secondary'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'neutral'

export interface StatusMeta {
  label: string
  color: SemanticColor
}

// RSVP 出席狀態（出席=success、缺席/不出席=error、未回覆=warning）
// pendingLabel：null 狀態的文字因頁面語境而異——RSVP 管理頁用「未提交」、賓客名單頁用「待回覆」，
// 兩者皆為現行凍結文字，故由呼叫端指定，預設「待回覆」。
export function rsvpAttendingMeta(
  status: AttendingStatus | null,
  pendingLabel = '待回覆',
): StatusMeta {
  switch (status) {
    case 'attending':
      return { label: '出席', color: 'success' }
    case 'declined':
      return { label: '不出席', color: 'error' }
    case 'absent':
      return { label: '缺席', color: 'error' }
    default:
      return { label: pendingLabel, color: 'warning' }
  }
}

// 祝福審核狀態
export function blessingStatusMeta(status: BlessingStatus): StatusMeta {
  switch (status) {
    case 'approved':
      return { label: '已通過', color: 'success' }
    case 'rejected':
      return { label: '已拒絕', color: 'error' }
    default:
      return { label: '待審', color: 'warning' }
  }
}

// 報到狀態
export function checkinMeta(checkedIn: boolean): StatusMeta {
  return checkedIn
    ? { label: '已報到', color: 'success' }
    : { label: '未報到', color: 'warning' }
}
