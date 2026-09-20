<!-- app/components/RsvpForm.vue — 賓客 RSVP 表單（依 RsvpFormConfig 渲染，邀請頁與公開頁共用） -->
<script setup lang="ts">
import type {
  AttendingStatus,
  GuestRelationship,
  InvitationPreference,
  SubmitRsvpBody,
} from '~/types/api/rsvp'
import type {
  RsvpAudience,
  RsvpBuiltinKey,
  RsvpCustomQuestion,
  RsvpFormConfigDetail,
} from '~/types/api/rsvp-config'

const props = withDefaults(
  defineProps<{
    config: RsvpFormConfigDetail
    groomName: string
    brideName: string
    // 婚禮日期（YYYY-MM-DD）與場地，顯示於 hero；未給則該行不出現
    weddingDate?: string
    venue?: string
    lineAddUrl?: string
    submitting?: boolean
    submitted?: boolean
    errorMessage?: string
    // 後台即時預覽：隱藏送出鈕、反饋與 LINE 區塊，純呈現
    preview?: boolean
    // 公開 RSVP（無 guestId）需姓名識別回覆者；已知賓客模式不傳（spec 凍結：送出可不填姓名）
    requireName?: boolean
  }>(),
  { weddingDate: '', venue: '', lineAddUrl: '', submitting: false, submitted: false, errorMessage: '', preview: false, requireName: false },
)

const emit = defineEmits<{ submit: [body: SubmitRsvpBody] }>()

// 日期照喜帖的印法（2026-12-01 → 2026 · 12 · 01），與場地同一行
// 09-18 早上曾改成「2026.12.01」（中間點資訊列是任何主題都能貼的模板樣式），
// 同日設計者給了版面圖、把中間點與 RSVP 眉標都放回來——這是這張回函卡的既定版型，別再拿掉
const heroDate = computed(() => props.weddingDate?.replaceAll('-', ' · ') ?? '')
// 大圖模板的眉標是「RSVP —— 2026」（設計者 09-18 的版面圖），年份取自婚禮日期
const heroYear = computed(() => props.weddingDate?.slice(0, 4) ?? '')

// === 依設定解析題目 ===
// 系統題：key → { enabled, label, description, audience }；查無視為停用
const builtinMap = computed(() => {
  const map = new Map<
    RsvpBuiltinKey,
    { enabled: boolean, label: string, description?: string, audience?: RsvpAudience }
  >()
  for (const q of props.config.questions) {
    if (q.type === 'builtin')
      map.set(q.key, { enabled: q.enabled, label: q.label, description: q.description, audience: q.audience })
  }
  return map
})
function isEnabled(key: RsvpBuiltinKey) {
  return builtinMap.value.get(key)?.enabled ?? false
}
function labelOf(key: RsvpBuiltinKey, fallback: string) {
  return builtinMap.value.get(key)?.label || fallback
}
function descriptionOf(key: RsvpBuiltinKey, fallback = '') {
  return builtinMap.value.get(key)?.description || fallback
}
// 自訂題：依 order 排序
const customQuestions = computed(() =>
  props.config.questions
    .filter((q): q is RsvpCustomQuestion => q.type !== 'builtin')
    .sort((a, b) => a.order - b.order),
)

// 三個模板各自的視覺（設計者 09-18 定案）：
//   floral  花卉水彩＝新人插畫、身邊的金星、桌面裝飾（四角眉題／便箋／拍立得）、Better Together
//   photo   大圖主視覺＝照片拼貼開場，插畫與裝飾全部收起來，版面整個讓給照片
//   minimal 極簡白底＝兩者都不要，只剩文字
// 09-18 早先那版「三個模板共用同一套桌面版型」已被推翻——那套是花卉水彩專屬的
const isFloral = computed(() => props.config.theme === 'floral')
const isPhoto = computed(() => props.config.theme === 'photo')

// 大圖模板的照片組。舊存檔只有單張 banner 時，server 端已補成「一組一張」，
// 這裡再擋一次 undefined：後台預覽的 draft 可能來自尚未重新讀取的舊設定
const banners = computed(() => props.config.banners ?? [])

// 桌機的大圖模板把 hero 文字壓在色帶中間（設計者 09-18 指定，照參考站的排法），
// 所以要知道現在是哪一組、那一組的底色是深是淺
const activeBanner = ref(0)
const activeTone = computed(() => banners.value[activeBanner.value]?.tone ?? '')

// WCAG 相對亮度。底色由新人自己挑，可能淺可能深——淺底用墨字、深底用紙字，
// 不判斷的話挑到深色就整段字看不見。0.2 是墨字 #111 撐到 4.5:1 的臨界亮度
const TONE_HEX = /^#([0-9a-f]{6})$/i
function isLightTone(hex: string) {
  const parsed = TONE_HEX.exec(hex)
  if (!parsed)
    return true
  const value = Number.parseInt(parsed[1]!, 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map(channel => channel / 255)
    .map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.2
}

const hasBanner = computed(() => isPhoto.value && banners.value.length > 0)

// hero 文字要不要壓到色帶上（桌機版型）。後台預覽卡一律不壓：
// 斷點看的是螢幕寬度、不是卡片寬度，後台螢幕一寬，448px 的預覽卡就會套到桌機版型，
// 96px 的英文大字整個爆出卡片（09-19 截圖抓到）。預覽卡固定走窄版：文字排在色帶下方
const heroOnBand = computed(() => hasBanner.value && !props.preview)

// 只有文字真的壓在色帶上才需要翻色；排在色帶下方時底是紙色，翻成紙字會整段消失
const onDarkBand = computed(() => heroOnBand.value && !isLightTone(activeTone.value))

// 大圖模板的送出列一開始收起來，賓客捲過色帶才出現（設計者 09-19）：
// 首屏整個交給照片，底下再橫一條金色按鈕會跟照片搶。其他模板沒有色帶，送出列照舊一直都在。
// 預設 false＝SSR 與 client 第一幀都當作「還停在色帶上」，兩端算出來一樣
const bannerRef = ref<{ root: HTMLElement | null } | null>(null)
const pastBanner = ref(false)
const showSubmitBar = computed(() => !hasBanner.value || pastBanner.value)
let bannerObserver: IntersectionObserver | null = null

// 盯的是色帶本身、不是外面包的那層：手機版的 hero 文字排在色帶下方，
// 連它一起算的話賓客要多捲半屏才看得到送出鈕。
// 用 watch 不用 onMounted：色帶掛著 v-if，模板切換時會重新掛載
watch(bannerRef, (instance) => {
  bannerObserver?.disconnect()
  bannerObserver = null
  const el = instance?.root
  if (!el || props.preview)
    return
  // 不支援就直接顯示：寧可多一條，也不能讓賓客找不到送出鈕
  if (!('IntersectionObserver' in window)) {
    pastBanner.value = true
    return
  }
  bannerObserver = new IntersectionObserver((entries) => {
    pastBanner.value = !entries.some(entry => entry.isIntersecting)
  })
  bannerObserver.observe(el)
})

onBeforeUnmount(() => bannerObserver?.disconnect())

// 外觀模板包裹樣式
const themeClass = computed(() => {
  switch (props.config.theme) {
    case 'floral':
      return 'rsvp-theme-floral'
    case 'photo':
      return 'rsvp-theme-photo'
    default:
      return 'rsvp-theme-minimal'
  }
})

// 整張回函卡擺成一張桌面——新人插畫當印花，左手邊一張便箋、右手邊一張拍立得，
// 四角落各一行字。素材與擺位都由設計者 09-18 指定（app/assets/img/form/ 是原始檔）。
// 09-18 設計者定案：三個外觀模板都用這一套，不分主題（原本只給花卉水彩）。
// 也因此拿掉了原本 minimal／photo 用的洋桔梗單枝印花——新人插畫取代它的位置
//
// 路徑放常數、用 :src 綁定，不寫成靜態 src="/images/..."（故事頁的 useStoryContent.ts 同做法）。
// 靜態 src 會被編成 public 資產的靜態匯入，踩到兩個 dev 期間的坑：
// 開機後才新增的檔案解析不到（整頁 500），HMR 的 ?t= 時間戳插進虛擬模組的 query 時
// 路徑會被解成 /&/images/...，在 console 報一個假的 hydration mismatch
const IMG = {
  couple: '/images/form/couple.webp',
  letter: '/images/form/letter.webp',
  polaroid: '/images/form/polaroid.webp',
  star: '/images/form/star.webp',
  babysbreath: '/images/story/babysbreath.webp',
  waxSeal: '/images/invite/wax-seal.webp',
} as const

// 新人身邊飄動的金星（素材由設計者 09-18 提供）。
// 位置是插畫框的百分比，所以插畫縮放時星星跟著走；避開兩張臉與右上角的手寫字。
// size 是 rem 值（0.5rem = 8px）；dur／delay 各自不同，星星才不會整排同步閃
const STARS = [
  { left: '37%', top: '-3%', size: '1.25rem', dur: '7s', delay: '0s' },
  { left: '45%', top: '3%', size: '0.4375rem', dur: '5.5s', delay: '2.8s' },
  { left: '26%', top: '11%', size: '0.625rem', dur: '9s', delay: '1.4s' },
  { left: '16%', top: '27%', size: '0.9375rem', dur: '6s', delay: '3.9s' },
  { left: '22%', top: '48%', size: '0.4375rem', dur: '8s', delay: '0.9s' },
  { left: '12%', top: '63%', size: '0.75rem', dur: '10.5s', delay: '2.1s' },
  { left: '49%', top: '42%', size: '0.5rem', dur: '6.5s', delay: '4.4s' },
  { left: '64%', top: '31%', size: '0.5625rem', dur: '9.5s', delay: '1.1s' },
  { left: '70%', top: '53%', size: '1.375rem', dur: '11.5s', delay: '3.1s' },
  { left: '83%', top: '41%', size: '0.625rem', dur: '7.5s', delay: '0.4s' },
  { left: '90%', top: '63%', size: '0.875rem', dur: '8.5s', delay: '2.5s' },
  { left: '57%', top: '77%', size: '0.5rem', dur: '6.8s', delay: '3.4s' },
  { left: '35%', top: '83%', size: '0.75rem', dur: '10s', delay: '1.7s' },
] as const

// 加好友連結只放行 http(s)，避免設定值被塞成 javascript: 之類的協定（frontend-security 第 2 條）
const HTTP_URL = /^https?:\/\//i
const safeLineUrl = computed(() => (HTTP_URL.test(props.lineAddUrl) ? props.lineAddUrl : ''))

// 輸入框：紙底、2px 圓角，框線與 placeholder 都用 ink-500
// ink-500 對紙 5.39:1（line 1.37、ink-300 2.41 都過不了框線要求的 3:1；placeholder 要 4.5:1）
// 填進去的值用黑體——襯線中文只載 300 字重，打字時太細，長輩不好讀
// NuxtUI 元件內的字級只能用內建 text-base/text-lg：自訂 token 會被 tailwind-merge 當成文字色吃掉
const FIELD_UI = {
  base: 'rounded-sm bg-paper px-4 py-3 font-sans text-base text-ink ring-ink-500 placeholder:text-ink-500 focus-visible:ring-gold-deep',
}
// 計數鈕：44px 圓鈕、紙底細框，停用時只降透明度不換底色
const STEPPER_CLASS = 'size-11 justify-center rounded-full bg-paper ring-ink-500 text-ink hover:bg-paper hover:ring-gold-deep hover:text-gold-deep active:bg-paper disabled:bg-paper aria-disabled:bg-paper disabled:opacity-40 aria-disabled:opacity-40 focus-visible:ring-gold-deep'
// 畫花工具鈕：選中靠 2px 墨框，不填底（跟勾記同一套語言）
const TOOL_OFF = 'rounded-sm bg-paper text-ink-700 ring-ink-500 hover:bg-paper hover:text-gold-deep hover:ring-gold-deep active:bg-paper focus-visible:ring-gold-deep'
const TOOL_ON = 'rounded-sm bg-paper font-semibold text-ink ring-2 ring-ink hover:bg-paper active:bg-paper focus-visible:ring-gold-deep'
// 祝賀語：虛線底線的文字鈕（「這句可以寫進去」），不用膠囊——統一圓角膠囊是套件感
// 底線變色走 group-hover，不用 [&>span]:hover：任意變體裡的 & 被 SSR 轉義成 &amp;，
// client 端的 class 字串還是 &，hydration 比對就整段錯位（09-18 實測報在滿天星的 src 上）
const PRESET_CLASS = 'group flex min-h-11 items-center font-serif-tc text-body text-ink-500 transition-colors duration-150 hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep'

// 數量上限（攜伴 / 兒童椅 / 接駁車）
const MAX_COUNT = 10

// === 表單狀態 ===
const guestName = ref('')
const nameError = ref('')
watch(guestName, () => {
  nameError.value = ''
})
const relationship = ref<GuestRelationship | ''>('')
const RELATION_CATEGORIES = ['家人', '朋友', '同事', '其他']
const relationCategory = ref('')
const phone = ref('')
const sideName = computed(() => {
  if (relationship.value === 'groom')
    return props.groomName
  if (relationship.value === 'bride')
    return props.brideName
  return ''
})
const attending = ref<AttendingStatus>('attending')
const diet = ref<'meat' | 'vegetarian'>('meat')
const plusOneCount = ref(0)
const childChairCount = ref(0)
const needsShuttle = ref<boolean | null>(null)
const shuttleCount = ref(1)
const invitation = ref<InvitationPreference | ''>('')
const mailingAddress = ref('')
const blessing = ref('')
const BLESSING_PRESETS = [
  '新婚快樂，永浴愛河！',
  '百年好合，永結同心！',
  '佳偶天成，白頭偕老！',
  '甜甜蜜蜜，幸福美滿！',
  '有情人終成眷屬，恭喜！',
  '早生貴子，闔家安康！',
]
function applyBlessing(phrase: string) {
  const current = blessing.value.trim()
  blessing.value = current ? `${current}\n${phrase}` : phrase
}

// 自訂題答案：key = 題目 id；單選為 string、多選為 string[]
const customAnswers = reactive<Record<string, string | string[]>>({})
function toggleMulti(id: string, value: string) {
  const cur = customAnswers[id]
  const arr = Array.isArray(cur) ? [...cur] : []
  const idx = arr.indexOf(value)
  if (idx >= 0)
    arr.splice(idx, 1)
  else arr.push(value)
  customAnswers[id] = arr
}
function isMultiChecked(id: string, value: string) {
  const cur = customAnswers[id]
  return Array.isArray(cur) && cur.includes(value)
}

// === 顯示對象（audience）===
// 題目可限定只給男方／女方親友看；後台預覽一律顯示全部題目（否則未選側別會看不到限定題）
function isVisibleFor(audience?: RsvpAudience) {
  if (props.preview)
    return true
  return !audience || audience === 'all' || relationship.value === audience
}
// 預覽用的對象標記：讓後台知道這題不是所有人都看得到
function audienceHint(audience?: RsvpAudience) {
  if (!props.preview || !audience || audience === 'all')
    return ''
  return audience === 'groom' ? '限男方親友' : '限女方親友'
}

// 是否顯示接駁車提問：該題啟用 + 符合顯示對象
// （出席條件由外層「出席細節」容器負責，不重複判斷）
const showShuttle = computed(
  () => isEnabled('shuttle') && isVisibleFor(builtinMap.value.get('shuttle')?.audience),
)

// 自訂題：符合顯示對象者才渲染與送出
const visibleCustomQuestions = computed(() =>
  customQuestions.value.filter(q => isVisibleFor(q.audience)),
)

// 側別切換後清掉已隱藏題目的答案，避免先填後隱藏仍隨提交送出
watch(relationship, () => {
  if (!showShuttle.value) {
    needsShuttle.value = null
    shuttleCount.value = 1
  }
  for (const q of customQuestions.value) {
    if (!isVisibleFor(q.audience))
      delete customAnswers[q.id]
  }
})

// === 畫小花（canvas 手繪：10 色 + 橡皮擦） ===
const PALETTE = [
  '#BE6A52',
  '#9B3A34',
  '#C49A4A',
  '#6E8B6A',
  '#7A7C5E',
  '#6E8499',
  '#A0577B',
  '#D98E73',
  '#3F6F6F',
  '#2B2420',
]
// 筆刷粗細三段（細／中／粗）；橡皮擦按比例放大，擦起來才不會比畫的還慢
const BRUSH_SIZES = [2, 4, 8]
const ERASER_RATIO = 5
const canvasRef = ref<HTMLCanvasElement | null>(null)
const brushColor = ref<string>(PALETTE[0]!)
const brushSize = ref<number>(BRUSH_SIZES[1]!)
const isEraser = ref(false)
const hasDrawing = ref(false)
let drawing = false
let ctx: CanvasRenderingContext2D | null = null

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
}
onMounted(() => {
  if (isEnabled('flower'))
    initCanvas()
})
// 花朵題由停用切回啟用時，DOM 重新掛載需重新初始化畫布
watch(() => isEnabled('flower'), (on) => {
  if (on)
    nextTick(initCanvas)
})

function selectColor(color: string) {
  brushColor.value = color
  isEraser.value = false
}
function applyBrush() {
  if (!ctx)
    return
  if (isEraser.value) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = brushSize.value * ERASER_RATIO
  }
  else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = brushSize.value
    ctx.strokeStyle = brushColor.value
  }
}
function pointerPos(e: PointerEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
function startDraw(e: PointerEvent) {
  if (!ctx)
    return
  drawing = true
  applyBrush()
  const { x, y } = pointerPos(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function moveDraw(e: PointerEvent) {
  if (!drawing || !ctx)
    return
  const { x, y } = pointerPos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  if (!isEraser.value)
    hasDrawing.value = true
}
function endDraw() {
  drawing = false
}
function clearCanvas() {
  if (!ctx || !canvasRef.value)
    return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  hasDrawing.value = false
}

// === 組裝並送出 ===
function buildCustomAnswers(): Record<string, string | string[]> | undefined {
  const result: Record<string, string | string[]> = {}
  for (const q of visibleCustomQuestions.value) {
    const ans = customAnswers[q.id]
    if (Array.isArray(ans)) {
      if (ans.length)
        result[q.id] = ans
    }
    else if (ans) {
      result[q.id] = ans
    }
  }
  return Object.keys(result).length ? result : undefined
}

// 單行欄位按 Enter 不送出表單。瀏覽器的預設行為是「表單裡有送出鈕，在任何單行欄位按 Enter 就送出」；
// 姓名是第一個欄位，手機鍵盤的「前往／完成」、注音選字的 Enter 都算——賓客打完名字表單就送出去了，
// 後面的餐點、人數、電話、地址一個都還沒填，落地的全是預設值（2026-09-19 實際發生）。
// 只擋 input：textarea 的 Enter 是換行、按鈕的 Enter 是按下去，都要留著
function blockImplicitSubmit(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement)
    event.preventDefault()
}

// 送出失敗時把錯誤訊息捲進畫面：訊息排在表單最上面，而賓客人在最底下按固定送出列，
// 不捲的話畫面上什麼都沒變，她會以為送出了
const errorRef = ref<{ $el?: HTMLElement } | null>(null)
watch(() => props.errorMessage, async (message) => {
  if (!message || props.preview)
    return
  await nextTick()
  errorRef.value?.$el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})

function onSubmit() {
  if (props.preview || props.submitting || props.submitted)
    return
  if (props.requireName && !guestName.value.trim()) {
    nameError.value = '請輸入您的姓名'
    document.getElementById('rsvp-name')?.scrollIntoView({ block: 'center' })
    return
  }
  const body: SubmitRsvpBody = {
    attending: attending.value,
    diet: diet.value,
    plusOneCount: Number(plusOneCount.value) || 0,
    childChairCount: Number(childChairCount.value) || 0,
    guestName: guestName.value || undefined,
    relationship: relationship.value || undefined,
    relationCategory: relationCategory.value || undefined,
    phone: phone.value || undefined,
    invitation: isEnabled('invitation') && invitation.value ? invitation.value : undefined,
    mailingAddress:
      invitation.value === 'physical' ? mailingAddress.value || undefined : undefined,
    blessing: isEnabled('blessing') && blessing.value ? blessing.value : undefined,
    flowerDrawing:
      isEnabled('flower') && hasDrawing.value && canvasRef.value
        ? canvasRef.value.toDataURL('image/png')
        : undefined,
    needsShuttle: showShuttle.value && needsShuttle.value !== null ? needsShuttle.value : undefined,
    shuttleCount:
      showShuttle.value && needsShuttle.value ? Number(shuttleCount.value) || 0 : undefined,
    customAnswers: buildCustomAnswers(),
  }
  emit('submit', body)
}
</script>

<template>
  <!-- relative：stepper 的 sr-only 隱藏 input 是 absolute，需以表單為定位基準，否則會撐高 document 產生幽靈捲動 -->
  <!-- 這張表單是夾在喜帖裡的回函卡（/invite 是同一個實體的另一半），所以視覺語言是
       「印在紙上的字」加「賓客手寫上去的痕跡」：印刷用襯線（font-serif-tc），填入值用黑體。
       relative 不可拿掉：stepper 的 sr-only input 是 absolute，靠這裡定位 -->
  <!-- isolate：讓下面那層裝飾可以用 -z-10 躲到所有內容後面。
       isolation 只開一個堆疊脈絡，不會像 transform／filter／contain 那樣改變 fixed 的定位基準，
       所以固定送出列與裝飾層都還是對齊視窗 -->
  <div data-testid="rsvp-submit-page" class="relative isolate flex flex-col font-serif-tc" :class="themeClass">
    <!-- 桌面裝飾。用 fixed 不用 absolute：表單欄位住在 672px 的欄內，
         裝飾要落在視窗邊緣，而這一層自己 overflow-hidden，視窗再窄也不會生出水平捲動。
         後台預覽是 448px 的卡片，fixed 會逃出卡片蓋住後台畫面，所以 preview 不渲染；
         lg 以下也不渲染（手機寬度擺不下桌面，改由表單末尾那枝滿天星收尾）。
         圖片 alt=""＝純裝飾；四角的字是真文案，不設 aria-hidden -->
    <div
      v-if="isFloral && !preview"
      class="pointer-events-none fixed inset-0 -z-10 hidden select-none overflow-hidden lg:block"
    >
      <!-- 左上：喜帖的眉題 -->
      <div class="enter enter-left absolute left-8 top-10 text-overline leading-loose text-ink-500">
        <p>A<br>DAY<br>WITH<br>YOU</p>
        <span class="my-5 block h-px w-6 bg-line" />
        <p>SAME<br>STORY<br>BRIGHTER<br>TOGETHER</p>
      </div>

      <!-- 左側：貼著膠帶的便箋與洋桔梗 -->
      <img
        :src="IMG.letter"
        width="900"
        height="600"
        alt=""
        decoding="async"
        class="enter enter-left absolute -left-4 top-72 w-[26vw] max-w-[360px] -rotate-6"
      >

      <!-- 右側：綁緞帶的拍立得。設計者 09-18 指定放大並讓緞帶出血——
           負的 right 把它推出視窗右緣，緞帶尾端被切掉是刻意的 -->
      <img
        :src="IMG.polaroid"
        width="760"
        height="790"
        alt=""
        decoding="async"
        class="enter enter-right absolute -right-10 top-48 w-[26vw] max-w-[420px] rotate-3 [--enter-step:1]"
      >

      <!-- 左下的「A More Beautiful Tomorrow」與右下的「THANK YOU FOR BEING PART OF OUR STORY」
           由設計者 09-18 決定不放：右下那段會壓到拍立得的緞帶，左右下角留白就好 -->
    </div>

    <!-- 照片拼貼：只有大圖主視覺模板才出現，而且這時新人插畫與桌面裝飾都收起來，
         整個開場交給照片。另外兩個模板即使存了照片也不顯示 -->
    <!-- 大圖模板的 hero 壓在色帶中間（照片分左右兩叢、中間讓出空白），
         所以外面包一層 relative 當定位基準。xl（1280）以下版面塞不下，hero 回到色帶下方。
         原本從 lg（1024）就開始壓：1024 時照片中間的縫只有 163px，姓名、日期、邀請語整排壓到照片上、
         墨字疊在深色沙灘上讀不到（09-19 截圖才發現），所以門檻往上提一級 -->
    <div :class="hasBanner ? 'relative' : ''">
      <div v-if="hasBanner" class="relative">
        <RsvpBannerCollage
          ref="bannerRef"
          v-model:active="activeBanner"
          data-testid="vibe-rsvp-banner"
          :banners="banners"
          :preview="preview"
        />
        <!-- 窄版標題排在 banner 內的照片上方，頂端讓開選單按鈕。 -->
        <div
          v-if="heroOnBand"
          class="pointer-events-none absolute inset-x-0 top-[var(--bleed-top,0px)] z-10 flex h-48 flex-col items-center justify-center text-center xl:hidden"
          :class="onDarkBand ? 'text-paper' : 'text-ink-700'"
        >
          <p class="enter font-display text-overline [--enter-step:1]">
            RSVP<template v-if="heroYear">
              <span aria-hidden="true" class="mx-3 inline-block w-6 border-t border-current align-middle" />{{ heroYear }}
            </template>
          </p>
          <div aria-hidden="true" class="band-mark enter flex flex-col items-center text-[clamp(2.25rem,12vw,4rem)] [--enter-step:2]">
            <StoryFoilMark text="Our Day," variant="paper" />
            <StoryFoilMark text="With You." variant="paper" class="-mt-[0.43em]" />
          </div>
        </div>
      </div>

      <!-- 卡片標頭：印花 → RSVP → 新人 → 日期與場地 → 金短線 → 邀請語。
         這是「印在回函卡上」的那幾行，所以置中、正式。版型依設計者 09-18 給的版面圖：
         姓名原本是 64px 的 font-display——Cormorant 沒有中文字，中文一直靜默掉回系統字體，
         改成 32／44px 的襯線中文，中間的連字符號才是 Cormorant（它只有這一個字要排）。
         金色只用 gold-deep：gold 對奶油底只有 2.43:1，連大字的 3:1 都過不了 -->
      <div
        data-testid="vibe-rsvp-hero"
        class="relative pb-1 pt-4 text-center"
        :class="heroOnBand
          // pointer-events-none 不可省：這層疊在色帶中間，會攔下滑鼠事件。
          // 滑鼠從左半穿過它到右半時，色帶收到的是「離開了」，跨越中線的判斷就被重置、整組永遠不換
          ? 'xl:pointer-events-none xl:absolute xl:inset-0 xl:z-10 xl:mx-auto xl:flex xl:max-w-3xl xl:flex-col xl:justify-center xl:py-0'
          : ''"
      >
        <!-- 插畫與「Better Together」包在同一層：手寫字用百分比定位，才會跟著插畫縮放
           一起移動（設計者 09-18 指定要靠在新娘頭部的右上方）。
           寬高都留給內容決定（w-auto），只給上限：寬度若寫死成 w-full，
           瀏覽器碰到 max-height 會只壓高度、不收寬度，人物就被壓扁。
           42vh 的高度上限只在矮視窗（約 810px 以下）才咬到，所以字與插畫幾乎不會錯位 -->
        <!-- 往右推 8%：插畫裡新人站在偏左的位置（右邊是金線與留白），
           整張置中時人物看起來偏左。用 transform 不用 margin，才不動版面配置。
           sm 以下不推——手機的插畫剛好塞滿欄寬，推出去會生出水平捲動 -->
        <div v-if="isFloral" class="relative mx-auto w-full max-w-[32rem] sm:translate-x-[8%]">
          <img
            :src="IMG.couple"
            width="1200"
            height="800"
            alt=""
            aria-hidden="true"
            decoding="async"
            class="enter pointer-events-none mx-auto block max-h-[42vh] w-auto max-w-full select-none"
          >
          <!-- 金星：外層跟著插畫一起進場，進場結束後各自飄動（單獨一顆星沒辦法同時跑兩段動畫） -->
          <div class="enter pointer-events-none absolute inset-0 select-none" aria-hidden="true">
            <img
              v-for="star in STARS"
              :key="star.left + star.top"
              :src="IMG.star"
              width="200"
              height="181"
              alt=""
              decoding="async"
              class="star absolute h-auto"
              :style="{ 'left': star.left, 'top': star.top, 'width': star.size, '--dur': star.dur, '--delay': star.delay }"
            >
          </div>
          <!-- 手寫體是 ChenYuluoyan（故事頁與喜帖頁的手寫字都是它），公開子集已含 ASCII。
             進場排最後一個，像最後補上去的那一筆 -->
          <p
            v-if="!preview"
            class="enter absolute left-[55%] top-[-5%] hidden -rotate-12 font-hand text-h3 leading-snug text-ink-500 lg:block [--enter-step:6]"
          >
            Better<br>Together ♡
          </p>
        </div>

        <!-- 大圖模板壓在色帶上時，金色一律換掉：gold-deep 對這些中明度底色只有 1.7:1，
           連大字的 3:1 都過不了。深色底再整組翻成紙色（onDarkBand） -->
        <p
          class="enter mt-2 font-display text-overline [--enter-step:1]"
          :class="[
            heroOnBand ? 'hidden xl:block' : '',
            isPhoto ? (onDarkBand ? 'text-ink-700 xl:text-paper' : 'text-ink-700') : 'text-gold-deep',
          ]"
        >
          <template v-if="isPhoto && heroYear">
            RSVP<span aria-hidden="true" class="mx-3 inline-block w-6 border-t border-current align-middle" />{{ heroYear }}
          </template>
          <template v-else>
            RSVP
          </template>
        </p>

        <!-- 英文大字：設計者 09-18 的版面圖指定它當主視覺，中文姓名退成第二層。
             桌機壓在色帶中央；手機標題由上方 banner 內的獨立區塊呈現。
             紙色壓在中明度底色上約 2:1，過不了 3:1；這一行是氣氛字，
             姓名／日期／場地／邀請語那幾行才是資訊，它們走墨色、對比是夠的。

             字樣沿用故事頁首屏「In Your Love」的金箔流光（設計者 09-19 指定），用它的紙白版：
             金箔版的底是 gold-deep，壓在這種中明度的底色上只有 1.7:1，字會糊掉。
             StoryFoilMark 一次只排一行，所以兩行各放一個；字級照舊由外層的 text-display-* 給。
             它的框比字寬很多（8.3em），items-center 讓超出的部分左右對稱溢出、字才會置中。
             第二行往上收 0.43em：每個框高 1.33em，收完兩行基線相距 0.9em，跟原本的行距一樣。
             整組 aria-hidden：元件自己帶 role=img 與名稱，不蓋掉的話讀屏會唸兩次氣氛字 -->
        <div
          v-if="heroOnBand"
          aria-hidden="true"
          class="band-mark enter -mt-[0.1em] hidden flex-col items-center text-display-xl xl:flex 2xl:text-display-xxl [--enter-step:2]"
        >
          <StoryFoilMark text="Our Day," variant="paper" />
          <StoryFoilMark text="With You." variant="paper" class="-mt-[0.43em]" />
        </div>
        <h1
          class="enter mt-3 text-balance text-h2 font-semibold tracking-wider sm:text-h1 [--enter-step:3]"
          :class="[
            heroOnBand ? 'xl:mt-6 xl:text-h2' : '',
            onDarkBand ? 'text-ink xl:text-paper' : 'text-ink',
          ]"
        >
          {{ groomName }}<span
            class="mx-3 font-display font-medium"
            :class="isPhoto ? 'text-ink-700 xl:text-inherit' : 'text-gold-deep'"
          >&amp;</span>{{ brideName }}
        </h1>
        <p
          v-if="heroDate || venue"
          class="enter mt-4 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 [--enter-step:4]"
          :class="[
            heroOnBand ? 'xl:mt-3' : '',
            onDarkBand ? 'text-ink-700 xl:text-paper' : 'text-ink-700',
          ]"
        >
          <span v-if="heroDate" class="font-display text-body-l tracking-widest">{{ heroDate }}</span>
          <span v-if="venue" class="text-body">{{ venue }}</span>
        </p>
        <!-- 金短線：版面圖裡的大圖模板沒有這條，英文大字已經扛住分隔的角色 -->
        <span
          v-if="!hasBanner"
          class="enter mx-auto mt-6 block h-px w-10 bg-gold [--enter-step:5]"
        />
        <p
          class="enter mx-auto mt-6 max-w-md text-body leading-relaxed sm:text-body-l [--enter-step:6]"
          :class="onDarkBand ? 'text-ink-700 xl:text-paper' : 'text-ink-700'"
        >
          很開心能與您分享這特別的一天<br>誠摯邀請您，請撥空填寫以下出席資訊
        </p>
      </div>
    </div>

    <UAlert
      v-if="errorMessage && !preview"
      ref="errorRef"
      data-testid="rsvp-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="errorMessage"
      class="mt-6 rounded-sm"
      :ui="{ title: 'text-base font-semibold' }"
    />

    <!-- 送出成功：蓋上封蠟。賓客在喜帖頁拆開的就是這一枚金蠟印，現在換他封回來。
         全表單唯一一段編排動效（creative-direction §4：一頁最多一個主動效），
         只動 transform 與 opacity，reduced-motion 由 main.css 全域守門接手。
         role="status" 與「回覆已送出」文字是主 spec 的回饋偵測錨點，不可改 -->
    <div
      v-if="submitted && !preview"
      data-testid="rsvp-submit-success"
      role="status"
      class="flex flex-col items-center px-6 pb-10 pt-6 text-center"
    >
      <img
        :src="IMG.waxSeal"
        alt=""
        aria-hidden="true"
        width="120"
        height="120"
        decoding="async"
        class="seal size-20"
      >
      <p class="mt-6 text-h3 font-semibold text-ink">
        回覆已送出
      </p>
      <p class="mt-3 max-w-sm text-body text-ink-500">
        有任何變動，回到這一頁重新送出就好。
      </p>
    </div>

    <!-- pb-36：預留固定送出列的高度，最後一題不會被壓在底下（preview 無送出列，不需留白） -->
    <!-- xl:mt-24：大圖模板的照片會跨出色帶下緣一截，表單要往下讓開，第一個欄位才不會被壓到 -->
    <form
      v-else
      class="mt-8 space-y-10"
      :class="[preview ? '' : 'pb-36', heroOnBand ? 'xl:mt-24' : '']"
      @submit.prevent="onSubmit"
      @keydown.enter="blockImplicitSubmit"
    >
      <!-- 基本資料（身分識別，常駐） -->
      <section class="space-y-5">
        <div>
          <label for="rsvp-name" class="mb-2 block text-body-l font-semibold text-ink">
            請問您的大名？<span v-if="requireName" class="ml-1 text-body font-normal text-error">＊必填</span>
          </label>
          <UInput
            id="rsvp-name"
            v-model="guestName"
            data-testid="rsvp-guest-name"
            placeholder="您的姓名"
            size="xl"
            class="w-full"
            :ui="FIELD_UI"
            :aria-required="requireName || undefined"
          />
          <p v-if="nameError" data-testid="rsvp-name-error" class="mt-2 text-body text-error">
            {{ nameError }}
          </p>
        </div>

        <!-- 與新人的關係 -->
        <div data-testid="vibe-rsvp-relationship">
          <p class="mb-3 text-body-l font-semibold text-ink">
            與新人的關係？
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <RsvpChoice
              :selected="relationship === 'groom'"
              @click="relationship = 'groom'"
            >
              新郎{{ groomName }}的親友
            </RsvpChoice>
            <RsvpChoice
              :selected="relationship === 'bride'"
              @click="relationship = 'bride'"
            >
              新娘{{ brideName }}的親友
            </RsvpChoice>
          </div>

          <div v-if="relationship" data-testid="vibe-rsvp-relation-category" class="mt-3">
            <p class="mb-2 text-body text-ink-500">
              您是{{ sideName }}的…
            </p>
            <div class="flex flex-wrap gap-x-6 gap-y-1">
              <RsvpChoice
                v-for="cat in RELATION_CATEGORIES"
                :key="cat"
                :selected="relationCategory === cat"
                @click="relationCategory = cat"
              >
                {{ cat }}
              </RsvpChoice>
            </div>
          </div>
        </div>

        <div>
          <label for="rsvp-phone" class="mb-2 block text-body-l font-semibold text-ink">
            您的聯繫電話？
          </label>
          <UInput
            id="rsvp-phone"
            v-model="phone"
            data-testid="rsvp-phone"
            type="tel"
            inputmode="tel"
            placeholder="0912-345-678"
            size="xl"
            class="w-full"
            :ui="FIELD_UI"
          />
        </div>
      </section>

      <!-- 是否出席 -->
      <div v-if="isEnabled('attending')" data-testid="vibe-rsvp-attend-toggle">
        <p class="mb-3 text-body-l font-semibold text-ink">
          {{ labelOf('attending', '是否會出席婚禮？') }}
        </p>
        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <RsvpChoice
            :selected="attending === 'attending'"
            aria-label="出席"
            @click="attending = 'attending'"
          >
            當然！期待見到你們！
          </RsvpChoice>
          <RsvpChoice
            :selected="attending === 'declined'"
            aria-label="不出席"
            @click="attending = 'declined'"
          >
            無法出席，但還是祝福你們
          </RsvpChoice>
        </div>
      </div>

      <!-- 出席細節：餐點 / 攜伴 / 兒童椅 / 接駁（僅出席時填寫） -->
      <template v-if="attending === 'attending'">
        <!-- 餐點 -->
        <div v-if="isEnabled('diet')" data-testid="vibe-rsvp-diet-segment">
          <p class="mb-3 text-body-l font-semibold text-ink">
            {{ labelOf('diet', '餐點選擇') }}
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <RsvpChoice
              :selected="diet === 'meat'"
              @click="diet = 'meat'"
            >
              葷食
            </RsvpChoice>
            <RsvpChoice
              :selected="diet === 'vegetarian'"
              @click="diet = 'vegetarian'"
            >
              素食
            </RsvpChoice>
          </div>
        </div>

        <!-- 攜伴人數 -->
        <div v-if="isEnabled('partySize')" class="border-y border-line py-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <span class="text-body-l font-semibold text-ink">{{ labelOf('partySize', '攜伴人數') }}</span>
              <p class="mt-0.5 text-body text-ink-500">
                不含您本人（兒童椅嬰兒請填下方欄位）
              </p>
            </div>
            <div data-testid="vibe-rsvp-plusone-stepper" class="flex items-center gap-4">
              <UButton
                icon="i-heroicons-minus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="plusOneCount <= 0"
                aria-label="少一位"
                @click="plusOneCount = Math.max(0, Number(plusOneCount) - 1)"
              />
              <output
                data-testid="rsvp-plus-one-display"
                class="w-14 text-center font-sans text-h2 font-semibold tabular-nums leading-none text-ink"
              >{{ plusOneCount }}</output>
              <input
                v-model.number="plusOneCount"
                data-testid="rsvp-plus-one"
                type="number"
                aria-label="攜伴人數"
                class="sr-only"
                tabindex="-1"
              >
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="plusOneCount >= MAX_COUNT"
                aria-label="多一位"
                @click="plusOneCount = Math.min(MAX_COUNT, Number(plusOneCount) + 1)"
              />
            </div>
          </div>
        </div>

        <!-- 兒童椅數 -->
        <div v-if="isEnabled('childChair')" class="border-b border-line py-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <span class="text-body-l font-semibold text-ink">{{ labelOf('childChair', '兒童椅數') }}</span>
              <p class="mt-0.5 text-body text-ink-500">
                需要兒童椅、不吃大人菜的小嬰兒；不需要請填 0
              </p>
            </div>
            <div data-testid="vibe-rsvp-childchair-stepper" class="flex items-center gap-4">
              <UButton
                icon="i-heroicons-minus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="childChairCount <= 0"
                aria-label="少一張"
                @click="childChairCount = Math.max(0, Number(childChairCount) - 1)"
              />
              <output
                data-testid="rsvp-child-seat-display"
                class="w-14 text-center font-sans text-h2 font-semibold tabular-nums leading-none text-ink"
              >{{ childChairCount }}</output>
              <input
                v-model.number="childChairCount"
                data-testid="rsvp-child-seat"
                type="number"
                aria-label="兒童椅數"
                class="sr-only"
                tabindex="-1"
              >
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="childChairCount >= MAX_COUNT"
                aria-label="多一張"
                @click="childChairCount = Math.min(MAX_COUNT, Number(childChairCount) + 1)"
              />
            </div>
          </div>
        </div>

        <!-- 接駁車（顯示對象由後台設定，預設限男方親友） -->
        <div v-if="showShuttle" data-testid="vibe-rsvp-shuttle">
          <p class="mb-1 text-body-l font-semibold text-ink">
            {{ labelOf('shuttle', '高雄地區接駁車') }}
            <span
              v-if="audienceHint(builtinMap.get('shuttle')?.audience)"
              class="ml-2 text-caption font-normal normal-case text-ink-300"
            >
              {{ audienceHint(builtinMap.get('shuttle')?.audience) }}
            </span>
          </p>
          <p class="mb-3 text-body text-ink-500">
            {{ descriptionOf('shuttle', '我們為親友安排了接駁車，是否需要搭乘？') }}
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <RsvpChoice
              :selected="needsShuttle === true"
              @click="needsShuttle = true"
            >
              需要搭乘
            </RsvpChoice>
            <RsvpChoice
              :selected="needsShuttle === false"
              @click="needsShuttle = false"
            >
              不需要
            </RsvpChoice>
          </div>

          <div v-if="needsShuttle" class="mt-4 flex items-center justify-between gap-4 rounded-sm border border-line bg-paper px-4 py-4">
            <span class="text-body-l font-semibold text-ink">搭車人數</span>
            <div data-testid="vibe-rsvp-shuttle-stepper" class="flex items-center gap-4">
              <UButton
                icon="i-heroicons-minus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="shuttleCount <= 0"
                aria-label="少一位"
                @click="shuttleCount = Math.max(0, Number(shuttleCount) - 1)"
              />
              <output
                data-testid="rsvp-shuttle-count"
                class="w-14 text-center font-sans text-h2 font-semibold tabular-nums leading-none text-ink"
              >{{ shuttleCount }}</output>
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="outline"
                size="xl"
                :class="STEPPER_CLASS"
                :disabled="shuttleCount >= MAX_COUNT"
                aria-label="多一位"
                @click="shuttleCount = Math.min(MAX_COUNT, Number(shuttleCount) + 1)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 是否需要喜帖 -->
      <div v-if="isEnabled('invitation')" data-testid="vibe-rsvp-invitation">
        <p class="mb-3 text-body-l font-semibold text-ink">
          {{ labelOf('invitation', '是否需要喜帖？') }}
        </p>
        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <RsvpChoice
            :selected="invitation === 'e-card'"
            @click="invitation = 'e-card'"
          >
            需要！請寄電子喜帖
          </RsvpChoice>
          <RsvpChoice
            :selected="invitation === 'physical'"
            @click="invitation = 'physical'"
          >
            需要！請寄實體喜帖
          </RsvpChoice>
          <RsvpChoice
            :selected="invitation === 'none'"
            @click="invitation = 'none'"
          >
            不需要，我已記下婚禮資訊
          </RsvpChoice>
        </div>

        <div
          v-if="invitation === 'e-card'"
          class="mt-4 rounded-sm border border-line bg-paper p-4 text-center"
        >
          <p class="text-body text-ink-500">
            電子喜帖將透過 LINE 寄送，請加入新人的 LINE 好友
          </p>
        </div>

        <div v-if="invitation === 'physical'" class="mt-4">
          <label for="rsvp-address" class="mb-2 block text-body text-ink-700">
            紙本喜帖寄送地址（請輸入 3+2 郵遞區號與地址）
          </label>
          <UTextarea
            id="rsvp-address"
            v-model="mailingAddress"
            data-testid="rsvp-address"
            :rows="3"
            placeholder="例：100-01 臺北市中正區○○路○段○號"
            size="xl"
            class="w-full"
            :ui="FIELD_UI"
          />
        </div>
      </div>

      <!-- 自訂題（依顯示對象過濾） -->
      <div
        v-for="q in visibleCustomQuestions"
        :key="q.id"
        :data-testid="`vibe-rsvp-custom-${q.id}`"
      >
        <!-- 單行文字 -->
        <template v-if="q.type === 'text'">
          <label
            :for="`rsvp-custom-${q.id}`"
            class="block text-body-l font-semibold text-ink"
            :class="q.description ? 'mb-1' : 'mb-2'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 text-caption font-normal normal-case text-ink-300">
              {{ audienceHint(q.audience) }}
            </span>
          </label>
          <p v-if="q.description" class="mb-2 text-body text-ink-500">
            {{ q.description }}
          </p>
          <UInput
            :id="`rsvp-custom-${q.id}`"
            v-model="(customAnswers[q.id] as string)"
            size="xl"
            class="w-full"
            :placeholder="q.label"
            :ui="FIELD_UI"
          />
        </template>

        <!-- 單選 -->
        <template v-else-if="q.type === 'single'">
          <p
            class="text-body-l font-semibold text-ink"
            :class="q.description ? 'mb-1' : 'mb-3'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 text-caption font-normal normal-case text-ink-300">
              {{ audienceHint(q.audience) }}
            </span>
          </p>
          <p v-if="q.description" class="mb-3 text-body text-ink-500">
            {{ q.description }}
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <RsvpChoice
              v-for="opt in q.options ?? []"
              :key="opt.value"
              :selected="customAnswers[q.id] === opt.value"
              @click="customAnswers[q.id] = opt.value"
            >
              {{ opt.label }}
            </RsvpChoice>
          </div>
        </template>

        <!-- 多選 -->
        <template v-else>
          <p
            class="text-body-l font-semibold text-ink"
            :class="q.description ? 'mb-1' : 'mb-3'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 text-caption font-normal normal-case text-ink-300">
              {{ audienceHint(q.audience) }}
            </span>
          </p>
          <p v-if="q.description" class="mb-3 text-body text-ink-500">
            {{ q.description }}
          </p>
          <div class="flex flex-wrap gap-x-6 gap-y-1">
            <RsvpChoice
              v-for="opt in q.options ?? []"
              :key="opt.value"
              :selected="isMultiChecked(q.id, opt.value)"
              @click="toggleMulti(q.id, opt.value)"
            >
              {{ opt.label }}
            </RsvpChoice>
          </div>
        </template>
      </div>

      <!-- 加入新人 LINE（常駐；預覽或未設定連結則不顯示） -->
      <!-- 一個畫面只留一顆實心鈕給送出（creative-direction §3），加好友改成底線文字連結。
           不掛「→」——箭頭附在連結後面是任何主題都能貼的模板樣式 -->
      <div
        v-if="safeLineUrl && !preview"
        data-testid="vibe-rsvp-line"
        class="rounded-sm border border-line bg-paper p-5 text-center"
      >
        <p class="text-body text-ink-500">
          想收到婚禮即時通知與電子喜帖嗎？歡迎加入新人的 LINE！
        </p>
        <NuxtLink
          :to="safeLineUrl"
          external
          target="_blank"
          class="mt-4 inline-block border-b border-gold pb-1 font-serif-tc text-body-l tracking-widest text-ink transition-colors duration-250 hover:border-gold-deep hover:text-gold-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-deep"
        >
          加入新人的 LINE
        </NuxtLink>
      </div>

      <!-- 祝福留言 -->
      <div v-if="isEnabled('blessing')">
        <label for="rsvp-blessing" class="mb-2 block text-body-l font-semibold text-ink">
          {{ labelOf('blessing', '想給新人的祝福') }}
        </label>
        <!-- 祝賀語：虛線底線＝「這句可以寫進去」。type=button 不可省，否則按下去會送出表單 -->
        <div data-testid="vibe-rsvp-blessing-presets" class="mb-4 flex flex-wrap gap-x-6 gap-y-2">
          <button
            v-for="phrase in BLESSING_PRESETS"
            :key="phrase"
            type="button"
            :class="PRESET_CLASS"
            @click="applyBlessing(phrase)"
          >
            <span class="border-b border-dashed border-ink-300 pb-0.5 transition-colors duration-150 group-hover:border-gold-deep">{{ phrase }}</span>
          </button>
        </div>
        <UTextarea
          id="rsvp-blessing"
          v-model="blessing"
          data-testid="rsvp-blessing"
          :rows="4"
          placeholder="寫下您想對新人說的話，或點選上方祝賀語帶入…"
          size="xl"
          class="w-full"
          :ui="FIELD_UI"
        />
      </div>

      <!-- 畫一朵小花 -->
      <div v-if="isEnabled('flower')" data-testid="vibe-rsvp-flower">
        <p class="mb-3 text-body-l font-semibold text-ink">
          {{ labelOf('flower', '畫一朵小花給新人們') }}
        </p>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <button
            v-for="color in PALETTE"
            :key="color"
            type="button"
            class="size-7 rounded-full border transition-colors"
            :class="
              !isEraser && brushColor === color
                ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-cream'
                : 'border-ink-500'
            "
            :style="{ backgroundColor: color }"
            :aria-label="`選擇顏色 ${color}`"
            :aria-pressed="!isEraser && brushColor === color"
            @click="selectColor(color)"
          />

          <!-- 筆刷粗細：圓點大小直接對應筆畫，不需文字說明 -->
          <button
            v-for="size in BRUSH_SIZES"
            :key="size"
            type="button"
            :data-testid="`rsvp-flower-size-${size}`"
            class="flex size-7 items-center justify-center rounded-sm border transition-colors"
            :class="brushSize === size ? 'border-ink ring-1 ring-inset ring-ink' : 'border-ink-500'"
            :aria-label="`筆刷粗細 ${size}`"
            :aria-pressed="brushSize === size"
            @click="brushSize = size"
          >
            <span class="rounded-full bg-ink" :style="{ width: `${size + 2}px`, height: `${size + 2}px` }" />
          </button>

          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="md"
            icon="i-heroicons-backspace"
            data-testid="rsvp-flower-eraser"
            :aria-pressed="isEraser"
            :class="isEraser ? TOOL_ON : TOOL_OFF"
            @click="isEraser = true"
          >
            橡皮擦
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="md"
            icon="i-heroicons-trash"
            data-testid="rsvp-flower-clear"
            :disabled="!hasDrawing"
            class="rounded-sm text-ink-500 hover:bg-transparent hover:text-gold-deep active:bg-transparent focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-deep"
            @click="clearCanvas"
          >
            清除
          </UButton>
        </div>

        <canvas
          ref="canvasRef"
          data-testid="rsvp-flower-canvas"
          class="h-88 w-full touch-none rounded-sm border border-dashed border-ink-300 bg-paper"
          @pointerdown="startDraw"
          @pointermove="moveDraw"
          @pointerup="endDraw"
          @pointerleave="endDraw"
        />
        <p class="mt-2 text-center text-body text-ink-500">
          用手指或滑鼠在上方畫畫吧（可留白）
        </p>
      </div>

      <!-- 手機版收尾：一枝滿天星（故事頁拼貼在用的素材），純裝飾。花卉水彩專屬。
           lg 以上改由左右兩側的桌面裝飾收尾，這枝就收起來，不要四樣花同時出現 -->
      <img
        v-if="isFloral"
        :src="IMG.babysbreath"
        alt=""
        aria-hidden="true"
        width="331"
        height="369"
        loading="lazy"
        decoding="async"
        class="pointer-events-none mx-auto h-24 w-auto select-none lg:hidden"
      >

      <!-- 送出列：固定於視窗底部（表單有 8 題，捲到底才找得到送出鈕對長輩不友善）
           用 fixed 而非 sticky——sticky 的寬度會被 layout 的 max-w-2xl 綁住，
           桌機上色帶只有表單那麼寬會像一條浮在中間的帶子；fixed 讓底色滿寬，
           內層再收回同樣的 max-w-2xl，按鈕仍與表單對齊 -->
      <!-- 漸層底色跟頁面同為 cream（兩個賓客頁都是 bg-cream，用 paper 會浮出一條色帶）；
           外層 pointer-events-none 讓透明區不攔截底下的點擊，內層再開回來。
           金底白字（設計者 09-18 版面圖）：gold-deep 對紙 3.72:1，
           所以字級必須是 20px／600 以上才算 WCAG 的大字（門檻 3:1），text-lg 18px 不算。
           hover 只能往深走（secondary-700 對紙 7.7:1），往淺走白字會掉到 2.4:1。
           箭頭包 aria-hidden：主 spec 用 /送出|提交|確定/ 抓這顆鈕，可及名稱要維持乾淨 -->
      <!-- 大圖模板在色帶還看得到的時候整條收起來（showSubmitBar）。
           收起來用 inert 不用 v-if／invisible：進出場只動 opacity 與 translate，元素要留在 DOM 裡才有過場；
           inert 同時擋掉滑鼠與 Tab，不會有人聚焦到一顆看不見的按鈕。
           （09-19 起在欄位按 Enter 不再送出表單，見 blockImplicitSubmit——送出只剩按這顆鈕一條路） -->
      <div
        v-if="!preview"
        :inert="!showSubmitBar"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-cream from-60% to-transparent pb-4 pt-8 transition-[opacity,translate] duration-250 ease-standard"
        :class="showSubmitBar ? '' : 'translate-y-4 opacity-0'"
      >
        <div class="pointer-events-auto mx-auto max-w-2xl px-4">
          <UButton
            type="submit"
            data-testid="rsvp-submit"
            color="primary"
            size="xl"
            block
            :loading="submitting"
            class="min-h-13 rounded-sm bg-gold-deep text-xl font-semibold tracking-widest text-paper hover:bg-secondary-700 active:bg-secondary-700 disabled:bg-gold-deep aria-disabled:bg-gold-deep focus-visible:outline-ink"
          >
            送出回覆<span aria-hidden="true" class="ml-3 font-sans">→</span>
          </UButton>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* 09-18 設計者定案：三個外觀模板一律用同一套桌面版型，
   現在唯一的差別是 photo 模板會多一張 banner。
   已移除的東西與理由：minimal／floral 的洋桔梗印花與花束（改用新人插畫）、
   floral hero 的淡金暈（插畫自帶光暈，兩層疊起來變一團霧）、
   floral 兩角的內嵌線稿小花與 photo hero 的三段漸層（線稿跟故事頁與喜帖頁的
   真照片語言不合，大面積漸層也不是這套風格的分層方式——分層靠留白與細線）。
   根節點的 rsvp-theme-* 先留著，將來要做主題差異時掛這裡 */

/* 色帶上的金箔字：沿用故事頁的紙白版，但暖光收淡。
   那一版是疊在深色照片上用的，光再濃字都還是亮的；這裡的底是中明度的色帶，
   紙白對它本來就只有 1.9:1，光斑照原本的濃度整行會掉成米色、跟底色糊在一起（實測 1.4:1）。
   選擇器多帶一層 .mark：元件自己的 .is-paper .orb-* 同樣是三個 class，不多一層會變成比載入順序 */
.band-mark :deep(.mark .orb-a) {
  opacity: 0.32;
}

.band-mark :deep(.mark .orb-c) {
  opacity: 0.2;
}

/* hero 進場：這一頁唯一的一段編排動效（creative-direction §4「一頁最多一個主動效」）。
   一套語彙從頭用到尾——桌上的東西從各自的邊緣就位，卡片上的字依序浮上來——所以算一個。
   遵守 §4 三條硬原則：
   1. prefers-reduced-motion 由 main.css 全域守門接手（delay 與 duration 都歸零），
      配 both 讓元素直接停在終點，所以關掉動態的人一開頁就看到最終排版
   2. 只動 opacity 與 translate。用獨立的 translate 屬性、不用 transform：
      便箋與拍立得的傾斜是 Tailwind 的 rotate，兩者互不干擾，動畫結束也不會把傾斜抹掉
   3. duration 取內建的 400ms、easing 取 @theme 的 ease-emphasized
   遞延用 calc() 讀 --enter-step（class 是 [--enter-step:N]），step 80ms、
   最後一個 480ms，全程 880ms 內結束——§4 要求首屏文字 1 秒內就位。
   基準樣式刻意不設 opacity: 0：萬一動畫沒跑，元素本來就是可見的 */
.enter {
  animation: enter-rise 400ms var(--ease-emphasized) both;
  animation-delay: calc(var(--enter-step, 0) * 80ms);
}
@keyframes enter-rise {
  from {
    opacity: 0;
    translate: 0 12px;
  }

  to {
    opacity: 1;
    translate: none;
  }
}

/* 桌上的兩件東西從自己那一側飄進來（宣告在 .enter 之後才蓋得掉 animation-name） */
.enter-left {
  animation-name: enter-from-left;
}
.enter-right {
  animation-name: enter-from-right;
}
@keyframes enter-from-left {
  from {
    opacity: 0;
    translate: -24px 0;
  }

  to {
    opacity: 1;
    translate: none;
  }
}
@keyframes enter-from-right {
  from {
    opacity: 0;
    translate: 24px 0;
  }

  to {
    opacity: 1;
    translate: none;
  }
}

/* 新人身邊的金星：一直來回飄的氛圍動效，幅度小、不搶注意力。
   秒級的循環動畫沿用公開頁既有寫法（InviteObject.vue、GalleryPetals.vue 都是
   var(--dur) + ease token + infinite）——§4 的 150/250/400 三檔是給轉場與進場用的。
   只動 opacity、translate、scale；alternate 讓它自己來回，不需要中間影格。
   prefers-reduced-motion 下全域守門把次數壓成 1、時間歸零，
   這裡刻意不寫 fill：動畫結束後回到基準樣式，也就是全亮、無位移的靜止星星 */
.star {
  animation: star-float var(--dur, 7s) var(--ease-standard) var(--delay, 0s) infinite alternate;
}
@keyframes star-float {
  from {
    opacity: 0.45;
    translate: 0 4px;
    scale: 0.9;
  }

  to {
    opacity: 1;
    translate: 0 -4px;
    scale: 1.08;
  }
}

/* 送出成功的封蠟：一次性落印，像把信封封回去。只動 transform 與 opacity
   （creative-direction §4）；prefers-reduced-motion 由 main.css 全域守門接手 */
.seal {
  animation: seal-stamp 400ms var(--ease-emphasized) both;
}
@keyframes seal-stamp {
  from {
    opacity: 0;
    transform: scale(1.5) rotate(-10deg);
  }

  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}
</style>
