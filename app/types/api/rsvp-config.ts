// RSVP 表單客製化：題目組成（系統題開關／標籤／排序、自訂題）＋ 外觀（模板／banner）

// 表單外觀模板：極簡白底 / 花卉水彩 / 大圖主視覺
export type RsvpTheme = 'minimal' | 'floral' | 'photo'

// 系統題 key（對應賓客表單既有的可設定題目）
export type RsvpBuiltinKey
  = | 'attending' // 是否出席
    | 'diet' // 餐點
    | 'partySize' // 攜伴人數
    | 'childChair' // 兒童椅數
    | 'shuttle' // 接駁車（限男方親友）
    | 'invitation' // 喜帖需求
    | 'blessing' // 祝福留言
    | 'flower' // 畫小花

// 自訂題輸入型別
export type RsvpCustomType = 'text' | 'single' | 'multi'

export interface RsvpQuestionOption {
  value: string
  label: string
}

// 系統題：由 key 識別，僅能開關／改標籤／排序（輸入機制由前端固定渲染）
export interface RsvpBuiltinQuestion {
  type: 'builtin'
  key: RsvpBuiltinKey
  label: string
  enabled: boolean
  order: number
}

// 自訂題：由 id 識別，單行文字／單選／多選
export interface RsvpCustomQuestion {
  type: RsvpCustomType
  id: string
  label: string
  // 補充說明（選填，例：限定填答對象）
  description?: string
  required: boolean
  order: number
  // single / multi 專用選項
  options?: RsvpQuestionOption[]
}

export type RsvpQuestion = RsvpBuiltinQuestion | RsvpCustomQuestion

// 讀回該婚禮的 RSVP 表單設定（未設定過回預設範本，不回 null）
export interface RsvpFormConfigDetail {
  weddingId: string
  theme: RsvpTheme
  banner: string | null
  questions: RsvpQuestion[]
}

export interface ConfigureRsvpFormBody {
  weddingId: string
  theme: RsvpTheme
  banner?: string | null
  questions: RsvpQuestion[]
}

export interface RsvpFormConfiguredEvent {
  weddingId: string
  theme: RsvpTheme
  banner: string | null
  questions: RsvpQuestion[]
}
