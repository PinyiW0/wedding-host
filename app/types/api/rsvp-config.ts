// RSVP 表單客製化：題目組成（系統題開關／標籤／排序、自訂題）＋ 外觀（模板／banner）

// 表單外觀模板：極簡白底 / 花卉水彩 / 大圖主視覺
export type RsvpTheme = 'minimal' | 'floral' | 'photo'

// 大圖模板的一個版本：一組照片＋一個底色，賓客左右滑動時整組換掉（見 RsvpBannerCollage.vue）。
// 設計者 09-18 指定用海邊與都市兩組婚紗照——兩組色調差得夠遠，底色換了才看得出來
export interface RsvpBanner {
  // 這組當前時，照片區塊的底色（#rrggbb）
  tone: string
  // 這組的照片：第一張當主圖，其餘兩張是旁邊的小圖。
  // R2 公開 URL；本機／e2e 未設定 R2 時是 dataURL（同 useImageUpload 的兩種回傳值）
  photos: string[]
}

// 一組最多三張：拼貼只有三個槽，第四張起沒有位置可放
export const RSVP_BANNER_PHOTO_MAX = 3
// 最多三組：賓客不會左右滑超過三次，再多只是新人多上傳照片
export const RSVP_BANNER_SET_MAX = 3

// 系統題 key（對應賓客表單既有的可設定題目）
export type RsvpBuiltinKey
  = | 'attending' // 是否出席
    | 'diet' // 餐點
    | 'partySize' // 攜伴人數
    | 'childChair' // 兒童椅數
    | 'shuttle' // 接駁車（顯示對象由 audience 設定）
    | 'invitation' // 喜帖需求
    | 'blessing' // 祝福留言
    | 'flower' // 畫小花

// 自訂題輸入型別
export type RsvpCustomType = 'text' | 'single' | 'multi'

// 題目顯示對象：省略或 'all' ＝所有人；'groom'／'bride' ＝只有該側親友看得到
// （賓客在表單開頭自選「與新人的關係」，據此決定後續題目是否出現）
export type RsvpAudience = 'all' | 'groom' | 'bride'

export interface RsvpQuestionOption {
  value: string
  label: string
}

// 系統題：由 key 識別，僅能開關／改標籤／說明／顯示對象／排序（輸入機制由前端固定渲染）
export interface RsvpBuiltinQuestion {
  type: 'builtin'
  key: RsvpBuiltinKey
  label: string
  // 補充說明（選填，例：只有高雄地區的家人才需要選）
  description?: string
  enabled: boolean
  // 顯示對象（選填，省略＝所有人）
  audience?: RsvpAudience
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
  // 顯示對象（選填，省略＝所有人）
  audience?: RsvpAudience
  order: number
  // single / multi 專用選項
  options?: RsvpQuestionOption[]
}

export type RsvpQuestion = RsvpBuiltinQuestion | RsvpCustomQuestion

// 讀回該婚禮的 RSVP 表單設定（未設定過回預設範本，不回 null）
// banner 與 banners 並存：banner 是改多圖之前的單張欄位，保留下來當向後相容的影子，
// 永遠等於 banners[0]?.photos[0]。畫面只讀 banners，banner 留給舊版前端與既有 spec 的 payload
export interface RsvpFormConfigDetail {
  weddingId: string
  theme: RsvpTheme
  banner: string | null
  banners: RsvpBanner[]
  questions: RsvpQuestion[]
}

export interface ConfigureRsvpFormBody {
  weddingId: string
  theme: RsvpTheme
  banner?: string | null
  banners?: RsvpBanner[]
  questions: RsvpQuestion[]
}

export interface RsvpFormConfiguredEvent {
  weddingId: string
  theme: RsvpTheme
  banner: string | null
  banners: RsvpBanner[]
  questions: RsvpQuestion[]
}
