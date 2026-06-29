<!-- app/pages/rsvp/[guestId].vue -->
<script setup lang="ts">
import type {
  AttendingStatus,
  GuestRelationship,
  InvitationPreference,
  SubmitRsvpBody,
} from '~/types/api/rsvp'
import { getWedding, submitRsvp as submitRsvpApi } from '~/api'

definePageMeta({ layout: 'guest' })

const route = useRoute()
const guestId = computed(() => String(route.params.guestId))
// weddingId 由專屬連結帶入（query），對應提交端點所需
const weddingId = computed(() => String(route.query.weddingId ?? 'wedding-001'))

// 新人 LINE 加好友連結（電子喜帖用；正式上線請換成新人官方帳號連結）
const lineAddUrl = 'https://line.me/R/ti/p/@everafter'

// 數量上限（攜伴 / 兒童椅 / 接駁車）
const MAX_COUNT = 10

// 新人姓名由後台維護，訪客頁讀取顯示與帶入「與新人的關係」選項
const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

// === 表單狀態 ===
// 基本資料
const guestName = ref('')
const relationship = ref<GuestRelationship | ''>('')
// 身分類別（家人／朋友／同事…），對應賓客分類
const RELATION_CATEGORIES = ['家人', '朋友', '同事', '其他']
const relationCategory = ref('')
const phone = ref('')
// 已選側別對應的新人姓名（供「您是○○的…」提示）
const sideName = computed(() => {
  if (relationship.value === 'groom')
    return groomName.value
  if (relationship.value === 'bride')
    return brideName.value
  return ''
})
// 出席（內部語意維持 attending/diet/plusOneCount/childChairCount 不變）
const attending = ref<AttendingStatus>('attending')
const diet = ref<'meat' | 'vegetarian'>('meat')
const plusOneCount = ref(0)
const childChairCount = ref(0)
// 接駁車（限男方親友／高雄地區）
const needsShuttle = ref<boolean | null>(null)
const shuttleCount = ref(1)
// 喜帖
const invitation = ref<InvitationPreference | ''>('')
const mailingAddress = ref('')
// 祝福（提供常用祝賀語可一鍵帶入，亦可自行書寫）
const blessing = ref('')
const BLESSING_PRESETS = [
  '新婚快樂，永浴愛河！',
  '百年好合，永結同心！',
  '佳偶天成，白頭偕老！',
  '甜甜蜜蜜，幸福美滿！',
  '有情人終成眷屬，恭喜！',
  '早生貴子，闔家安康！',
]
// 帶入祝賀語：已有內容時換行附加，方便堆疊
function applyBlessing(phrase: string) {
  const current = blessing.value.trim()
  blessing.value = current ? `${current}\n${phrase}` : phrase
}

const isSubmitting = ref(false)
const isSubmitted = ref(false)
const submitError = ref('')

// 是否顯示接駁車提問：男方親友 + 出席
const showShuttle = computed(
  () => relationship.value === 'groom' && attending.value === 'attending',
)

// === 畫小花（canvas 手繪：10 色 + 橡皮擦） ===
const PALETTE = [
  '#BE6A52', // 陶土橘
  '#9B3A34', // 酒磚紅
  '#C49A4A', // 古銅金
  '#6E8B6A', // 苔綠
  '#7A7C5E', // 橄欖鼠尾草
  '#6E8499', // 霧霾藍
  '#A0577B', // 玫瑰紫
  '#D98E73', // 蜜桃橘
  '#3F6F6F', // 松石綠
  '#2B2420', // 墨咖
]
const canvasRef = ref<HTMLCanvasElement | null>(null)
const brushColor = ref<string>(PALETTE[0]!)
const isEraser = ref(false)
const hasDrawing = ref(false)
let drawing = false
let ctx: CanvasRenderingContext2D | null = null

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  // 依顯示尺寸設定畫布解析度，避免線條模糊
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
}

onMounted(initCanvas)

function selectColor(color: string) {
  brushColor.value = color
  isEraser.value = false
}

function applyBrush() {
  if (!ctx)
    return
  if (isEraser.value) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = 18
  }
  else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineWidth = 3
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

async function submitRsvp() {
  if (isSubmitting.value || isSubmitted.value)
    return
  isSubmitting.value = true
  submitError.value = ''
  try {
    const body: SubmitRsvpBody = {
      attending: attending.value,
      diet: diet.value,
      plusOneCount: Number(plusOneCount.value) || 0,
      childChairCount: Number(childChairCount.value) || 0,
      guestName: guestName.value || undefined,
      relationship: relationship.value || undefined,
      relationCategory: relationCategory.value || undefined,
      phone: phone.value || undefined,
      invitation: invitation.value || undefined,
      mailingAddress:
        invitation.value === 'physical' ? mailingAddress.value || undefined : undefined,
      blessing: blessing.value || undefined,
      flowerDrawing:
        hasDrawing.value && canvasRef.value
          ? canvasRef.value.toDataURL('image/png')
          : undefined,
      needsShuttle: showShuttle.value && needsShuttle.value !== null ? needsShuttle.value : undefined,
      shuttleCount:
        showShuttle.value && needsShuttle.value ? Number(shuttleCount.value) || 0 : undefined,
    }
    await submitRsvpApi(weddingId.value, guestId.value, body)
    isSubmitted.value = true
  }
  catch (error: any) {
    submitError.value
      = error?.data?.message || error?.statusMessage || '提交失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="rsvp-submit-page" class="flex flex-col">
    <!-- Hero -->
    <div data-testid="vibe-rsvp-hero" class="py-6 text-center">
      <p class="text-overline uppercase text-gold-deep">
        RSVP · 敬請回覆
      </p>
      <h1 class="mt-3 font-display text-display-l font-semibold leading-none text-ink">
        {{ groomName }} &amp; {{ brideName }}
      </h1>
      <div class="mx-auto mt-4 h-px w-10 bg-gold" />
      <p class="mt-4 text-body-l text-ink-500">
        誠摯邀請您，請撥空填寫以下出席資訊
      </p>
    </div>

    <UAlert
      v-if="submitError"
      data-testid="rsvp-submit-error"
      icon="i-heroicons-exclamation-triangle"
      color="error"
      variant="soft"
      :title="submitError"
      class="mt-2"
    />

    <!-- 提交成功反饋 -->
    <UAlert
      v-if="isSubmitted"
      data-testid="rsvp-submit-success"
      icon="i-heroicons-check-circle"
      color="success"
      variant="soft"
      title="回覆已送出"
      description="感謝您的回覆，我們已收到您的出席資訊，期待與您相聚。"
      class="mt-2"
    />

    <form v-else class="mt-6 space-y-8" @submit.prevent="submitRsvp">
      <!-- 基本資料 -->
      <section class="space-y-5">
        <div>
          <label for="rsvp-name" class="mb-2 block text-overline uppercase text-gold-deep">
            請問您的大名？
          </label>
          <UInput
            id="rsvp-name"
            v-model="guestName"
            data-testid="rsvp-guest-name"
            placeholder="您的姓名"
            size="xl"
            class="w-full"
          />
        </div>

        <!-- 與新人的關係 -->
        <div data-testid="vibe-rsvp-relationship">
          <p class="mb-3 text-overline uppercase text-gold-deep">
            與新人的關係？
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              color="neutral"
              :variant="relationship === 'groom' ? 'solid' : 'outline'"
              size="xl"
              block
              @click="relationship = 'groom'"
            >
              新郎{{ groomName }}的親友
            </UButton>
            <UButton
              color="neutral"
              :variant="relationship === 'bride' ? 'solid' : 'outline'"
              size="xl"
              block
              @click="relationship = 'bride'"
            >
              新娘{{ brideName }}的親友
            </UButton>
          </div>

          <!-- 身分類別（選完側別後出現） -->
          <div v-if="relationship" data-testid="vibe-rsvp-relation-category" class="mt-3">
            <p class="mb-2 text-caption text-ink-300">
              您是{{ sideName }}的…
            </p>
            <div class="grid grid-cols-4 gap-2">
              <UButton
                v-for="cat in RELATION_CATEGORIES"
                :key="cat"
                color="neutral"
                :variant="relationCategory === cat ? 'solid' : 'outline'"
                size="lg"
                block
                @click="relationCategory = cat"
              >
                {{ cat }}
              </UButton>
            </div>
          </div>
        </div>

        <!-- 聯繫電話 -->
        <div>
          <label for="rsvp-phone" class="mb-2 block text-overline uppercase text-gold-deep">
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
      <div data-testid="vibe-rsvp-attend-toggle">
        <p class="mb-3 text-overline uppercase text-gold-deep">
          是否會出席婚禮？
        </p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UButton
            color="neutral"
            :variant="attending === 'attending' ? 'solid' : 'outline'"
            size="xl"
            block
            aria-label="出席"
            @click="attending = 'attending'"
          >
            當然！期待見到你們！
          </UButton>
          <UButton
            color="neutral"
            :variant="attending === 'declined' ? 'solid' : 'outline'"
            size="xl"
            block
            aria-label="不出席"
            @click="attending = 'declined'"
          >
            無法出席，但還是祝福你們
          </UButton>
        </div>
      </div>

      <!-- 出席細節：餐點 / 攜伴人數 / 兒童椅（僅出席時填寫） -->
      <template v-if="attending === 'attending'">
        <!-- 餐點 -->
        <div data-testid="vibe-rsvp-diet-segment">
          <p class="mb-3 text-overline uppercase text-gold-deep">
            餐點選擇
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              color="neutral"
              :variant="diet === 'meat' ? 'solid' : 'outline'"
              size="xl"
              block
              @click="diet = 'meat'"
            >
              葷食
            </UButton>
            <UButton
              color="neutral"
              :variant="diet === 'vegetarian' ? 'solid' : 'outline'"
              size="xl"
              block
              @click="diet = 'vegetarian'"
            >
              素食
            </UButton>
          </div>
        </div>

        <!-- 攜伴人數（stepper）：不含您本人，本人會自動計入 -->
        <div class="border-y border-line py-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <span class="text-body-l text-ink">攜伴人數</span>
              <p class="mt-0.5 text-caption text-ink-300">
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
                class="w-14 text-center font-display text-5xl font-semibold tabular-nums leading-none text-ink"
              >{{ plusOneCount }}</output>
              <!-- sr-only 可填欄位：供凍結 spec 以 label 填值；畫面實際以 +/- 操作 -->
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
                variant="solid"
                size="xl"
                class="rounded-full"
                :disabled="plusOneCount >= MAX_COUNT"
                aria-label="多一位"
                @click="plusOneCount = Math.min(MAX_COUNT, Number(plusOneCount) + 1)"
              />
            </div>
          </div>
        </div>

        <!-- 兒童椅嬰兒數（stepper）：用兒童椅、不吃大人菜的小嬰兒；額外加位、不佔正常席 -->
        <div class="border-b border-line py-5">
          <div class="flex items-center justify-between gap-4">
            <div>
              <span class="text-body-l text-ink">兒童椅數</span>
              <p class="mt-0.5 text-caption text-ink-300">
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
                class="w-14 text-center font-display text-5xl font-semibold tabular-nums leading-none text-ink"
              >{{ childChairCount }}</output>
              <!-- sr-only 可填欄位：供凍結 spec 以 label 填值；畫面實際以 +/- 操作 -->
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
                variant="solid"
                size="xl"
                class="rounded-full"
                :disabled="childChairCount >= MAX_COUNT"
                aria-label="多一張"
                @click="childChairCount = Math.min(MAX_COUNT, Number(childChairCount) + 1)"
              />
            </div>
          </div>
        </div>

        <!-- 接駁車（限男方親友／高雄地區） -->
        <div v-if="showShuttle" data-testid="vibe-rsvp-shuttle">
          <p class="mb-1 text-overline uppercase text-gold-deep">
            高雄地區接駁車
          </p>
          <p class="mb-3 text-caption text-ink-300">
            我們為男方親友安排了接駁車，是否需要搭乘？
          </p>
          <div class="grid grid-cols-2 gap-3">
            <UButton
              color="neutral"
              :variant="needsShuttle === true ? 'solid' : 'outline'"
              size="xl"
              block
              @click="needsShuttle = true"
            >
              需要搭乘
            </UButton>
            <UButton
              color="neutral"
              :variant="needsShuttle === false ? 'solid' : 'outline'"
              size="xl"
              block
              @click="needsShuttle = false"
            >
              不需要
            </UButton>
          </div>

          <!-- 搭車人數（需要時填寫） -->
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
                class="w-14 text-center font-display text-5xl font-semibold tabular-nums leading-none text-ink"
              >{{ shuttleCount }}</output>
              <UButton
                icon="i-heroicons-plus"
                color="neutral"
                variant="solid"
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
      <div data-testid="vibe-rsvp-invitation">
        <p class="mb-3 text-overline uppercase text-gold-deep">
          是否需要喜帖？
        </p>
        <div class="grid grid-cols-1 gap-3">
          <UButton
            color="neutral"
            :variant="invitation === 'e-card' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="invitation = 'e-card'"
          >
            需要！請寄電子喜帖
          </UButton>
          <UButton
            color="neutral"
            :variant="invitation === 'physical' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="invitation = 'physical'"
          >
            需要！請寄實體喜帖
          </UButton>
          <UButton
            color="neutral"
            :variant="invitation === 'none' ? 'solid' : 'outline'"
            size="xl"
            block
            @click="invitation = 'none'"
          >
            不需要，我已記下婚禮資訊
          </UButton>
        </div>

        <!-- 電子喜帖：加入新人 LINE -->
        <div
          v-if="invitation === 'e-card'"
          data-testid="vibe-rsvp-line"
          class="mt-4 rounded-lg border border-line bg-paper-soft p-4 text-center"
        >
          <p class="text-body-m text-ink-500">
            電子喜帖將透過 LINE 寄送，請加入新人的 LINE 好友
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

        <!-- 實體喜帖：寄送地址 -->
        <div v-if="invitation === 'physical'" class="mt-4">
          <label for="rsvp-address" class="mb-2 block text-caption text-ink-300">
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

      <!-- 祝福留言 -->
      <div>
        <label for="rsvp-blessing" class="mb-2 block text-overline uppercase text-gold-deep">
          想給新人的祝福
        </label>
        <!-- 常用祝賀語：點選即帶入，亦可自行書寫 -->
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
      <div data-testid="vibe-rsvp-flower">
        <p class="mb-3 text-overline uppercase text-gold-deep">
          畫一朵小花給新人們
        </p>

        <!-- 顏色 + 橡皮擦 + 清除 工具列 -->
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
          <UButton
            type="button"
            :color="isEraser ? 'primary' : 'neutral'"
            :variant="isEraser ? 'solid' : 'outline'"
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
        <p class="mt-2 text-center text-caption text-ink-300">
          用手指或滑鼠在上方畫畫吧（可留白）
        </p>
      </div>

      <UButton
        type="submit"
        data-testid="rsvp-submit"
        color="primary"
        size="xl"
        block
        :loading="isSubmitting"
        class="mt-2"
      >
        送出回覆
      </UButton>

      <!-- 回覆說明（靜態文案） -->
      <p class="text-center text-caption text-ink-300">
        回覆截止前 · 可隨時修改
      </p>
    </form>
  </div>
</template>
