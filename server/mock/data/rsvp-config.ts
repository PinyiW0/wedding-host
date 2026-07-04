// RSVP 表單設定 mock 資料：每場婚禮一份；未設定過時回「預設範本」（現有那套系統題）

import type { RsvpFormConfigDetail, RsvpQuestion } from '../../../app/types/api/rsvp-config'

export interface MockRsvpFormConfig extends RsvpFormConfigDetail {}

// 預設範本＝現有賓客表單那套系統題（依畫面順序），theme=minimal、banner=null
// 接駁車作為「自訂單選題範例」呈現（取代原系統題），示範針對特定對象的客製題
export function defaultRsvpQuestions(): RsvpQuestion[] {
  return [
    { type: 'builtin', key: 'attending', label: '是否會出席婚禮？', enabled: true, order: 1 },
    { type: 'builtin', key: 'diet', label: '餐點選擇', enabled: true, order: 2 },
    { type: 'builtin', key: 'partySize', label: '攜伴人數', enabled: true, order: 3 },
    { type: 'builtin', key: 'childChair', label: '兒童椅數', enabled: true, order: 4 },
    {
      type: 'single',
      id: 'q-shuttle',
      label: '高雄地區接駁車',
      description: '只有高雄地區的家人才可以選這個選項',
      required: false,
      order: 5,
      options: [
        { value: 'need', label: '需要搭乘' },
        { value: 'no', label: '不需要' },
      ],
    },
    { type: 'builtin', key: 'invitation', label: '是否需要喜帖？', enabled: true, order: 6 },
    { type: 'builtin', key: 'blessing', label: '想給新人的祝福', enabled: true, order: 7 },
    { type: 'builtin', key: 'flower', label: '畫一朵小花給新人們', enabled: true, order: 8 },
  ]
}

export function defaultRsvpFormConfig(weddingId: string): RsvpFormConfigDetail {
  return { weddingId, theme: 'minimal', banner: null, questions: defaultRsvpQuestions() }
}

// 已被管理員覆寫過的設定才入此表；查無則回預設範本
export const mockRsvpFormConfigs: MockRsvpFormConfig[] = []
