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

// 日期以間隔點呈現（2026-12-01 → 2026 · 12 · 01），對齊設計稿的排版語彙
const heroDate = computed(() => props.weddingDate?.replaceAll('-', ' · ') ?? '')

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
  <div data-testid="rsvp-submit-page" class="relative flex flex-col" :class="themeClass">
    <!-- Banner（已設定時顯示，高度受限不佔表單主體） -->
    <div
      v-if="config.banner"
      data-testid="vibe-rsvp-banner"
      class="aspect-[5/2] w-full overflow-hidden rounded-lg"
    >
      <img :src="config.banner" alt="婚禮主視覺" class="size-full object-cover">
    </div>

    <!-- Hero（結構對齊設計稿：眉標 → 大名 → 日期場地 → 滿版細線 → RSVP 眉標 → 邀請語） -->
    <div data-testid="vibe-rsvp-hero" class="relative overflow-hidden py-6 text-center">
      <!-- 手繪花草：純裝飾，壓低透明度當背景層，不擋文字也不可點；螢幕閱讀器忽略 -->
      <img
        src="~/assets/svg/leaf1.svg"
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute -left-6 -top-4 w-24 -rotate-12 opacity-20 select-none"
      >
      <img
        src="~/assets/svg/flower2.svg"
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute -right-5 top-8 w-20 rotate-12 opacity-20 select-none"
      >
      <p class="text-overline uppercase text-gold-deep">
        The Wedding of
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        {{ groomName }} &amp; {{ brideName }}
      </h1>
      <p v-if="heroDate || venue" class="mt-4 text-body tracking-wide text-ink-500">
        <span v-if="heroDate">{{ heroDate }}</span>
        <span v-if="heroDate && venue" class="mx-3" />
        <span v-if="venue">{{ venue }}</span>
      </p>
      <!-- 分隔線中央嵌小花：線實際斷成兩段（不靠背景色遮蓋，否則會在漸層底上露出色塊） -->
      <div class="mt-6 flex items-center gap-3">
        <span class="h-px flex-1 bg-line" />
        <img
          src="~/assets/svg/flower1.svg"
          alt=""
          aria-hidden="true"
          class="pointer-events-none w-11 shrink-0 select-none"
        >
        <span class="h-px flex-1 bg-line" />
      </div>
      <p class="mt-6 text-overline uppercase text-gold-deep">
        RSVP · 敬請回覆
      </p>
      <p class="mt-3 text-body-l text-ink-500">
        誠摯邀請您，請撥空填寫以下出席資訊
      </p>
    </div>

    <UAlert
      v-if="errorMessage && !preview"
      data-testid="rsvp-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="errorMessage"
      class="mt-2"
    />

    <!-- 提交成功反饋 -->
    <UAlert
      v-if="submitted && !preview"
      data-testid="rsvp-submit-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="回覆已送出"
      description="感謝您的回覆，我們已收到您的出席資訊，期待與您相聚。"
      class="mt-2"
    />

    <!-- pb-36：預留固定送出列的高度，最後一題不會被壓在底下（preview 無送出列，不需留白） -->
    <form v-else class="mt-6 space-y-8" :class="preview ? '' : 'pb-36'" @submit.prevent="onSubmit">
      <!-- 基本資料（身分識別，常駐） -->
      <section class="space-y-5">
        <div>
          <label for="rsvp-name" class="mb-2 block text-body-l font-medium text-ink-700">
            請問您的大名？<span v-if="requireName" class="ml-1 text-error">＊必填</span>
          </label>
          <UInput
            id="rsvp-name"
            v-model="guestName"
            data-testid="rsvp-guest-name"
            placeholder="您的姓名"
            size="xl"
            class="w-full"
            :aria-required="requireName || undefined"
          />
          <p v-if="nameError" data-testid="rsvp-name-error" class="mt-2 text-body text-error">
            {{ nameError }}
          </p>
        </div>

        <!-- 與新人的關係 -->
        <div data-testid="vibe-rsvp-relationship">
          <p class="mb-3 text-body-l font-medium text-ink-700">
            與新人的關係？
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              v-bind="choiceProps(relationship === 'groom')"
              size="xl"
              block
              @click="relationship = 'groom'"
            >
              新郎{{ groomName }}的親友
            </UButton>
            <UButton
              v-bind="choiceProps(relationship === 'bride')"
              size="xl"
              block
              @click="relationship = 'bride'"
            >
              新娘{{ brideName }}的親友
            </UButton>
          </div>

          <div v-if="relationship" data-testid="vibe-rsvp-relation-category" class="mt-3">
            <p class="mb-2 text-body text-ink-500">
              您是{{ sideName }}的…
            </p>
            <div class="grid grid-cols-4 gap-2">
              <UButton
                v-for="cat in RELATION_CATEGORIES"
                :key="cat"
                v-bind="choiceProps(relationCategory === cat)"
                size="lg"
                block
                @click="relationCategory = cat"
              >
                {{ cat }}
              </UButton>
            </div>
          </div>
        </div>

        <div>
          <label for="rsvp-phone" class="mb-2 block text-body-l font-medium text-ink-700">
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
          />
        </div>
      </section>

      <!-- 是否出席 -->
      <div v-if="isEnabled('attending')" data-testid="vibe-rsvp-attend-toggle">
        <p class="mb-3 text-body-l font-medium text-ink-700">
          {{ labelOf('attending', '是否會出席婚禮？') }}
        </p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UButton
            v-bind="choiceProps(attending === 'attending')"
            size="xl"
            block
            aria-label="出席"
            @click="attending = 'attending'"
          >
            當然！期待見到你們！
          </UButton>
          <UButton
            v-bind="choiceProps(attending === 'declined')"
            size="xl"
            block
            aria-label="不出席"
            @click="attending = 'declined'"
          >
            無法出席，但還是祝福你們
          </UButton>
        </div>
      </div>

      <!-- 出席細節：餐點 / 攜伴 / 兒童椅 / 接駁（僅出席時填寫） -->
      <template v-if="attending === 'attending'">
        <!-- 餐點 -->
        <div v-if="isEnabled('diet')" data-testid="vibe-rsvp-diet-segment">
          <p class="mb-3 text-body-l font-medium text-ink-700">
            {{ labelOf('diet', '餐點選擇') }}
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              v-bind="choiceProps(diet === 'meat')"
              size="xl"
              block
              @click="diet = 'meat'"
            >
              葷食
            </UButton>
            <UButton
              v-bind="choiceProps(diet === 'vegetarian')"
              size="xl"
              block
              @click="diet = 'vegetarian'"
            >
              素食
            </UButton>
          </div>
        </div>

        <!-- 攜伴人數 -->
        <div v-if="isEnabled('partySize')" class="border-y border-line py-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <span class="text-body-l text-ink">{{ labelOf('partySize', '攜伴人數') }}</span>
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
                class="rounded-full"
                :disabled="plusOneCount <= 0"
                aria-label="少一位"
                @click="plusOneCount = Math.max(0, Number(plusOneCount) - 1)"
              />
              <output
                data-testid="rsvp-plus-one-display"
                class="w-14 text-center font-display text-h1 font-semibold tabular-nums leading-none text-ink"
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
                class="rounded-full"
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
              <span class="text-body-l text-ink">{{ labelOf('childChair', '兒童椅數') }}</span>
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
                class="rounded-full"
                :disabled="childChairCount <= 0"
                aria-label="少一張"
                @click="childChairCount = Math.max(0, Number(childChairCount) - 1)"
              />
              <output
                data-testid="rsvp-child-seat-display"
                class="w-14 text-center font-display text-h1 font-semibold tabular-nums leading-none text-ink"
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
                class="rounded-full"
                :disabled="childChairCount >= MAX_COUNT"
                aria-label="多一張"
                @click="childChairCount = Math.min(MAX_COUNT, Number(childChairCount) + 1)"
              />
            </div>
          </div>
        </div>

        <!-- 接駁車（顯示對象由後台設定，預設限男方親友） -->
        <div v-if="showShuttle" data-testid="vibe-rsvp-shuttle">
          <p class="mb-1 text-body-l font-medium text-ink-700">
            {{ labelOf('shuttle', '高雄地區接駁車') }}
            <span
              v-if="audienceHint(builtinMap.get('shuttle')?.audience)"
              class="ml-2 normal-case text-caption text-ink-300"
            >
              {{ audienceHint(builtinMap.get('shuttle')?.audience) }}
            </span>
          </p>
          <p class="mb-3 text-body text-ink-500">
            {{ descriptionOf('shuttle', '我們為親友安排了接駁車，是否需要搭乘？') }}
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              v-bind="choiceProps(needsShuttle === true)"
              size="xl"
              block
              @click="needsShuttle = true"
            >
              需要搭乘
            </UButton>
            <UButton
              v-bind="choiceProps(needsShuttle === false)"
              size="xl"
              block
              @click="needsShuttle = false"
            >
              不需要
            </UButton>
          </div>

          <div v-if="needsShuttle" class="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line bg-paper-soft px-4 py-4">
            <span class="text-body-l text-ink">搭車人數</span>
            <div data-testid="vibe-rsvp-shuttle-stepper" class="flex items-center gap-4">
              <UButton
                icon="i-heroicons-minus"
                color="neutral"
                variant="outline"
                size="xl"
                class="rounded-full"
                :disabled="shuttleCount <= 0"
                aria-label="少一位"
                @click="shuttleCount = Math.max(0, Number(shuttleCount) - 1)"
              />
              <output
                data-testid="rsvp-shuttle-count"
                class="w-14 text-center font-display text-h1 font-semibold tabular-nums leading-none text-ink"
              >{{ shuttleCount }}</output>
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="outline"
                size="xl"
                class="rounded-full"
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
        <p class="mb-3 text-body-l font-medium text-ink-700">
          {{ labelOf('invitation', '是否需要喜帖？') }}
        </p>
        <div class="grid grid-cols-1 gap-3">
          <UButton
            v-bind="choiceProps(invitation === 'e-card')"
            size="xl"
            block
            @click="invitation = 'e-card'"
          >
            需要！請寄電子喜帖
          </UButton>
          <UButton
            v-bind="choiceProps(invitation === 'physical')"
            size="xl"
            block
            @click="invitation = 'physical'"
          >
            需要！請寄實體喜帖
          </UButton>
          <UButton
            v-bind="choiceProps(invitation === 'none')"
            size="xl"
            block
            @click="invitation = 'none'"
          >
            不需要，我已記下婚禮資訊
          </UButton>
        </div>

        <div
          v-if="invitation === 'e-card'"
          class="mt-4 rounded-lg border border-line bg-paper-soft p-4 text-center"
        >
          <p class="text-body-m text-ink-500">
            電子喜帖將透過 LINE 寄送，請加入新人的 LINE 好友
          </p>
        </div>

        <div v-if="invitation === 'physical'" class="mt-4">
          <label for="rsvp-address" class="mb-2 block text-body text-ink-500">
            紙本喜帖寄送地址（請輸入 3+2 郵遞區號與地址）
          </label>
          <UTextarea
            id="rsvp-address"
            v-model="mailingAddress"
            data-testid="rsvp-address"
            :rows="3"
            placeholder="例：100-01 臺北市中正區○○路○段○號"
            class="w-full"
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
            class="block text-body-l font-medium text-ink-700"
            :class="q.description ? 'mb-1' : 'mb-2'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 normal-case text-caption text-ink-300">
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
          />
        </template>

        <!-- 單選 -->
        <template v-else-if="q.type === 'single'">
          <p
            class="text-body-l font-medium text-ink-700"
            :class="q.description ? 'mb-1' : 'mb-3'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 normal-case text-caption text-ink-300">
              {{ audienceHint(q.audience) }}
            </span>
          </p>
          <p v-if="q.description" class="mb-3 text-body text-ink-500">
            {{ q.description }}
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UButton
              v-for="opt in q.options ?? []"
              :key="opt.value"
              v-bind="choiceProps(customAnswers[q.id] === opt.value)"
              size="xl"
              block
              @click="customAnswers[q.id] = opt.value"
            >
              {{ opt.label }}
            </UButton>
          </div>
        </template>

        <!-- 多選 -->
        <template v-else>
          <p
            class="text-body-l font-medium text-ink-700"
            :class="q.description ? 'mb-1' : 'mb-3'"
          >
            {{ q.label }}
            <span v-if="audienceHint(q.audience)" class="ml-2 normal-case text-caption text-ink-300">
              {{ audienceHint(q.audience) }}
            </span>
          </p>
          <p v-if="q.description" class="mb-3 text-body text-ink-500">
            {{ q.description }}
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UButton
              v-for="opt in q.options ?? []"
              :key="opt.value"
              v-bind="choiceProps(isMultiChecked(q.id, opt.value))"
              size="xl"
              block
              @click="toggleMulti(q.id, opt.value)"
            >
              {{ opt.label }}
            </UButton>
          </div>
        </template>
      </div>

      <!-- 加入新人 LINE（常駐；預覽或未設定連結則不顯示） -->
      <div
        v-if="lineAddUrl && !preview"
        data-testid="vibe-rsvp-line"
        class="rounded-lg border border-line bg-paper-soft p-4 text-center"
      >
        <p class="text-body-m text-ink-500">
          想收到婚禮即時通知與電子喜帖嗎？歡迎加入新人的 LINE！
        </p>
        <UButton
          :to="lineAddUrl"
          target="_blank"
          external
          icon="i-heroicons-chat-bubble-oval-left-ellipsis"
          color="primary"
          size="lg"
          block
          class="mt-3"
        >
          加入新人的 LINE
        </UButton>
      </div>

      <!-- 祝福留言 -->
      <div v-if="isEnabled('blessing')">
        <label for="rsvp-blessing" class="mb-2 block text-body-l font-medium text-ink-700">
          {{ labelOf('blessing', '想給新人的祝福') }}
        </label>
        <div data-testid="vibe-rsvp-blessing-presets" class="mb-3 flex flex-wrap gap-2">
          <UButton
            v-for="phrase in BLESSING_PRESETS"
            :key="phrase"
            type="button"
            color="neutral"
            variant="soft"
            size="sm"
            class="rounded-full"
            @click="applyBlessing(phrase)"
          >
            {{ phrase }}
          </UButton>
        </div>
        <UTextarea
          id="rsvp-blessing"
          v-model="blessing"
          data-testid="rsvp-blessing"
          :rows="4"
          placeholder="寫下您想對新人說的話，或點選上方祝賀語帶入…"
          class="w-full"
        />
      </div>

      <!-- 畫一朵小花 -->
      <div v-if="isEnabled('flower')" data-testid="vibe-rsvp-flower">
        <p class="mb-3 text-body-l font-medium text-ink-700">
          {{ labelOf('flower', '畫一朵小花給新人們') }}
        </p>

        <div class="mb-3 flex flex-wrap items-center gap-2">
          <button
            v-for="color in PALETTE"
            :key="color"
            type="button"
            class="size-7 rounded-full border transition"
            :class="
              !isEraser && brushColor === color
                ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper'
                : 'border-line'
            "
            :style="{ backgroundColor: color }"
            :aria-label="`選擇顏色 ${color}`"
            :aria-pressed="!isEraser && brushColor === color"
            @click="selectColor(color)"
          />
          <div class="mx-1 h-6 w-px bg-line" />

          <!-- 筆刷粗細：圓點大小直接對應筆畫，不需文字說明 -->
          <button
            v-for="size in BRUSH_SIZES"
            :key="size"
            type="button"
            :data-testid="`rsvp-flower-size-${size}`"
            class="flex size-7 items-center justify-center border transition-colors"
            :class="brushSize === size ? 'border-ink bg-ink/5' : 'border-line'"
            :aria-label="`筆刷粗細 ${size}`"
            :aria-pressed="brushSize === size"
            @click="brushSize = size"
          >
            <span class="rounded-full bg-ink" :style="{ width: `${size + 2}px`, height: `${size + 2}px` }" />
          </button>

          <div class="mx-1 h-6 w-px bg-line" />
          <UButton
            type="button"
            v-bind="choiceProps(isEraser)"
            size="sm"
            icon="i-heroicons-backspace"
            data-testid="rsvp-flower-eraser"
            :aria-pressed="isEraser"
            @click="isEraser = true"
          >
            橡皮擦
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-heroicons-trash"
            data-testid="rsvp-flower-clear"
            :disabled="!hasDrawing"
            @click="clearCanvas"
          >
            清除
          </UButton>
        </div>

        <canvas
          ref="canvasRef"
          data-testid="rsvp-flower-canvas"
          class="h-88 w-full touch-none rounded-lg border border-dashed border-line bg-paper-soft"
          @pointerdown="startDraw"
          @pointermove="moveDraw"
          @pointerup="endDraw"
          @pointerleave="endDraw"
        />
        <p class="mt-2 text-center text-body text-ink-500">
          用手指或滑鼠在上方畫畫吧（可留白）
        </p>
      </div>

      <!-- 送出列：固定於視窗底部（表單有 8 題，捲到底才找得到送出鈕對長輩不友善）
           用 fixed 而非 sticky——sticky 的寬度會被 layout 的 max-w-2xl 綁住，
           桌機上色帶只有表單那麼寬會像一條浮在中間的帶子；fixed 讓底色滿寬，
           內層再收回同樣的 max-w-2xl，按鈕仍與表單對齊 -->
      <div
        v-if="!preview"
        class="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper from-60% to-transparent pb-4 pt-8"
      >
        <div class="mx-auto max-w-2xl px-4">
          <UButton
            type="submit"
            data-testid="rsvp-submit"
            color="primary"
            size="xl"
            block
            :loading="submitting"
            class="rounded-none"
          >
            送出回覆
          </UButton>

          <p class="mt-3 text-center text-caption text-ink-500">
            回覆截止前 · 可隨時修改
          </p>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* 花卉水彩模板：柔和暖色水彩暈染 + 兩角手繪植物花樣（賓客頁與後台預覽共用） */
.rsvp-theme-floral {
  border-radius: 0.75rem;
  background-color: rgb(253 250 244);
  background-image: radial-gradient(55% 45% at 2% 0%, rgb(190 106 82 / 13%), transparent 72%),
    radial-gradient(50% 42% at 100% 13%, rgb(160 87 123 / 12%), transparent 70%),
    radial-gradient(55% 45% at 100% 100%, rgb(110 139 106 / 12%), transparent 72%);
}
.rsvp-theme-floral::before,
.rsvp-theme-floral::after {
  content: '';
  position: absolute;
  z-index: 0;
  width: 120px;
  height: 120px;
  background-repeat: no-repeat;
  background-size: contain;
  pointer-events: none;
  opacity: 0.7;
  /* 手繪植物小花（5 瓣花 + 枝葉，取專案暖色調） */
  background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 132 132' fill='none' stroke='%23be6a52' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'><path d='M60 124 C63 96 53 74 68 48'/><path d='M62 86 C45 82 37 71 35 58 C50 60 58 69 62 86 Z' fill='%236e8b6a' fill-opacity='0.16'/><path d='M67 66 C84 62 92 51 94 38 C79 40 71 49 67 66 Z' fill='%236e8b6a' fill-opacity='0.16'/><g transform='translate(71 40)' fill='%23d98e73' fill-opacity='0.28'><ellipse cx='0' cy='-12' rx='4.6' ry='9'/><ellipse cx='0' cy='-12' rx='4.6' ry='9' transform='rotate(72)'/><ellipse cx='0' cy='-12' rx='4.6' ry='9' transform='rotate(144)'/><ellipse cx='0' cy='-12' rx='4.6' ry='9' transform='rotate(216)'/><ellipse cx='0' cy='-12' rx='4.6' ry='9' transform='rotate(288)'/><circle r='3.6' fill='%23c49a4a' fill-opacity='0.6'/></g></svg>");
}
.rsvp-theme-floral::before {
  top: 4px;
  right: 6px;
}
.rsvp-theme-floral::after {
  bottom: 6px;
  left: 6px;
  transform: scaleX(-1) rotate(8deg);
}
/* 內容浮於花樣之上 */
.rsvp-theme-floral > * {
  position: relative;
  z-index: 1;
}

/* 大圖主視覺模板：以暖色漸層強化開場，banner 在時更聚焦 */
.rsvp-theme-photo [data-testid='vibe-rsvp-hero'] {
  padding-block: 2.75rem;
  border-radius: 0.75rem;
  background-image: linear-gradient(
    135deg,
    rgb(196 154 74 / 16%),
    rgb(190 106 82 / 12%) 55%,
    rgb(160 87 123 / 12%)
  );
}
</style>
