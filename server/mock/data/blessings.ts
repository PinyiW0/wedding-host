// 祝福留言 mock 資料
// seed：blessing-001（祝福新人百年好合！/ 已提交待審）

import type { BlessingStatus } from '../../../app/types/api/blessings'

export interface MockBlessing {
  blessingId: string
  weddingId: string
  guestId: string
  message: string
  photoUrl: string | null
  status: BlessingStatus
  rejectReason: string | null
}

export const mockBlessings: MockBlessing[] = [
  { blessingId: 'blessing-001', weddingId: 'wedding-001', guestId: 'guest-001', message: '祝福新人百年好合！', photoUrl: null, status: 'submitted', rejectReason: null },
  { blessingId: 'blessing-002', weddingId: 'wedding-001', guestId: 'guest-002', message: '永浴愛河，白頭偕老！', photoUrl: null, status: 'submitted', rejectReason: null },
  { blessingId: 'blessing-003', weddingId: 'wedding-001', guestId: 'guest-003', message: '早生貴子，幸福美滿！', photoUrl: null, status: 'submitted', rejectReason: null },
]
