<!-- app/pages/weddings/[weddingId]/rundown.vue — 當天流程表：角色管理 + 矩陣草稿表（整表儲存）+ 範本帶入 + 分享/匯出 -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  RundownItemListItem,
  RundownRoleListItem,
  SaveRundownTableBody,
} from '~/types/api/rundown'

import { z } from 'zod'
import {
  createRundownRole,
  deleteRundownRole,
  listRundownItems,
  listRundownRoles,
  saveRundownTable,
  updateRundownRole,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 流程角色與項目（items GET 已排序：time null 置頂、其餘升冪）
const { data: roles, refresh: refreshRoles } = await listRundownRoles(weddingId, {
  default: () => [],
})
const { data: items, refresh: refreshItems } = await listRundownItems(weddingId, {
  default: () => [],
})

// roleId → 角色名對照（匯出抬頭用）
const roleNameMap = computed(() => new Map((roles.value ?? []).map(r => [r.roleId, r.name])))

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// === 矩陣草稿（items 是 useFetch 的 shallowRef：clone 成可深編輯的草稿，儲存/重抓後重建）===
// 草稿列：純 UI 狀態（API 合約型別一律 import ~/types/api/rundown，送出時轉 SaveRundownTableBody）
// - id 供 v-for 穩定 key：既有列＝rundownItemId、新列＝draft-N 臨時 id（送出時剔除）
// - roleTaskById 以 Record 表示角色欄：key 存在＝該角色參與此列；清空文字＝移除 entry
interface DraftRow {
  id: string
  rundownItemId?: string
  // '' ＝未定時段（送出轉 null；如「婚前一天」置頂列）
  time: string
  durationMinutes: number
  title: string
  location: string
  supplies: string
  note: string
  roleTaskById: Record<string, string>
  // 使用者標記列（底色強調，隨整表 PUT 持久化）
  highlight: boolean
}

let draftSeq = 0

function toDraftRows(list: RundownItemListItem[]): DraftRow[] {
  return structuredClone(toRaw(list)).map(item => ({
    id: item.rundownItemId,
    rundownItemId: item.rundownItemId,
    time: item.time ?? '',
    durationMinutes: item.durationMinutes,
    title: item.title,
    location: item.location ?? '',
    supplies: item.supplies ?? '',
    note: item.note ?? '',
    // 只保留有文字的個別事項（key 存在＝參與）
    roleTaskById: Object.fromEntries(
      item.roleTasks.filter(rt => rt.task !== '').map(rt => [rt.roleId, rt.task]),
    ),
    highlight: item.highlight ?? false,
  }))
}

const draft = ref<DraftRow[]>(toDraftRows(items.value ?? []))
// dirty 以序列化快照比對基準：任何格子編輯 / 增刪列 / 帶範本都會偏離基準
const draftBaseline = ref(JSON.stringify(draft.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== draftBaseline.value)

// 以 refresh 後的 items 重建草稿並同步基準（此時才呈現排序後順序）
function rebuildDraft() {
  draft.value = toDraftRows(items.value ?? [])
  draftBaseline.value = JSON.stringify(draft.value)
}

// 結束時間＝開始＋時長（僅顯示推算，編輯開始時間不即時重排，避免焦點跳走）
function endTimeOf(row: DraftRow): string {
  return row.time ? addMinutes(row.time, row.durationMinutes) : ''
}

// 使用者改結束時間 → 重算該列時長（訖−起，不可為負，跨值 clamp 0）
function onEndChange(row: DraftRow, end: string) {
  if (!row.time || !TIME_RE.test(end))
    return
  const [sh, sm] = row.time.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  row.durationMinutes = Math.max(0, eh! * 60 + em! - (sh! * 60 + sm!))
}

function roleTaskOf(row: DraftRow, roleId: string): string {
  return row.roleTaskById[roleId] ?? ''
}

function setRoleTask(row: DraftRow, roleId: string, task: string) {
  // 清空＝移除該角色 entry；有字＝寫入個別事項
  if (task === '')
    delete row.roleTaskById[roleId]
  else
    row.roleTaskById[roleId] = task
}

// 新增一列：append 於草稿尾端，不重排
function addRow() {
  draft.value.push({
    id: `draft-${++draftSeq}`,
    time: '',
    durationMinutes: 0,
    title: '',
    location: '',
    supplies: '',
    note: '',
    roleTaskById: {},
    highlight: false,
  })
}

function removeRow(row: DraftRow) {
  draft.value = draft.value.filter(r => r.id !== row.id)
}

// === 拖曳重排（時間格不動、只換內容）===
// 內容欄位（事項/場地/物品/備註/角色事項/時長/標記）隨拖曳搬家；
// id / rundownItemId / time 是「時間格」不變量 → 列陣列順序與 PUT 的 id 集合恆定，
// 不會破壞 .nth() 凍結定位，也絕不誤觸「未帶回＝刪除」合約
type RowContent = Pick<DraftRow, 'durationMinutes' | 'title' | 'location' | 'supplies' | 'note' | 'roleTaskById' | 'highlight'>

function pickContent(row: DraftRow): RowContent {
  return {
    durationMinutes: row.durationMinutes,
    title: row.title,
    location: row.location,
    supplies: row.supplies,
    note: row.note,
    roleTaskById: row.roleTaskById,
    highlight: row.highlight,
  }
}

const draggingRowIndex = ref<number | null>(null)
const dragOverRowIndex = ref<number | null>(null)

function onRowDragPointerDown(event: PointerEvent, index: number) {
  if (event.button !== 0)
    return
  draggingRowIndex.value = index
  dragOverRowIndex.value = index
  window.addEventListener('pointermove', onRowDragPointerMove)
  window.addEventListener('pointerup', onRowDragPointerUp, { once: true })
  event.preventDefault()
}
function onRowDragPointerMove(event: PointerEvent) {
  if (draggingRowIndex.value === null)
    return
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('tr[data-row-index]')
  if (!(el instanceof HTMLElement))
    return
  const idx = Number(el.dataset.rowIndex)
  if (Number.isInteger(idx))
    dragOverRowIndex.value = idx
}
function onRowDragPointerUp() {
  window.removeEventListener('pointermove', onRowDragPointerMove)
  const from = draggingRowIndex.value
  const to = dragOverRowIndex.value
  draggingRowIndex.value = null
  dragOverRowIndex.value = null
  if (from === null || to === null || from === to)
    return
  // 內容陣列搬家（shift 語意），回填固定時間槽位；訖時間由 endTimeOf 自動重算
  const contents = draft.value.map(pickContent)
  const [moved] = contents.splice(from, 1)
  contents.splice(to, 0, moved!)
  draft.value.forEach((row, i) => Object.assign(row, contents[i]))
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onRowDragPointerMove)
  window.removeEventListener('pointerup', onRowDragPointerUp)
})

// === 重置：捨棄草稿、還原到上次儲存（最後 GET 快照）===
const isResetOpen = ref(false)
function confirmReset() {
  rebuildDraft()
  isResetOpen.value = false
}

// === 角色篩選（「全部角色」用哨兵值：USelectMenu 禁止空字串 value，否則下拉打不開）===
const ALL_ROLES = '__all__'
const roleFilter = ref(ALL_ROLES)
const roleFilterOptions = computed(() => [
  { label: '全部角色', value: ALL_ROLES },
  ...(roles.value ?? []).map(r => ({ label: r.name, value: r.roleId })),
])
// 篩選中只渲染該角色參與的列（純 computed 過濾，不動草稿）
const visibleRows = computed(() => {
  if (roleFilter.value === ALL_ROLES)
    return draft.value
  return draft.value.filter(row => row.roleTaskById[roleFilter.value] !== undefined)
})
// 篩選中角色欄只顯示該角色（固定欄保留）
const visibleRoles = computed(() => {
  const list = roles.value ?? []
  if (roleFilter.value === ALL_ROLES)
    return list
  return list.filter(r => r.roleId === roleFilter.value)
})

// === 整表儲存（SaveRundownTable：既有列帶 rundownItemId、新列省略、未帶回＝刪除）===
const isSaving = ref(false)
const saveError = ref('')

function buildPayload(): SaveRundownTableBody {
  return {
    items: draft.value.map((row) => {
      const item: SaveRundownTableBody['items'][number] = {
        time: row.time || null,
        durationMinutes: row.durationMinutes,
        title: row.title,
        location: row.location,
        supplies: row.supplies,
        note: row.note,
        // 只送非空字串的個別事項
        roleTasks: Object.entries(row.roleTaskById)
          .filter(([, task]) => task.trim() !== '')
          .map(([roleId, task]) => ({ roleId, task })),
        highlight: row.highlight,
      }
      // 新列（draft- 臨時 id）不帶 rundownItemId，由後端配發
      if (row.rundownItemId)
        item.rundownItemId = row.rundownItemId
      return item
    }),
  }
}

async function saveTable() {
  if (isSaving.value)
    return
  isSaving.value = true
  saveError.value = ''
  try {
    await saveRundownTable(weddingId.value, buildPayload())
    toast.add({ title: '流程表已儲存', color: 'success' })
    // 重抓後重建草稿（呈現後端排序與配發的 id）
    await refreshItems()
    rebuildDraft()
  }
  catch (error: any) {
    // 驗證交後端（400「請輸入主要事項」「時間格式錯誤」），錯誤 inline 顯示
    saveError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isSaving.value = false
  }
}

// === 角色表單（新增/改名共用 Modal）===
const roleSchema = z.object({
  name: z.string().trim().min(1, '請輸入角色名稱'),
})
type RoleSchema = z.output<typeof roleSchema>

const isRoleFormOpen = ref(false)
const isRoleSubmitting = ref(false)
const roleFormError = ref('')
const editingRole = ref<RundownRoleListItem | null>(null)
const roleState = reactive<RoleSchema>({ name: '' })

function openRoleCreate() {
  editingRole.value = null
  roleState.name = ''
  roleFormError.value = ''
  isRoleFormOpen.value = true
}

function openRoleEdit(role: RundownRoleListItem) {
  editingRole.value = role
  roleState.name = role.name
  roleFormError.value = ''
  isRoleFormOpen.value = true
}

async function onRoleSubmit(event: FormSubmitEvent<RoleSchema>) {
  if (isRoleSubmitting.value)
    return
  isRoleSubmitting.value = true
  roleFormError.value = ''
  try {
    if (editingRole.value) {
      await updateRundownRole(weddingId.value, editingRole.value.roleId, { name: event.data.name })
      toast.add({ title: '角色已更新', color: 'success' })
    }
    else {
      await createRundownRole(weddingId.value, { name: event.data.name })
      toast.add({ title: '角色建立成功', color: 'success' })
    }
    isRoleFormOpen.value = false
    await refreshRoles()
  }
  catch (error: any) {
    // 失敗訊息（如「角色名稱已存在」）僅 inline 顯示，避免與 toast 重複
    roleFormError.value
      = error?.data?.message || error?.statusMessage || '儲存失敗，請稍後再試'
  }
  finally {
    isRoleSubmitting.value = false
  }
}

// === 角色移除（確認彈窗；後端級聯清理各列 roleTasks）===
const isRoleRemoveOpen = ref(false)
const isRoleRemoving = ref(false)
const removeRoleTarget = ref<RundownRoleListItem | null>(null)

function openRoleRemove(role: RundownRoleListItem) {
  removeRoleTarget.value = role
  isRoleRemoveOpen.value = true
}

async function confirmRoleRemove() {
  const role = removeRoleTarget.value
  if (!role || isRoleRemoving.value)
    return
  isRoleRemoving.value = true
  try {
    await deleteRundownRole(weddingId.value, role.roleId)
    toast.add({ title: '角色已移除', color: 'success' })
    // 若正篩選被移除的角色，回到全部
    if (roleFilter.value === role.roleId)
      roleFilter.value = ALL_ROLES
    isRoleRemoveOpen.value = false
    // 後端已級聯清掉各項目的 roleTasks，items 要重抓
    await Promise.all([refreshRoles(), refreshItems()])
    // 草稿鏡射級聯：移除該角色欄的 entry；原本乾淨才整份重建對齊（dirty 時保留未儲存編輯）
    const wasDirty = isDirty.value
    for (const row of draft.value)
      delete row.roleTaskById[role.roleId]
    if (!wasDirty)
      rebuildDraft()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
  finally {
    isRoleRemoving.value = false
  }
}

// === 帶入宴客段範本（前端推算，僅進草稿；再按儲存才整表 PUT）===
const isTemplateOpen = ref(false)
const templateStartTime = ref('18:00')
// 預覽隨開始時間即時推算；格式不完整時不渲染
const templatePreview = computed(() =>
  TIME_RE.test(templateStartTime.value) ? previewTemplateTimes(templateStartTime.value) : [],
)

function openTemplate() {
  isTemplateOpen.value = true
}

function applyTemplateToDraft() {
  const rows = buildTemplateRows(templateStartTime.value, roles.value ?? [])
  // append 於草稿尾端（不重排、不 PUT），關 modal 後由快照比對自然標 dirty
  draft.value.push(...rows.map(row => ({
    id: `draft-${++draftSeq}`,
    time: row.time ?? '',
    durationMinutes: row.durationMinutes ?? 0,
    title: row.title,
    location: row.location ?? '',
    supplies: row.supplies ?? '',
    note: row.note ?? '',
    roleTaskById: Object.fromEntries(
      (row.roleTasks ?? []).filter(rt => rt.task !== '').map(rt => [rt.roleId, rt.task]),
    ),
    highlight: false,
  })))
  isTemplateOpen.value = false
}

// === 複製分享連結（免登入公開頁；帶當前篩選角色）===
async function copyShareLink() {
  const query = roleFilter.value === ALL_ROLES ? '' : `?role=${roleFilter.value}`
  const url = `${window.location.origin}/rundown/${weddingId.value}${query}`
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: '已複製分享連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: url, color: 'error' })
  }
}

// === 下載 JPEG：以 canvas 畫當前篩選結果（起訖時間/標題/場地/各角色事項），沿用桌次圖匯出模式 ===
// A4 直式畫布尺寸（pt）；配色對齊 main.css 設計 token
const A4_W = 595
const A4_H = 842
const CHART = {
  paper: '#ffffff', // 列印白底
  ink: '#111111', // 主標 / 標題（ink）
  inkSoft: '#6B655C', // 角色事項（ink-500）
  inkFaint: '#A8A096', // 次要（ink-300）
  line: '#DCD4C7', // 分隔線（line）
  gold: '#B8965A', // 裝飾線（gold）
  goldDeep: '#9A7B43', // 時間（gold-deep）
} as const

function buildRundownCanvas(): HTMLCanvasElement {
  const list = visibleRows.value
  const M = 40
  const TITLE_H = 88
  const dpr = 4 // 高解析，列印清晰
  const canvas = document.createElement('canvas')
  canvas.width = A4_W * dpr
  canvas.height = A4_H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = CHART.paper
  ctx.fillRect(0, 0, A4_W, A4_H)
  const FONT = 'system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'

  // 抬頭：標題 +（篩選中的）角色名 + 金色裝飾線
  const filterName = roleFilter.value === ALL_ROLES ? '' : roleNameMap.value.get(roleFilter.value)
  ctx.fillStyle = CHART.ink
  ctx.font = `600 18px ${FONT}`
  ctx.fillText(filterName ? `婚禮當天流程表 · ${filterName}` : '婚禮當天流程表', M, 44)
  ctx.fillStyle = CHART.gold
  ctx.fillRect(M, 56, 32, 1.5)

  if (list.length === 0)
    return canvas

  // 列距隨筆數壓縮，確保單頁塞得下；字級同步縮放
  const availH = A4_H - TITLE_H - M
  const rowStep = Math.min(64, availH / list.length)
  const scale = rowStep / 64
  const f = (size: number) => Math.max(7, size * scale)
  const timeX = M
  const bodyX = M + 104
  const bodyW = A4_W - M - bodyX

  let y = TITLE_H
  for (const row of list) {
    const baseline = y + f(18)
    // 分隔線
    ctx.strokeStyle = CHART.line
    ctx.lineWidth = 0.75
    ctx.beginPath()
    ctx.moveTo(M, y)
    ctx.lineTo(A4_W - M, y)
    ctx.stroke()
    // 左欄：起訖時間（未定時段印「事前準備」）
    ctx.fillStyle = CHART.goldDeep
    ctx.font = `600 ${f(12)}px ${FONT}`
    ctx.fillText(row.time ? `${row.time}–${endTimeOf(row)}` : '事前準備', timeX, baseline)
    // 右欄：主要事項 + 場地 + 角色欄「角色名：事項」（單角色篩選只印該角色）
    ctx.fillStyle = CHART.ink
    ctx.font = `600 ${f(13)}px ${FONT}`
    ctx.fillText(row.title, bodyX, baseline, bodyW)
    let lineY = baseline
    if (row.location) {
      lineY += f(12)
      ctx.fillStyle = CHART.inkFaint
      ctx.font = `${f(9)}px ${FONT}`
      ctx.fillText(row.location, bodyX, lineY, bodyW)
    }
    const tasks = visibleRoles.value
      .map(r => ({ name: r.name, task: row.roleTaskById[r.roleId] ?? '' }))
      .filter(entry => entry.task !== '')
      .map(entry => `${entry.name}：${entry.task}`)
    if (tasks.length > 0) {
      lineY += f(12)
      ctx.fillStyle = CHART.inkSoft
      ctx.font = `${f(10)}px ${FONT}`
      ctx.fillText(tasks.join(' ／ '), bodyX, lineY, bodyW)
    }
    y += rowStep
  }
  return canvas
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadRundownJpeg() {
  buildRundownCanvas().toBlob(
    (blob) => {
      if (blob)
        triggerDownload(blob, `當天流程表-${weddingId.value}.jpg`)
      else
        toast.add({ title: '產生圖片失敗，請稍後再試', color: 'error' })
    },
    'image/jpeg',
    0.92,
  )
}
</script>

<template>
  <div data-testid="rundown-page" class="flex h-full flex-col">
    <PageHeader
      title="當天流程"
      eyebrow="Wedding Day Rundown"
      description="以矩陣表安排婚禮當天時段與各角色分工，分享給團隊照表執行"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <UButton
            data-testid="rundown-copy-link"
            icon="i-heroicons-link"
            color="neutral"
            variant="outline"
            @click="copyShareLink"
          >
            複製分享連結
          </UButton>
          <UButton
            data-testid="rundown-download-jpeg"
            icon="i-heroicons-photo"
            color="neutral"
            variant="outline"
            @click="downloadRundownJpeg"
          >
            下載 JPEG
          </UButton>
          <UButton
            data-testid="rundown-apply-template"
            icon="i-heroicons-sparkles"
            color="neutral"
            variant="outline"
            @click="openTemplate"
          >
            帶入宴客段範本
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 按鈕列與角色區固定，只有矩陣表格自帶捲軸（捲軸不再蓋到上方按鈕） -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- 角色管理：膠囊卡片（名稱 + 改名/移除） -->
      <section class="mb-8 shrink-0">
        <div class="mb-4 flex items-center justify-between">
          <p class="text-overline uppercase text-gold-deep">
            工作人員角色
          </p>
          <UButton
            data-testid="rundown-role-create"
            icon="i-heroicons-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openRoleCreate"
          >
            新增角色
          </UButton>
        </div>

        <div v-if="(roles?.length ?? 0) > 0" class="flex flex-wrap gap-2.5">
          <div
            v-for="role in roles"
            :key="role.roleId"
            role="article"
            :aria-label="role.name"
            class="flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-4 pr-1.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span class="mr-1 text-body font-medium text-ink dark:text-paper">{{ role.name }}</span>
            <UButton
              icon="i-heroicons-pencil-square"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`編輯 ${role.name}`"
              @click="openRoleEdit(role)"
            />
            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="`移除 ${role.name}`"
              @click="openRoleRemove(role)"
            />
          </div>
        </div>
        <p v-else class="text-body text-ink-300">
          尚無角色，點「新增角色」建立第一個工作人員角色
        </p>
      </section>

      <!-- 流程矩陣表：列＝時間段、固定欄＋每角色一欄，表格內直接編輯草稿 -->
      <section class="flex min-h-0 flex-1 flex-col">
        <div class="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <p class="text-overline uppercase text-gold-deep">
            流程矩陣表
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <USelectMenu
              v-model="roleFilter"
              data-testid="rundown-role-filter"
              :items="roleFilterOptions"
              value-key="value"
              class="w-44"
            />
            <span v-if="isDirty" class="text-caption text-gold-deep">尚未儲存</span>
            <!-- 重置：捨棄未儲存草稿、還原到上次儲存（命名避開凍結 regex：新增/帶入/範本/儲存/送出/確定） -->
            <UButton
              data-testid="rundown-reset"
              icon="i-heroicons-arrow-uturn-left"
              color="neutral"
              variant="outline"
              :disabled="!isDirty || isSaving"
              @click="isResetOpen = true"
            >
              重置
            </UButton>
            <UButton
              data-testid="rundown-save"
              icon="i-heroicons-check"
              color="neutral"
              :variant="isDirty ? 'solid' : 'outline'"
              :loading="isSaving"
              @click="saveTable"
            >
              儲存流程表
            </UButton>
          </div>
        </div>

        <UAlert
          v-if="saveError"
          data-testid="rundown-save-error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="saveError"
          class="mb-4"
        />

        <div
          v-if="visibleRows.length > 0"
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <table class="w-full border-collapse text-body">
            <thead>
              <tr class="border-b border-line bg-cream/60 dark:border-neutral-800 dark:bg-neutral-800/40">
                <!-- 拖曳把手欄（僅全部角色視圖；篩選中 index 對不上完整草稿） -->
                <th v-if="roleFilter === ALL_ROLES" class="sticky top-0 z-10 w-8 bg-cream px-1 py-2 dark:bg-neutral-800">
                  <span class="sr-only">拖曳排序</span>
                </th>
                <th class="w-28 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  開始
                </th>
                <th class="w-28 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  結束
                </th>
                <th class="min-w-40 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  主要事項
                </th>
                <th class="min-w-28 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  場地
                </th>
                <th class="min-w-32 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  物品
                </th>
                <th class="min-w-32 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  備註
                </th>
                <th
                  v-for="role in visibleRoles"
                  :key="role.roleId"
                  class="min-w-36 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-gold-deep dark:border-neutral-800"
                >
                  {{ role.name }}
                </th>
                <th class="sticky top-0 z-10 w-20 bg-cream px-2 py-2 dark:bg-neutral-800">
                  <span class="sr-only">列操作</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in visibleRows"
                :key="row.id"
                :data-row-index="idx"
                class="border-b border-line last:border-b-0 dark:border-neutral-800"
                :class="[
                  row.highlight ? 'bg-gold-light/20 hover:bg-gold-light/30 dark:bg-gold-deep/15' : 'hover:bg-cream/40 dark:hover:bg-neutral-800/30',
                  dragOverRowIndex === idx && draggingRowIndex !== null && draggingRowIndex !== idx && 'border-t-2 border-t-gold',
                ]"
              >
                <!-- 拖曳把手：時間格不動、只搬內容 -->
                <td v-if="roleFilter === ALL_ROLES" class="p-1 text-center">
                  <button
                    type="button"
                    data-testid="rundown-row-drag"
                    class="cursor-grab touch-none rounded p-1 text-ink-300 hover:text-ink active:cursor-grabbing dark:hover:text-paper"
                    :class="draggingRowIndex === idx && 'text-gold-deep'"
                    :aria-label="`拖曳調整 ${row.title || '此列'} 順序`"
                    @pointerdown="onRowDragPointerDown($event, idx)"
                  >
                    <UIcon name="i-heroicons-bars-2" class="size-4" />
                  </button>
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <!-- [&_input::...] 隱藏原生 time picker icon；保持 type=time（凍結 fill('17:30') 依賴值格式） -->
                  <UInput
                    v-model="row.time"
                    data-testid="rundown-cell-time"
                    type="time"
                    variant="ghost"
                    size="sm"
                    class="w-full [&_input::-webkit-calendar-picker-indicator]:hidden"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UInput
                    :model-value="endTimeOf(row)"
                    data-testid="rundown-cell-end"
                    type="time"
                    variant="ghost"
                    size="sm"
                    :disabled="!row.time"
                    class="w-full [&_input::-webkit-calendar-picker-indicator]:hidden"
                    @update:model-value="onEndChange(row, String($event))"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UInput
                    v-model="row.title"
                    data-testid="rundown-cell-title"
                    variant="ghost"
                    size="sm"
                    placeholder="主要事項"
                    class="w-full"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UInput
                    v-model="row.location"
                    data-testid="rundown-cell-location"
                    variant="ghost"
                    size="sm"
                    placeholder="場地"
                    class="w-full"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UInput
                    v-model="row.supplies"
                    data-testid="rundown-cell-supplies"
                    variant="ghost"
                    size="sm"
                    placeholder="物品"
                    class="w-full"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UInput
                    v-model="row.note"
                    data-testid="rundown-cell-note"
                    variant="ghost"
                    size="sm"
                    placeholder="備註"
                    class="w-full"
                  />
                </td>
                <td
                  v-for="role in visibleRoles"
                  :key="role.roleId"
                  class="border-r border-line p-1 dark:border-neutral-800"
                >
                  <UInput
                    :model-value="roleTaskOf(row, role.roleId)"
                    :data-testid="`rundown-cell-role-${role.roleId}`"
                    variant="ghost"
                    size="sm"
                    :placeholder="role.name"
                    class="w-full"
                    @update:model-value="setRoleTask(row, role.roleId, String($event))"
                  />
                </td>
                <td class="p-1 text-center">
                  <div class="flex items-center justify-center gap-0.5">
                    <!-- 標記此列（highlight 底色，隨儲存持久化） -->
                    <UButton
                      data-testid="rundown-row-highlight"
                      :icon="row.highlight ? 'i-heroicons-star-20-solid' : 'i-heroicons-star'"
                      :color="row.highlight ? 'primary' : 'neutral'"
                      variant="ghost"
                      size="xs"
                      :aria-label="`標記 ${row.title || '此列'}`"
                      @click="row.highlight = !row.highlight"
                    />
                    <UButton
                      data-testid="rundown-row-delete"
                      icon="i-heroicons-trash"
                      color="error"
                      variant="ghost"
                      size="xs"
                      :aria-label="`刪除 ${row.title || '此列'}`"
                      @click="removeRow(row)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="i-heroicons-clock"
          title="尚無流程安排"
          :description="roleFilter === ALL_ROLES
            ? '點「新增一列」建立，或用「帶入宴客段範本」快速起步'
            : '此角色目前沒有參與的時段'"
        />

        <div class="mt-3 flex shrink-0 items-center justify-between">
          <UButton
            icon="i-heroicons-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="addRow"
          >
            新增一列
          </UButton>
          <span class="text-caption text-ink-300">共 {{ visibleRows.length }} 段</span>
        </div>
      </section>
    </div>

    <!-- 重置確認：捨棄未儲存草稿 -->
    <ConfirmModal
      v-model:open="isResetOpen"
      title="重置流程表"
      description="將捨棄尚未儲存的變更，還原到上次儲存的內容。"
      confirm-label="還原"
      confirm-color="error"
      @confirm="confirmReset"
    />

    <!-- 角色表單 Modal（新增 / 改名） -->
    <UModal v-model:open="isRoleFormOpen">
      <template #content>
        <div data-testid="rundown-role-form" class="p-6">
          <h3 class="mb-4 font-display text-h2 font-semibold text-ink dark:text-paper">
            {{ editingRole ? '角色改名' : '新增角色' }}
          </h3>

          <UAlert
            v-if="roleFormError"
            data-testid="rundown-role-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="roleFormError"
            class="mb-4"
          />

          <UForm :schema="roleSchema" :state="roleState" class="space-y-4" @submit="onRoleSubmit">
            <UFormField
              label="角色名稱"
              name="name"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="roleState.name"
                data-testid="rundown-role-name"
                placeholder="如：接待、總場控"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isRoleSubmitting"
                @click="isRoleFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="rundown-role-submit"
                color="neutral"
                variant="solid"
                :loading="isRoleSubmitting"
              >
                {{ editingRole ? '儲存' : '新增' }}
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 帶入宴客段範本 Modal（前端推算預覽，帶入僅進草稿） -->
    <UModal v-model:open="isTemplateOpen">
      <template #content>
        <div data-testid="rundown-template-form" class="p-6">
          <h3 class="mb-2 font-display text-h2 font-semibold text-ink dark:text-paper">
            帶入宴客段範本
          </h3>
          <p class="mb-4 text-body text-ink-500 dark:text-neutral-400">
            此為第一段（彩排）開始時間，其餘各段依前段時長自動累加；帶入後可在表格自由調整，按「儲存流程表」才會生效
          </p>

          <UFormField label="開始時間" class="mb-4">
            <UInput
              v-model="templateStartTime"
              type="time"
              class="w-full"
            />
          </UFormField>

          <!-- 範本時段預覽：隨輸入即時推算起訖 -->
          <div
            data-testid="rundown-template-preview"
            class="mb-6 rounded-lg border border-line bg-cream/50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
          >
            <p v-if="templatePreview.length === 0" class="text-caption text-ink-300">
              請先填開始時間
            </p>
            <ol v-else class="space-y-1.5">
              <li
                v-for="seg in templatePreview"
                :key="seg.title"
                class="flex items-baseline gap-3 text-body"
              >
                <span class="w-26 flex-none font-medium text-gold-deep">{{ seg.start }}–{{ seg.end }}</span>
                <span class="text-ink dark:text-paper">{{ seg.title }}</span>
              </li>
            </ol>
          </div>

          <div class="flex justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="isTemplateOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="rundown-template-submit"
              color="neutral"
              variant="solid"
              :disabled="templatePreview.length === 0"
              @click="applyTemplateToDraft"
            >
              帶入
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 角色移除確認 -->
    <ConfirmModal
      v-model:open="isRoleRemoveOpen"
      title="確認移除角色"
      :description="`確定要移除角色「${removeRoleTarget?.name ?? ''}」嗎？各時段中此角色的個別事項將一併清除。`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRoleRemoving"
      @confirm="confirmRoleRemove"
    />
  </div>
</template>
