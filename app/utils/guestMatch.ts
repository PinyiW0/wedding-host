// 待確認賓客的「姓名提示候選」比對：只給提示、永不自動合併
// 信心級別：手機相同＝高；姓名完全相同+同側＝中；姓名相近＝低。手機只是加分，沒有就降級為姓名提示。

import type { GuestListItem } from '~/types/api/guests'

export type MatchConfidence = 'high' | 'medium' | 'low'

export interface GuestMatchCandidate {
  guest: GuestListItem
  confidence: MatchConfidence
  reason: string
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = { high: 0, medium: 1, low: 2 }
// 非數字字元（手機正規化用）；提至 module scope 避免每次呼叫重編譯
const NON_DIGIT_RE = /\D/g

export const matchConfidenceLabel: Record<MatchConfidence, string> = {
  high: '高度相符',
  medium: '可能相符',
  low: '姓名相近',
}

// 正規化手機：只留數字，方便比對 0912-345-678 / 0912345678
export function normalizePhone(phone?: string | null): string {
  return (phone ?? '').replace(NON_DIGIT_RE, '')
}

export function suggestMatches(
  guests: GuestListItem[],
  incoming: Pick<GuestListItem, 'name' | 'contact' | 'side'>,
  limit = 5,
): GuestMatchCandidate[] {
  const inPhone = normalizePhone(incoming.contact)
  const inName = (incoming.name ?? '').trim()
  const candidates: GuestMatchCandidate[] = []

  for (const g of guests) {
    if (g.deletedAt)
      continue
    const gPhone = normalizePhone(g.contact)
    const gName = (g.name ?? '').trim()

    if (inPhone && gPhone && inPhone === gPhone) {
      candidates.push({ guest: g, confidence: 'high', reason: '手機號碼相同' })
      continue
    }
    if (inName && gName === inName && g.side === incoming.side) {
      candidates.push({ guest: g, confidence: 'medium', reason: '姓名與側別相同' })
      continue
    }
    if (inName && gName && (gName.includes(inName) || inName.includes(gName))) {
      candidates.push({ guest: g, confidence: 'low', reason: '姓名相近' })
    }
  }

  return candidates
    .sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence])
    .slice(0, limit)
}
