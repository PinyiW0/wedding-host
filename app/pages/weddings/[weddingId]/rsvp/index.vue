<!-- app/pages/weddings/[weddingId]/rsvp.vue -->
<script setup lang="ts">
import type { GuestDiet, GuestListItem, GuestSide, UpdateGuestBody } from '~/types/api/guests'

import type {
  AttendingStatus,
  InvitationPreference,
  OverrideRsvpBody,
} from '~/types/api/rsvp'
import { deleteGuest, getRsvpFormConfig, getWedding, listGuests, markInvitationSent, overrideRsvp, updateGuest } from '~/api'
import { rsvpAttendingMeta } from '~/utils/statusMeta'
import { createZip, dataUrlExt, dataUrlToBytes } from '~/utils/zip'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 賓客名單（僅未移除者參與 RSVP 管理）：CSV 匯出與花圖下載需要 blessing / flowerDrawing 完整欄位
const { data: guests, refresh } = await listGuests(weddingId, { default: () => [], query: { fields: 'full' } })
// 新人姓名（顯示「新郎〔姓名〕· 家人」這類關係描述）
const { data: wedding } = await getWedding(weddingId)

// RSVP 表單設定：用於把自訂題答案的 id 對應回題目標籤
const { data: rsvpConfig } = await getRsvpFormConfig(weddingId)
const customLabelMap = computed(() => {
  const map = new Map<string, string>()
  for (const q of rsvpConfig.value?.questions ?? []) {
    if (q.type !== 'builtin')
      map.set(q.id, q.label)
  }
  return map
})
// 自訂題答案（key=題目 id）展平成可顯示的 { label, value } 清單
function customAnswerEntries(guest: GuestListItem) {
  const answers = guest.customAnswers
  if (!answers)
    return []
  return Object.entries(answers).map(([id, value]) => ({
    label: customLabelMap.value.get(id) || id,
    value: Array.isArray(value) ? value.join('、') : value,
  }))
}

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

// RSVP 出席狀態徽章：null 在管理頁顯示「未提交」；文字與語意色由 statusMeta 統一
function rsvpBadge(status: AttendingStatus | null) {
  return rsvpAttendingMeta(status, '未提交')
}

// === 查看回覆詳情 ===
const isDetailOpen = ref(false)
const detailTarget = ref<GuestListItem | null>(null)

const invitationLabel: Record<string, string> = {
  'e-card': '電子喜帖',
  'physical': '實體喜帖',
  'none': '不需要',
}

function openDetail(guest: GuestListItem) {
  detailTarget.value = guest
  isDetailOpen.value = true
}

// 關係描述：新郎〔姓名〕· 家人
function relationshipText(guest: GuestListItem) {
  const role = guest.side === 'groom' ? '新郎' : '新娘'
  const name = guest.side === 'groom'
    ? (wedding.value?.groomName ?? '')
    : (wedding.value?.brideName ?? '')
  return `${role}${name} · ${guest.category}`
}

// === 表格摘要欄位格式化（未填一律以「-」呈現） ===
function isAttending(guest: GuestListItem) {
  return guest.rsvpAttending === 'attending'
}
function sideLabel(side: GuestListItem['side']) {
  return side === 'groom' ? '男方' : '女方'
}
// 葷素僅在確認出席時有意義
function dietLabel(guest: GuestListItem) {
  if (!isAttending(guest))
    return '-'
  return guest.diet === 'meat' ? '葷' : '素'
}
// 接駁：需要顯示人數、不需要顯示文字、未填「-」
function shuttleLabel(guest: GuestListItem) {
  if (guest.needsShuttle == null)
    return '-'
  return guest.needsShuttle ? `${guest.shuttleCount ?? 0} 位` : '不需要'
}
// 喜帖需求簡寫
const invitationShortMap: Record<string, string> = {
  'e-card': '電子',
  'physical': '紙本',
  'none': '不需要',
}
function invitationShort(guest: GuestListItem) {
  return guest.invitationPreference
    ? (invitationShortMap[guest.invitationPreference] ?? '-')
    : '-'
}

// === 下載手繪小花（透明背景 PNG，供婚禮網站輸出） ===
// canvas 匯出本身即為透明底（只含筆跡像素），直接存檔即為去背 PNG
function downloadFlower(guest: GuestListItem) {
  if (!guest.flowerDrawing)
    return
  const a = document.createElement('a')
  a.href = guest.flowerDrawing
  a.download = `flower-${guest.name}.${dataUrlExt(guest.flowerDrawing)}`
  a.click()
}

// 有上傳手繪小花的賓客
const guestsWithFlower = computed(() =>
  activeGuests.value.filter(g => g.flowerDrawing),
)

// 一鍵下載全部花朵（打包成 zip；檔名同名時加 guestId 去重）
function downloadAllFlowers() {
  const seen = new Set<string>()
  const entries = guestsWithFlower.value.map((g) => {
    const ext = dataUrlExt(g.flowerDrawing!)
    let name = `${g.name}.${ext}`
    if (seen.has(name))
      name = `${g.name}-${g.guestId}.${ext}`
    seen.add(name)
    return { name, data: dataUrlToBytes(g.flowerDrawing!) }
  })
  if (entries.length === 0)
    return
  const blob = createZip(entries)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flowers-${weddingId.value}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// === 匯出整份 RSVP（CSV，Excel 可直接開啟；含 UTF-8 BOM 處理中文） ===
const CSV_SPECIAL_RE = /[",\n]/
const CSV_QUOTE_RE = /"/g
function csvCell(value: unknown) {
  const s = String(value ?? '')
  return CSV_SPECIAL_RE.test(s) ? `"${s.replace(CSV_QUOTE_RE, '""')}"` : s
}
function exportCsv() {
  const headers = [
    '姓名',
    '男女方',
    '分類',
    '出席狀態',
    '出席人數',
    '葷素',
    '兒童椅',
    '接駁人數',
    '喜帖需求',
    '寄送地址',
    '電話',
    '祝福留言',
  ]
  const rows = activeGuests.value.map(g => [
    g.name,
    sideLabel(g.side),
    g.category,
    rsvpBadge(g.rsvpAttending).label,
    isAttending(g) ? g.partySize : '-',
    dietLabel(g),
    isAttending(g) ? g.childChairCount : '-',
    shuttleLabel(g),
    invitationShort(g),
    g.mailingAddress || '-',
    g.contact || '-',
    g.blessing || '-',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\n')
  // UTF-8 BOM 讓 Excel 正確辨識中文（以 charCode 產生，避免原始碼出現不可見字元）
  const bom = String.fromCharCode(0xFEFF)
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `RSVP-${weddingId.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// === 出席統計（顯示用，僅彙總既有名單資料） ===
const stats = computed(() => {
  const list = activeGuests.value
  const attending = list.filter(g => g.rsvpAttending === 'attending')
  const declined = list.filter(g => g.rsvpAttending === 'declined').length
  const absent = list.filter(g => g.rsvpAttending === 'absent').length
  const pending = list.filter(g => g.rsvpAttending === null).length
  // 葷素與兒童椅僅計入確認出席者
  const meat = attending.filter(g => g.diet === 'meat').length
  const vegetarian = attending.filter(g => g.diet === 'vegetarian').length
  const childChairs = attending.reduce((sum, g) => sum + g.childChairCount, 0)
  return {
    total: list.length,
    attending: attending.length,
    declined,
    absent,
    pending,
    meat,
    vegetarian,
    childChairs,
  }
})

// === 喜帖需求統計（以賓客筆數計，僅計未移除者） ===
const invitationStats = computed(() => {
  const list = activeGuests.value
  return {
    ecard: list.filter(g => g.invitationPreference === 'e-card').length,
    physical: list.filter(g => g.invitationPreference === 'physical').length,
    sent: list.filter(g => g.invitationSent).length,
  }
})

// === 喜帖需求篩選（USelectMenu 禁空字串 value，一律用哨兵值） ===
const INVITATION_FILTER_ALL = '__all__'
const INVITATION_FILTER_UNFILLED = '__unfilled__'
const invitationFilter = ref<string>(INVITATION_FILTER_ALL)
const invitationFilterOptions = [
  { label: '全部', value: INVITATION_FILTER_ALL },
  { label: '電子喜帖', value: 'e-card' },
  { label: '紙本喜帖', value: 'physical' },
  { label: '不需要', value: 'none' },
  { label: '未填', value: INVITATION_FILTER_UNFILLED },
]
const filteredGuests = computed(() => {
  const filter = invitationFilter.value
  if (filter === INVITATION_FILTER_ALL)
    return activeGuests.value
  if (filter === INVITATION_FILTER_UNFILLED)
    return activeGuests.value.filter(g => !g.invitationPreference)
  return activeGuests.value.filter(g => g.invitationPreference === filter)
})

// === 標記喜帖已寄送（逐列 checkbox；PUT 冪等設值） ===
// checkbox 為 controlled（綁 guest.invitationSent、不就地 mutate）：
// 成功後 refresh() 由 GET 讀模型帶回新值；失敗時 prop 不變即自動回滾勾選
const markingGuestId = ref<string | null>(null)
async function toggleInvitationSent(guest: GuestListItem, value: boolean | 'indeterminate') {
  if (markingGuestId.value)
    return
  markingGuestId.value = guest.guestId
  try {
    await markInvitationSent(weddingId.value, guest.guestId, { sent: value === true })
    await refresh()
  }
  catch (error: any) {
    toast.add({
      title: '標記喜帖寄送失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    markingGuestId.value = null
  }
}

// 出席統計堆疊長條（出席 / 缺席+不出席 / 待回覆 三段百分比）
const attendBar = computed(() => {
  const total = stats.value.total || 1
  const notAttending = stats.value.declined + stats.value.absent
  return {
    attending: (stats.value.attending / total) * 100,
    notAttending: (notAttending / total) * 100,
    pending: (stats.value.pending / total) * 100,
  }
})

// === 編輯回覆 / 覆寫 RSVP（管理員修正賓客填寫內容） ===
const isOverrideOpen = ref(false)
const isOverriding = ref(false)
const overrideError = ref('')
const overrideTarget = ref<GuestListItem | null>(null)
const overrideAttending = ref<AttendingStatus>('attending')
const overrideReason = ref('')

// 回覆內容修正欄位（對齊賓客 RSVP 表單）
// 「未填」哨兵值（不可用空字串：USelectMenu/Combobox 禁止空字串 value，否則下拉打不開）
const UNSET_INVITATION = '__unset__'
type InvitationChoice = InvitationPreference | typeof UNSET_INVITATION

const editForm = reactive({
  side: 'groom' as GuestSide,
  category: '',
  contact: '',
  diet: 'meat' as GuestDiet,
  partySize: 1,
  childChairCount: 0,
  needsShuttle: false,
  shuttleCount: 0,
  invitation: UNSET_INVITATION as InvitationChoice,
  mailingAddress: '',
})

const attendingOptions = [
  { label: '出席', value: 'attending' as AttendingStatus },
  { label: '不出席', value: 'declined' as AttendingStatus },
  { label: '缺席', value: 'absent' as AttendingStatus },
]
const sideOptions = [
  { label: '男方（新郎）', value: 'groom' as GuestSide },
  { label: '女方（新娘）', value: 'bride' as GuestSide },
]
const dietOptions = [
  { label: '葷食', value: 'meat' as GuestDiet },
  { label: '素食', value: 'vegetarian' as GuestDiet },
]
const shuttleOptions = [
  { label: '不需要', value: false },
  { label: '需要', value: true },
]
const invitationOptions: { label: string, value: InvitationChoice }[] = [
  { label: '未填', value: UNSET_INVITATION },
  { label: '電子喜帖', value: 'e-card' },
  { label: '紙本喜帖', value: 'physical' },
  { label: '不需要', value: 'none' },
]

function openOverride(guest: GuestListItem) {
  overrideTarget.value = guest
  overrideAttending.value = guest.rsvpAttending ?? 'attending'
  overrideReason.value = ''
  overrideError.value = ''
  editForm.side = guest.side
  editForm.category = guest.category
  editForm.contact = guest.contact
  editForm.diet = guest.diet
  editForm.partySize = guest.partySize
  editForm.childChairCount = guest.childChairCount
  editForm.needsShuttle = guest.needsShuttle ?? false
  editForm.shuttleCount = guest.shuttleCount ?? 0
  editForm.invitation = guest.invitationPreference ?? UNSET_INVITATION
  editForm.mailingAddress = guest.mailingAddress ?? ''
  isOverrideOpen.value = true
}

async function confirmOverride() {
  if (!overrideTarget.value || isOverriding.value)
    return
  isOverriding.value = true
  overrideError.value = ''
  try {
    const guestId = overrideTarget.value.guestId
    // 1. 修正回覆內容（PATCH guest）
    const updateBody: UpdateGuestBody = {
      side: editForm.side,
      category: editForm.category,
      contact: editForm.contact,
      diet: editForm.diet,
      partySize: Number(editForm.partySize) || 1,
      childChairCount: Number(editForm.childChairCount) || 0,
      needsShuttle: editForm.needsShuttle,
      shuttleCount: editForm.needsShuttle ? Number(editForm.shuttleCount) || 0 : 0,
      invitationPreference: editForm.invitation === UNSET_INVITATION ? null : editForm.invitation,
      mailingAddress: editForm.invitation === 'physical' ? editForm.mailingAddress : '',
    }
    await updateGuest(weddingId.value, guestId, updateBody)
    // 2. 出席覆寫（維持既有 rsvp-override 契約）
    const overrideBody: OverrideRsvpBody = {
      attending: overrideAttending.value,
      reason: overrideReason.value,
    }
    await overrideRsvp(weddingId.value, guestId, overrideBody)
    // 重抓，以 GET 為呈現真實來源（重整也靠 GET）
    await refresh()
    toast.add({ title: '回覆已更新', color: 'success' })
    isOverrideOpen.value = false
  }
  catch (error: any) {
    overrideError.value
      = error?.data?.message || error?.statusMessage || '更新失敗，請稍後再試'
  }
  finally {
    isOverriding.value = false
  }
}

// === 刪除賓客（軟刪，可由賓客名單回收區恢復） ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<GuestListItem | null>(null)

function openRemove(guest: GuestListItem) {
  removeTarget.value = guest
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await deleteGuest(weddingId.value, removeTarget.value.guestId)
    toast.add({ title: '賓客已刪除', color: 'success' })
    isRemoveOpen.value = false
    await refresh()
  }
  catch (error: any) {
    toast.add({
      title: '刪除失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    isRemoving.value = false
  }
}
</script>

<template>
  <div data-testid="rsvp-page" class="flex h-full flex-col">
    <PageHeader
      title="RSVP 出席管理"
      :eyebrow="`RSVP · ${stats.total} 份`"
      description="查看、匯出與覆寫賓客回覆"
    >
      <template #actions>
        <div class="flex items-center gap-5">
          <UButton
            data-testid="rsvp-view-flowers"
            icon="i-heroicons-sparkles"
            color="neutral"
            variant="ghost"
            :to="`/flowers/${weddingId}`"
            target="_blank"
            external
          >
            查看花田
          </UButton>
          <UButton
            data-testid="rsvp-download-flowers"
            icon="i-heroicons-photo"
            color="neutral"
            variant="outline"
            :disabled="guestsWithFlower.length === 0"
            @click="downloadAllFlowers"
          >
            下載花朵 ZIP
          </UButton>
          <UButton
            data-testid="rsvp-export-csv"
            icon="i-heroicons-arrow-down-tray"
            color="primary"
            variant="solid"
            :disabled="activeGuests.length === 0"
            @click="exportCsv"
          >
            下載 Excel
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <!-- 統計帶：左為確認出席錨點卡（含出席組成長條），右卡集中其餘統計，一屏收完讓表格當主角 -->
      <section class="grid shrink-0 gap-4 lg:grid-cols-[280px_1fr]">
        <StatCard
          eyebrow="確認出席"
          :value="stats.attending"
          feature
          :caption="`共 ${stats.total} 位賓客`"
        >
          <!-- 出席組成：出席（金）/ 不出席+缺席（暗紅）/ 待回覆（底色餘量） -->
          <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-ink-500/40">
            <div class="bg-gold" :style="{ width: `${attendBar.attending}%` }" />
            <div class="bg-error-400/80" :style="{ width: `${attendBar.notAttending}%` }" />
          </div>
        </StatCard>

        <div class="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex flex-wrap gap-y-3 divide-x divide-line dark:divide-neutral-800">
            <div class="min-w-24 flex-1 px-4 first:pl-1">
              <p class="text-overline uppercase text-gold-deep">
                不出席
              </p>
              <p class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
                {{ stats.declined }}
              </p>
            </div>
            <div class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                缺席
              </p>
              <p class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
                {{ stats.absent }}
              </p>
            </div>
            <div class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                待回覆
              </p>
              <p class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
                {{ stats.pending }}
              </p>
            </div>
            <div class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                葷食
              </p>
              <p class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
                {{ stats.meat }}
              </p>
            </div>
            <div class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                素食
              </p>
              <p class="mt-1 font-display text-h2 font-semibold text-ink dark:text-paper">
                {{ stats.vegetarian }}
              </p>
            </div>
            <div class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                兒童椅
              </p>
              <p class="mt-1 flex items-baseline gap-1">
                <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ stats.childChairs }}</span>
                <span class="text-caption text-ink-300">張</span>
              </p>
            </div>
          </div>

          <div class="my-4 h-px bg-line dark:bg-neutral-800" />

          <!-- 喜帖需求（電子/紙本以賓客筆數計；已寄送為管理端記號；testid 容器需含數字） -->
          <div class="flex flex-wrap gap-y-3 divide-x divide-line dark:divide-neutral-800">
            <div data-testid="rsvp-stat-ecard" class="min-w-24 flex-1 px-4 first:pl-1">
              <p class="text-overline uppercase text-gold-deep">
                電子喜帖
              </p>
              <p class="mt-1 flex items-baseline gap-1">
                <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ invitationStats.ecard }}</span>
                <span class="text-caption text-ink-300">筆</span>
              </p>
            </div>
            <div data-testid="rsvp-stat-physical" class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                紙本喜帖
              </p>
              <p class="mt-1 flex items-baseline gap-1">
                <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ invitationStats.physical }}</span>
                <span class="text-caption text-ink-300">筆</span>
              </p>
            </div>
            <div data-testid="rsvp-stat-sent" class="min-w-24 flex-1 px-4">
              <p class="text-overline uppercase text-gold-deep">
                已寄送
              </p>
              <p class="mt-1 flex items-baseline gap-1">
                <span class="font-display text-h2 font-semibold text-ink dark:text-paper">{{ invitationStats.sent }}</span>
                <span class="text-caption text-ink-300">筆</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 賓客回覆清單 — 編輯式表格（表格為主捲動區，表頭 sticky） -->
      <section class="flex min-h-0 flex-1 flex-col">
        <div class="mb-3 flex shrink-0 items-center gap-3">
          <span class="text-overline uppercase text-gold-deep">賓客回覆</span>
          <span class="h-px flex-1 bg-line" />
          <!-- 依喜帖需求篩選回覆清單 -->
          <USelectMenu
            v-model="invitationFilter"
            data-testid="rsvp-invitation-filter"
            :items="invitationFilterOptions"
            value-key="value"
            aria-label="依喜帖需求篩選"
            class="w-40"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-auto">
          <table
            data-testid="rsvp-list"
            class="w-full border-collapse whitespace-nowrap text-body"
          >
            <thead>
              <tr class="text-left text-overline uppercase text-gold-deep">
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 font-medium">
                  姓名
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 font-medium">
                  男女方
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 font-medium">
                  分類
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 font-medium">
                  出席
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-center font-medium">
                  人數
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-center font-medium">
                  葷素
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-center font-medium">
                  兒童椅
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-center font-medium">
                  接駁
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 font-medium">
                  喜帖
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-center font-medium">
                  已寄送
                </th>
                <th class="sticky top-0 z-10 border-b border-line bg-cream px-3 py-3.5 dark:bg-neutral-950 text-right font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="text-ink-700 dark:text-neutral-300">
              <tr
                v-for="guest in filteredGuests"
                :key="guest.guestId"
                :data-testid="`rsvp-row-${guest.guestId}`"
                class="transition-colors hover:bg-paper dark:hover:bg-neutral-900"
              >
                <td class="border-b border-line px-3 py-3 dark:border-neutral-800">
                  <span class="font-medium text-ink dark:text-paper">
                    {{ guest.name }}
                  </span>
                </td>
                <td class="border-b border-line px-3 py-3 dark:border-neutral-800">
                  {{ sideLabel(guest.side) }}
                </td>
                <td class="border-b border-line px-3 py-3 dark:border-neutral-800">
                  {{ guest.category || '-' }}
                </td>
                <td class="border-b border-line px-3 py-3 dark:border-neutral-800">
                  <UBadge
                    :data-testid="`rsvp-status-${guest.guestId}`"
                    :color="rsvpBadge(guest.rsvpAttending).color"
                    variant="soft"
                    size="sm"
                  >
                    {{ rsvpBadge(guest.rsvpAttending).label }}
                  </UBadge>
                </td>
                <td class="border-b border-line px-3 py-3 text-center dark:border-neutral-800">
                  {{ isAttending(guest) ? guest.partySize : '-' }}
                </td>
                <td class="border-b border-line px-3 py-3 text-center dark:border-neutral-800">
                  {{ dietLabel(guest) }}
                </td>
                <td class="border-b border-line px-3 py-3 text-center dark:border-neutral-800">
                  {{ isAttending(guest) ? guest.childChairCount : '-' }}
                </td>
                <td class="border-b border-line px-3 py-3 text-center dark:border-neutral-800">
                  {{ shuttleLabel(guest) }}
                </td>
                <td class="border-b border-line px-3 py-3 dark:border-neutral-800">
                  {{ invitationShort(guest) }}
                </td>
                <td class="border-b border-line px-3 py-3 text-center dark:border-neutral-800">
                  <!-- 喜帖已寄送記號（controlled：成功由 refresh 帶回、失敗自動回滾；請求中鎖定防連點） -->
                  <UCheckbox
                    :data-testid="`rsvp-invitation-sent-${guest.guestId}`"
                    :model-value="guest.invitationSent ?? false"
                    :disabled="markingGuestId === guest.guestId"
                    :aria-label="`標記 ${guest.name} 喜帖已寄送`"
                    class="inline-flex"
                    @update:model-value="toggleInvitationSent(guest, $event)"
                  />
                </td>
                <td class="border-b border-line px-3 py-3 text-right dark:border-neutral-800">
                  <div class="flex justify-end gap-1">
                    <UButton
                      data-testid="rsvp-detail"
                      icon="i-heroicons-eye"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="`查看 ${guest.name} 的回覆`"
                      @click="openDetail(guest)"
                    >
                      查看回覆
                    </UButton>
                    <UButton
                      data-testid="rsvp-override"
                      icon="i-heroicons-pencil-square"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :aria-label="`覆寫 ${guest.name} 的 RSVP`"
                      @click="openOverride(guest)"
                    >
                      覆寫
                    </UButton>
                    <UButton
                      data-testid="rsvp-delete"
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="sm"
                      :aria-label="`刪除 ${guest.name}`"
                      @click="openRemove(guest)"
                    >
                      刪除
                    </UButton>
                  </div>
                </td>
              </tr>
              <tr v-if="activeGuests.length === 0">
                <td colspan="11">
                  <EmptyState
                    title="目前沒有賓客"
                    description="請先於賓客名單新增賓客後再管理 RSVP"
                  />
                </td>
              </tr>
              <tr v-else-if="filteredGuests.length === 0">
                <td colspan="11">
                  <EmptyState
                    title="沒有符合的賓客"
                    description="目前沒有賓客符合此喜帖需求篩選"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- 覆寫 RSVP Modal -->
    <UModal v-model:open="isOverrideOpen">
      <template #content>
        <div
          data-testid="rsvp-override-modal"
          class="max-h-[85vh] overflow-y-auto p-6"
        >
          <p class="text-overline uppercase text-gold-deep">
            Edit Reply
          </p>
          <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
            編輯回覆
          </h3>
          <p class="mb-5 mt-1 text-caption text-ink-300">
            修正賓客「{{ overrideTarget?.name ?? '' }}」的回覆內容（對齊其填寫表單；填錯可在此更正）
          </p>

          <UAlert
            v-if="overrideError"
            data-testid="rsvp-override-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="overrideError"
            class="mb-4"
          />

          <div class="space-y-4">
            <!-- 出席覆寫（維持 rsvp-override 契約；置頂以利下拉展開） -->
            <UFormField label="出席狀態（覆寫）" name="attending">
              <USelectMenu
                v-model="overrideAttending"
                data-testid="rsvp-override-attending"
                :items="attendingOptions"
                value-key="value"
                placeholder="選擇出席狀態"
                class="w-full"
              />
            </UFormField>

            <UFormField label="覆寫原因" name="reason">
              <UTextarea
                v-model="overrideReason"
                data-testid="rsvp-override-reason"
                placeholder="變更出席狀態時請填寫原因"
                class="w-full"
              />
            </UFormField>

            <div class="my-2 h-px bg-line" />
            <p class="text-overline uppercase text-gold-deep">
              回覆內容（對齊賓客表單，可修正）
            </p>

            <!-- 與新人關係 -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="與新人關係" name="side">
                <USelectMenu
                  v-model="editForm.side"
                  data-testid="rsvp-edit-side"
                  :items="sideOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="身分類別" name="category">
                <UInput
                  v-model="editForm.category"
                  data-testid="rsvp-edit-category"
                  placeholder="家人 / 朋友 / 同事…"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="聯繫電話" name="contact">
              <UInput
                v-model="editForm.contact"
                data-testid="rsvp-edit-contact"
                placeholder="聯繫電話"
                class="w-full"
              />
            </UFormField>

            <div class="grid grid-cols-3 gap-4">
              <UFormField label="餐點" name="diet">
                <USelectMenu
                  v-model="editForm.diet"
                  data-testid="rsvp-edit-diet"
                  :items="dietOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="出席人數" name="partySize">
                <UInput
                  v-model.number="editForm.partySize"
                  data-testid="rsvp-edit-party-size"
                  type="number"
                  min="1"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="兒童椅" name="childChair">
                <UInput
                  v-model.number="editForm.childChairCount"
                  data-testid="rsvp-edit-child-chair"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="接駁車" name="shuttle">
                <USelectMenu
                  v-model="editForm.needsShuttle"
                  data-testid="rsvp-edit-shuttle"
                  :items="shuttleOptions"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
              <UFormField v-if="editForm.needsShuttle" label="搭車人數" name="shuttleCount">
                <UInput
                  v-model.number="editForm.shuttleCount"
                  data-testid="rsvp-edit-shuttle-count"
                  type="number"
                  min="0"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="喜帖需求" name="invitation">
              <USelectMenu
                v-model="editForm.invitation"
                data-testid="rsvp-edit-invitation"
                :items="invitationOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="editForm.invitation === 'physical'" label="寄送地址" name="address">
              <UTextarea
                v-model="editForm.mailingAddress"
                data-testid="rsvp-edit-address"
                placeholder="紙本喜帖寄送地址"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isOverriding"
                @click="isOverrideOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="rsvp-override-submit"
                color="primary"
                :loading="isOverriding"
                @click="confirmOverride"
              >
                送出
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 查看回覆詳情 Modal -->
    <UModal v-model:open="isDetailOpen">
      <template #content>
        <div
          v-if="detailTarget"
          data-testid="rsvp-detail-modal"
          class="max-h-[85vh] overflow-y-auto p-6"
        >
          <p class="text-overline uppercase text-gold-deep">
            RSVP Reply
          </p>
          <h3 class="mb-2 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            {{ detailTarget.name }} 的回覆
          </h3>
          <UBadge
            :color="rsvpBadge(detailTarget.rsvpAttending).color"
            variant="soft"
            size="sm"
            class="mb-4"
          >
            {{ rsvpBadge(detailTarget.rsvpAttending).label }}
          </UBadge>

          <dl class="divide-y divide-line dark:divide-neutral-800">
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                與新人關係
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                {{ relationshipText(detailTarget) }}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                聯繫電話
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                {{ detailTarget.contact || '未填' }}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                餐點
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                {{ detailTarget.diet === 'meat' ? '葷食' : '素食' }}
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                出席人數
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                共 {{ detailTarget.partySize }} 位（含兒童椅 {{ detailTarget.childChairCount }}）
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                接駁車
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                <span v-if="detailTarget.needsShuttle">需要 · {{ detailTarget.shuttleCount ?? 0 }} 位</span>
                <span v-else-if="detailTarget.needsShuttle === false">不需要</span>
                <span v-else class="text-ink-300">未填</span>
              </dd>
            </div>
            <div class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                喜帖需求
              </dt>
              <dd class="col-span-2 text-ink dark:text-paper">
                <template v-if="detailTarget.invitationPreference">
                  {{ invitationLabel[detailTarget.invitationPreference] }}
                  <span
                    v-if="detailTarget.invitationPreference === 'physical' && detailTarget.mailingAddress"
                    class="mt-1 block text-caption text-ink-500"
                  >
                    {{ detailTarget.mailingAddress }}
                  </span>
                </template>
                <span v-else class="text-ink-300">未填</span>
              </dd>
            </div>
            <div v-if="detailTarget.blessing" class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                祝福留言
              </dt>
              <dd class="col-span-2 whitespace-pre-line text-ink dark:text-paper">
                {{ detailTarget.blessing }}
              </dd>
            </div>
            <div
              v-for="entry in customAnswerEntries(detailTarget)"
              :key="entry.label"
              class="grid grid-cols-3 gap-4 py-3"
            >
              <dt class="text-caption text-gold-deep">
                {{ entry.label }}
              </dt>
              <dd class="col-span-2 whitespace-pre-line text-ink dark:text-paper">
                {{ entry.value }}
              </dd>
            </div>
            <div v-if="detailTarget.flowerDrawing" class="grid grid-cols-3 gap-4 py-3">
              <dt class="text-caption text-gold-deep">
                手繪小花
              </dt>
              <dd class="col-span-2 space-y-2">
                <img
                  :src="detailTarget.flowerDrawing"
                  alt="賓客手繪小花"
                  loading="lazy"
                  class="max-h-48 rounded-lg border border-line bg-paper-soft"
                >
                <UButton
                  data-testid="rsvp-flower-download"
                  icon="i-heroicons-arrow-down-tray"
                  color="primary"
                  variant="soft"
                  size="sm"
                  @click="downloadFlower(detailTarget)"
                >
                  下載 PNG（去背）
                </UButton>
              </dd>
            </div>
          </dl>

          <div class="flex justify-end pt-4">
            <UButton color="neutral" variant="outline" @click="isDetailOpen = false">
              關閉
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 刪除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認刪除"
      :description="`確定要刪除賓客「${removeTarget?.name ?? ''}」嗎？刪除後可從賓客名單回收區恢復。`"
      confirm-label="刪除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />
  </div>
</template>
