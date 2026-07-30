// RSVP 表單設定 mock 資料：每場婚禮一份；未設定過時回「預設範本」（現有那套系統題）

import type { RsvpFormConfigDetail, RsvpQuestion } from '../../../app/types/api/rsvp-config'

export interface MockRsvpFormConfig extends RsvpFormConfigDetail {}

// 預設範本＝現有賓客表單那套系統題（依畫面順序），theme=minimal、banner=null
// 接駁車示範「顯示對象」：audience='groom' 讓男方親友才看得到（新人可在後台改為所有人／女方）
export function defaultRsvpQuestions(): RsvpQuestion[] {
  return [
    { type: 'builtin', key: 'attending', label: '是否會出席婚禮？', enabled: true, order: 1 },
    { type: 'builtin', key: 'diet', label: '餐點選擇', enabled: true, order: 2 },
    { type: 'builtin', key: 'partySize', label: '攜伴人數', enabled: true, order: 3 },
    { type: 'builtin', key: 'childChair', label: '兒童椅數', enabled: true, order: 4 },
    {
      type: 'builtin',
      key: 'shuttle',
      label: '高雄地區接駁車',
      description: '只有高雄地區的家人才需要選',
      enabled: true,
      audience: 'groom',
      order: 5,
    },
    { type: 'builtin', key: 'invitation', label: '是否需要喜帖？', enabled: true, order: 6 },
    { type: 'builtin', key: 'blessing', label: '想給新人的祝福', enabled: true, order: 7 },
    { type: 'builtin', key: 'flower', label: '畫一朵小花給新人們', enabled: true, order: 8 },
  ]
}

export function defaultRsvpFormConfig(weddingId: string): RsvpFormConfigDetail {
  return { weddingId, theme: 'minimal', banner: null, questions: defaultRsvpQuestions() }
}

// 存檔正規化：補回預設範本有、但存檔缺少的系統題（依 order 插回原位）
// 後台只能開關系統題、不能刪，故缺漏必來自版本落差——補回可讓既有設定自動長出新系統題
export function normalizeRsvpQuestions(saved: RsvpQuestion[]): RsvpQuestion[] {
  const savedKeys = new Set(
    saved.filter(q => q.type === 'builtin').map(q => q.key),
  )
  const missing = defaultRsvpQuestions().filter(
    q => q.type === 'builtin' && !savedKeys.has(q.key),
  )
  if (!missing.length)
    return saved
  return [...saved, ...missing].sort((a, b) => a.order - b.order)
}

// 已被管理員覆寫過的設定才入此表；查無則回預設範本
export const mockRsvpFormConfigs: MockRsvpFormConfig[] = []
