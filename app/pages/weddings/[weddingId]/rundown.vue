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
  getRundownShortLink,
  getWedding,
  listRundownItems,
  listRundownRoles,
  reorderRundownRoles,
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
// 婚禮名稱、日期、場地：匯出的抬頭用（分得出是哪一場）
const { data: wedding } = await getWedding(weddingId)

// roleId → 角色名對照（匯出抬頭用）
const roleNameMap = computed(() => new Map((roles.value ?? []).map(r => [r.roleId, r.name])))

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// === 矩陣草稿（items 是 useFetch 的 shallowRef：clone 成可深編輯的草稿，儲存/重抓後重建）===
// 草稿列：純 UI 狀態（API 合約型別一律 import ~/types/api/rundown，送出時轉 SaveRundownTableBody）
// - id 供 v-for 穩定 key：既有列＝rundownItemId、新列＝draft-N 臨時 id（送出時剔除）
// - roleTaskById 以 Record 表示角色欄：key 存在＝該角色參與此列；清空文字＝移除 entry
// - roleSuppliesById：各角色自己要帶的物品（issue #188），規則同上；事項或物品任一有字＝參與
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
  roleSuppliesById: Record<string, string>
  // 使用者標記列（底色強調，隨整表 PUT 持久化）
  highlight: boolean
  // 對賓客公開此時段（賓客版流程頁 /schedule 只呈現勾選的列）
  guestVisible: boolean
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
    // 只保留有文字的個別事項與物品（key 存在＝參與）
    roleTaskById: Object.fromEntries(
      item.roleTasks.filter(rt => rt.task !== '').map(rt => [rt.roleId, rt.task]),
    ),
    roleSuppliesById: Object.fromEntries(
      item.roleTasks.filter(rt => rt.supplies).map(rt => [rt.roleId, rt.supplies!]),
    ),
    highlight: item.highlight ?? false,
    guestVisible: item.guestVisible ?? false,
  }))
}

const draft = ref<DraftRow[]>(toDraftRows(items.value ?? []))
// dirty 以序列化快照比對基準：任何格子編輯 / 增刪列 / 帶範本都會偏離基準
const draftBaseline = ref(JSON.stringify(draft.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== draftBaseline.value)

// 刪除列的「復原」提示（見 removeRow）：草稿重建後舊列已不屬於這份草稿，提示一併收掉
const undoToastIds = new Set<string | number>()
// 復原用的順序紀錄：目前草稿＋還能復原的已刪列，照刪除前的相對位置排在一起。
// 每次刪除時重算，復原時照這份紀錄找位置——不論刪除與復原的先後順序，都能回到原位
const pendingDeletedIds = new Set<string>()
let undoOrder: string[] = []

// 以 refresh 後的 items 重建草稿並同步基準（此時才呈現排序後順序）
function rebuildDraft() {
  draft.value = toDraftRows(items.value ?? [])
  draftBaseline.value = JSON.stringify(draft.value)
  undoToastIds.forEach(id => toast.remove(id))
  undoToastIds.clear()
  pendingDeletedIds.clear()
  undoOrder = []
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

function roleSuppliesOf(row: DraftRow, roleId: string): string {
  return row.roleSuppliesById[roleId] ?? ''
}

function setRoleSupplies(row: DraftRow, roleId: string, supplies: string) {
  if (supplies === '')
    delete row.roleSuppliesById[roleId]
  else
    row.roleSuppliesById[roleId] = supplies
}

// 該角色是否參與此列：事項或自己的物品任一有字
function hasRole(row: DraftRow, roleId: string): boolean {
  return row.roleTaskById[roleId] !== undefined || row.roleSuppliesById[roleId] !== undefined
}

function createDraftRow(time = ''): DraftRow {
  return {
    id: `draft-${++draftSeq}`,
    time,
    durationMinutes: 0,
    title: '',
    location: '',
    supplies: '',
    note: '',
    roleTaskById: {},
    roleSuppliesById: {},
    highlight: false,
    guestVisible: false,
  }
}

// 新增一列：append 於草稿尾端，不重排。按鈕在表格上方的工具列，加完把表格捲到底讓新列露出來
const tableScroll = useTemplateRef<HTMLDivElement>('tableScroll')
async function addRow() {
  draft.value.push(createDraftRow())
  await nextTick()
  tableScroll.value?.scrollTo({ top: tableScroll.value.scrollHeight })
}

// 賓客欄說明（表頭資訊圖示的提示，issue #207 自工具列搬來，放在它解釋的欄位旁）：
// 滑鼠停留／鍵盤聚焦由 UTooltip 處理，觸控裝置沒有 hover，點一下也要開
const isGuestColumnHelpOpen = ref(false)

// 指定列上下插入（issue #192）：新列預帶相鄰時間——往上＝該列開始、往下＝該列結束。
// 儲存後 GET 依開始時間重排，沒時間的列會被排到最上面，預帶時間新列才留得住位置
function insertRow(row: DraftRow, position: 'above' | 'below') {
  const index = draft.value.findIndex(r => r.id === row.id)
  if (index === -1)
    return
  const time = position === 'above' ? row.time : endTimeOf(row)
  draft.value.splice(position === 'above' ? index : index + 1, 0, createDraftRow(time))
}

// 刪除只動草稿（儲存才生效）。誤刪時原本只能「放棄變更」、會連其他改動一起丟，
// 所以提示上給「復原」，把該列插回原位置（issue #207）
// 把還沒復原的已刪列，依上一份順序紀錄插回目前草稿的順序中（插在它原本前一列的後面）
function mergeUndoOrder(): string[] {
  const order = draft.value.map(r => r.id)
  undoOrder.forEach((id, i) => {
    if (!pendingDeletedIds.has(id) || order.includes(id))
      return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(undoOrder[j]!)
      if (k !== -1) {
        at = k + 1
        break
      }
    }
    order.splice(at, 0, id)
  })
  return order
}
function removeRow(row: DraftRow) {
  if (!draft.value.some(r => r.id === row.id))
    return
  undoOrder = mergeUndoOrder()
  pendingDeletedIds.add(row.id)
  draft.value = draft.value.filter(r => r.id !== row.id)
  const { id } = toast.add({
    title: '已刪除一列',
    description: row.title || undefined,
    duration: 8000,
    actions: [{
      label: '復原',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        undoToastIds.delete(id)
        pendingDeletedIds.delete(row.id)
        if (draft.value.some(r => r.id === row.id))
          return
        // 插在紀錄中「後面第一個還在草稿裡的列」前面；後面都不在了，就插在「前面最近一個還在的列」後面
        const rows = [...draft.value]
        const pos = undoOrder.indexOf(row.id)
        const nextAt = undoOrder.slice(pos + 1).map(rid => rows.findIndex(r => r.id === rid)).find(k => k !== -1)
        const prevAt = undoOrder.slice(0, Math.max(pos, 0)).reverse().map(rid => rows.findIndex(r => r.id === rid)).find(k => k !== -1)
        rows.splice(nextAt ?? (prevAt === undefined ? rows.length : prevAt + 1), 0, row)
        draft.value = rows
      },
    }],
  })
  undoToastIds.add(id)
}

// === 拖曳重排（整列一起搬，時間與時長跟著走）===
// 舊做法「時間格不動、只換內容」會讓時長跟著內容走、起始時間留在原位，訖時間全部錯位；
// 沒填時間的新列拖上去還會把最後一列擠進無時間的格子。改為整列搬，每列保留自己的起訖。
// 只改草稿順序，PUT 的 id 集合不變（不觸發「未帶回＝刪除」）；儲存後 GET 仍依時間排序

const { draggingIndex: draggingRowIndex, overIndex: dragOverRowIndex, start: onRowDragPointerDown } = usePointerReorder('row-index', (from, to) => {
  // shift 語意：抽出拖曳列，插到目標位置
  const rows = [...draft.value]
  const [moved] = rows.splice(from, 1)
  rows.splice(to, 0, moved!)
  draft.value = rows
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
  return draft.value.filter(row => hasRole(row, roleFilter.value))
})
// 篩選中的角色（頁首「分享」選單據此決定發角色連結或全部總覽）
const filteredRole = computed(() =>
  (roles.value ?? []).find(r => r.roleId === roleFilter.value) ?? null,
)
// 篩選中角色欄只顯示該角色（固定欄保留）
const visibleRoles = computed(() => {
  const list = roles.value ?? []
  if (roleFilter.value === ALL_ROLES)
    return list
  return list.filter(r => r.roleId === roleFilter.value)
})

// === 凍結左欄（issue #207）：往右捲到角色欄時，把手、開始、結束、主要事項固定在左邊 ===
// 四欄固定寬度（w-14／w-24／w-24／w-48），left 位移照寬度累加；篩選單一角色時沒有把手欄，位移少一格。
// 只在 lg 以上凍結：窄螢幕凍結四欄會佔掉大半畫面
const frozenLeft = computed(() => roleFilter.value === ALL_ROLES
  ? { start: 'lg:left-14', end: 'lg:left-38', title: 'lg:left-62' }
  : { start: 'lg:left-0', end: 'lg:left-24', title: 'lg:left-48' })
// 凍結格要不透明（否則捲過去的角色欄文字會透出來）：白底上疊一層與該列相同的淡色
function frozenTint(row: DraftRow): string {
  return row.highlight
    ? 'from-gold-light/20 to-gold-light/20 group-hover:from-gold-light/30 group-hover:to-gold-light/30'
    : 'from-transparent to-transparent group-hover:from-cream/40 group-hover:to-cream/40'
}

// === 「調整順序」選單（issue #207）：角色欄的左右順序與顯示開關集中在一處 ===
// 顯示開關（issue #194）只影響這台裝置的畫面：不動草稿（隱藏欄的內容照樣儲存）、不影響匯出與角色連結。
// 存 cookie（每場婚禮各一份）：重整後維持；單一角色篩選時一律顯示該角色，不受隱藏影響
const hiddenRoleIds = useCookie<string[]>(`rundown-hidden-roles-${weddingId.value}`, {
  default: () => [],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const hiddenRoleCount = computed(() => (roles.value ?? []).filter(r => hiddenRoleIds.value.includes(r.roleId)).length)
const matrixRoles = computed(() => {
  if (roleFilter.value !== ALL_ROLES)
    return visibleRoles.value
  return visibleRoles.value.filter(r => !hiddenRoleIds.value.includes(r.roleId))
})
function setRoleColumnVisible(roleId: string, visible: boolean) {
  hiddenRoleIds.value = visible
    ? hiddenRoleIds.value.filter(id => id !== roleId)
    : [...hiddenRoleIds.value, roleId]
}
function showAllRoleColumns() {
  hiddenRoleIds.value = []
}

// 左右順序存進婚禮資料：後台矩陣、工作人員總覽頁、匯出大表都照這個順序。
// 拖曳放開就先換畫面再送出，失敗才換回原順序（排序與草稿無關，不必等「儲存流程表」）
const { draggingIndex: draggingRoleIndex, overIndex: dragOverRoleIndex, start: onRoleDragPointerDown } = usePointerReorder('role-index', onRoleReorder)
// 上一個排序還沒回來就不收新的：兩個請求交錯時，晚到的舊回應會蓋掉新順序、舊請求失敗的回滾也會蓋掉新的成功結果
const isRoleReordering = ref(false)
async function onRoleReorder(from: number, to: number) {
  if (isRoleReordering.value)
    return
  isRoleReordering.value = true
  const previous = roles.value ?? []
  const next = [...previous]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  roles.value = next
  try {
    roles.value = await reorderRundownRoles(weddingId.value, { roleIds: next.map(r => r.roleId) })
  }
  catch (error: any) {
    roles.value = previous
    const message = error?.data?.message || error?.statusMessage || '請稍後再試'
    toast.add({ title: '角色順序沒有存到', description: message, color: 'error' })
  }
  finally {
    isRoleReordering.value = false
  }
}
// 鍵盤：把手聚焦後按 ↑／↓ 上下移一格（只有指標拖曳的話，鍵盤使用者沒辦法排序）。
// 清單重排會讓焦點掉到 body，排完把焦點還給同一個角色的把手，才能連續按
async function onRoleHandleKeydown(event: KeyboardEvent, idx: number) {
  const to = event.key === 'ArrowUp' ? idx - 1 : event.key === 'ArrowDown' ? idx + 1 : -1
  if (to < 0 || to >= (roles.value?.length ?? 0))
    return
  event.preventDefault()
  if (isRoleReordering.value)
    return
  const roleId = roles.value![idx]!.roleId
  await onRoleReorder(idx, to)
  await nextTick()
  document.querySelector<HTMLElement>(`[data-role-handle="${roleId}"]`)?.focus()
}

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
        // 只送事項或物品有字的角色；物品空白不帶
        roleTasks: Array.from(new Set([...Object.keys(row.roleTaskById), ...Object.keys(row.roleSuppliesById)]), (roleId) => {
          const rawTask = row.roleTaskById[roleId] ?? ''
          const task = rawTask.trim() === '' ? '' : rawTask
          const supplies = (row.roleSuppliesById[roleId] ?? '').trim()
          return { roleId, task, ...(supplies ? { supplies } : {}) }
        })
          .filter(rt => rt.task !== '' || rt.supplies),
        highlight: row.highlight,
        guestVisible: row.guestVisible,
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

// Cmd/Ctrl+S 儲存（issue #207）：在格子裡打字時也能用；沒有改動或正在儲存時不動作
defineShortcuts({
  meta_s: {
    usingInput: true,
    handler: () => {
      if (isDirty.value && !isSaving.value)
        void saveTable()
    },
  },
})

// === 未儲存改動的防護（issue #207）：整表儲存制，沒存就離開會整份不見 ===
// 站內換頁：先攔下、問過才放行；重新整理／關分頁：交給瀏覽器的離開確認。
// 用婚禮切換器從 A 婚禮切到 B 婚禮是同一條路由換參數，不會觸發 leave，另用 update 攔 weddingId 變更
const isLeaveOpen = ref(false)
let pendingLeavePath = ''
let isLeaveConfirmed = false
function guardUnsaved(to: { fullPath: string }) {
  if (isLeaveConfirmed) {
    // 確認過的那一次放行後就重置：同一個頁面實例被沿用時，下一次離開仍要詢問
    isLeaveConfirmed = false
    return true
  }
  if (!isDirty.value)
    return true
  pendingLeavePath = to.fullPath
  isLeaveOpen.value = true
  return false
}
onBeforeRouteLeave(to => guardUnsaved(to))
onBeforeRouteUpdate((to, from) => (to.params.weddingId === from.params.weddingId ? true : guardUnsaved(to)))
async function confirmLeave() {
  isLeaveConfirmed = true
  isLeaveOpen.value = false
  await navigateTo(pendingLeavePath)
}
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (isDirty.value)
    event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  // 「復原」提示掛在全域，頁面卸載後按下去也救不回任何列，一併收掉
  undoToastIds.forEach(id => toast.remove(id))
})

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

// === 角色管理彈窗（issue #207）：矩陣表是主要工作區，角色區塊不再常駐頁面、佔掉表格高度 ===
const isRolesModalOpen = ref(false)

// === 角色移除（清單項目上兩段式 inline 確認；後端級聯清理各列 roleTasks）===
// 不再疊一層 ConfirmModal：新開的 modal（Reka Dialog）會把其餘內容設 aria-hidden，
// 角色項目會從 accessibility tree 消失——外部觀察者（e2e 以 role 定位）會誤判
// 「角色已移除」而在級聯完成前搶讀；inline 確認讓項目持續可見直到 refresh 完成
const roleRemoveConfirmId = ref<string | null>(null)
const isRoleRemoving = ref(false)

async function confirmRoleRemove(role: RundownRoleListItem) {
  if (isRoleRemoving.value)
    return
  isRoleRemoving.value = true
  try {
    await deleteRundownRole(weddingId.value, role.roleId)
    toast.add({ title: '角色已移除', color: 'success' })
    // 若正篩選被移除的角色，回到全部
    if (roleFilter.value === role.roleId)
      roleFilter.value = ALL_ROLES
    // 後端已級聯清掉各項目的 roleTasks，items 要重抓
    await Promise.all([refreshRoles(), refreshItems()])
    // 草稿鏡射級聯：移除該角色欄的 entry；原本乾淨才整份重建對齊（dirty 時保留未儲存編輯）
    const wasDirty = isDirty.value
    for (const row of draft.value) {
      delete row.roleTaskById[role.roleId]
      delete row.roleSuppliesById[role.roleId]
    }
    if (!wasDirty)
      rebuildDraft()
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
  finally {
    isRoleRemoving.value = false
    roleRemoveConfirmId.value = null
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
    roleSuppliesById: {},
    highlight: false,
    // 範本自帶賓客可見預設（賓客在場的段落才勾），新人仍可逐列調整
    guestVisible: row.guestVisible ?? false,
  })))
  isTemplateOpen.value = false
}

// === 複製分享連結（免登入公開頁）===
// 帶角色＝角色版（只看該角色那份，issue #188）；不帶＝全部角色總覽（issue #190）。
// 發短網址 /s/<code>（issue #207）：簽章在轉址時才現算，網址短、轉傳也不會帶出簽章；同一種連結永遠同一個短碼
async function copyRundownLink(role: RundownRoleListItem | null) {
  try {
    const { code } = await getRundownShortLink(weddingId.value, role?.roleId)
    const url = `${window.location.origin}/s/${code}`
    await navigator.clipboard.writeText(url)
    toast.add({ title: role ? `已複製「${role.name}」的連結` : '已複製工作人員總覽連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: '請稍後再試', color: 'error' })
  }
}

// 頁首「分享」選單：篩選單一角色時複製該角色的連結，否則複製工作人員總覽
const shareItems = computed(() => [[
  {
    label: filteredRole.value ? `複製「${filteredRole.value.name}」的連結` : '複製工作人員總覽連結',
    icon: 'i-heroicons-link',
    onSelect: () => void copyRundownLink(filteredRole.value),
  },
  { label: '預覽賓客版', icon: 'i-heroicons-eye', to: `/schedule/${weddingId.value}`, target: '_blank' },
]])

// === 匯出（issue #207）：完整大表長圖／Excel 含全部時段與角色（照角色順序）；篩選單一角色時另有只含該角色的長圖 ===
const { exportItems } = useRundownExport({
  wedding,
  isDirty,
  allRows: draft,
  allRoles: () => roles.value ?? [],
  filteredRows: visibleRows,
  filteredRoles: visibleRoles,
  filterName: () => (roleFilter.value === ALL_ROLES ? '' : roleNameMap.value.get(roleFilter.value) ?? ''),
})
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
          <!-- 分享（issue #207）：複製連結與預覽賓客版都是「給別人看」，收進同一個選單；各角色的連結在角色彈窗裡 -->
          <UDropdownMenu :items="shareItems" :content="{ align: 'end' }">
            <UButton
              icon="i-heroicons-share"
              color="neutral"
              variant="outline"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            >
              分享
            </UButton>
          </UDropdownMenu>
          <UDropdownMenu :items="exportItems" :content="{ align: 'end' }">
            <UButton
              icon="i-heroicons-arrow-down-tray"
              color="neutral"
              variant="outline"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            >
              匯出流程表
            </UButton>
          </UDropdownMenu>
          <UButton
            data-testid="rundown-apply-template"
            icon="i-heroicons-sparkles"
            color="neutral"
            variant="ghost"
            @click="openTemplate"
          >
            帶入宴客段範本
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 工具列固定，只有矩陣表格自帶捲軸（捲軸不再蓋到上方按鈕）；角色管理收進彈窗（issue #207），高度全給表格 -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- 流程矩陣表：列＝時間段、固定欄＋每角色一欄，表格內直接編輯草稿 -->
      <section class="flex min-h-0 flex-1 flex-col">
        <div class="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <!-- 左群「怎麼看這張表」（角色、調整順序、篩選）；右群「編輯這張表」（放棄變更、新增、儲存） -->
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              icon="i-heroicons-user-group"
              color="neutral"
              variant="outline"
              @click="isRolesModalOpen = true"
            >
              工作人員角色
              <span class="text-ink-300">{{ (roles ?? []).length }}</span>
            </UButton>
            <UPopover :content="{ align: 'start' }">
              <UButton
                icon="i-heroicons-arrows-up-down"
                color="neutral"
                variant="outline"
                :disabled="(roles?.length ?? 0) === 0"
              >
                調整順序
                <span v-if="hiddenRoleCount > 0" class="text-ink-300">隱藏 {{ hiddenRoleCount }}</span>
              </UButton>
              <template #content>
                <div class="w-72 p-3">
                  <p class="mb-2 px-1 text-caption text-ink-500">
                    勾選要顯示的角色欄；按住把手上下拖曳，或聚焦把手後按上下方向鍵，調整左右順序（順序所有人共用）
                  </p>
                  <ul>
                    <li
                      v-for="(role, idx) in roles"
                      :key="role.roleId"
                      :data-role-index="idx"
                      class="flex items-center gap-1 rounded py-0.5 pr-1"
                      :class="[
                        draggingRoleIndex === idx && 'bg-cream',
                        dragOverRoleIndex === idx && draggingRoleIndex !== null && draggingRoleIndex !== idx && 'ring-1 ring-gold',
                      ]"
                    >
                      <button
                        type="button"
                        class="cursor-grab touch-none rounded p-1 text-ink-300 hover:text-ink active:cursor-grabbing"
                        :aria-label="`拖曳調整 ${role.name} 欄的順序`"
                        aria-description="按上下方向鍵移動順序"
                        :data-role-handle="role.roleId"
                        :aria-disabled="isRoleReordering"
                        @pointerdown="onRoleDragPointerDown($event, idx)"
                        @keydown="onRoleHandleKeydown($event, idx)"
                      >
                        <UIcon name="i-heroicons-bars-2" class="size-4" />
                      </button>
                      <UCheckbox
                        :model-value="!hiddenRoleIds.includes(role.roleId)"
                        :label="role.name"
                        class="flex-1"
                        @update:model-value="setRoleColumnVisible(role.roleId, $event === true)"
                      />
                    </li>
                  </ul>
                  <div class="mt-2 flex items-center justify-between border-t border-line px-1 pt-2">
                    <span class="text-caption text-ink-300">
                      {{ roleFilter === ALL_ROLES ? `顯示 ${(roles?.length ?? 0) - hiddenRoleCount} 欄` : '篩選單一角色時一律顯示該角色' }}
                    </span>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :disabled="hiddenRoleCount === 0"
                      @click="showAllRoleColumns"
                    >
                      全部顯示
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>
            <USelectMenu
              v-model="roleFilter"
              data-testid="rundown-role-filter"
              :items="roleFilterOptions"
              value-key="value"
              class="w-44"
            />
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <!-- 有未儲存的改動才出現「尚未儲存 · 放棄變更」；沒改動時這顆按了也沒用，不佔位置（issue #207）
                 命名避開凍結 regex：新增/帶入/範本/儲存/送出/確定 -->
            <template v-if="isDirty">
              <span class="text-caption text-gold-deep">尚未儲存</span>
              <UButton
                data-testid="rundown-reset"
                icon="i-heroicons-arrow-uturn-left"
                color="neutral"
                variant="ghost"
                :disabled="isSaving"
                @click="isResetOpen = true"
              >
                放棄變更
              </UButton>
            </template>
            <!-- 新增一列：加在表格最底（主 spec 以 /新增一列/ 找這顆、並假設新列在最後） -->
            <UButton
              icon="i-heroicons-plus"
              color="neutral"
              variant="outline"
              @click="addRow"
            >
              新增一列
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
          ref="tableScroll"
          class="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <table class="w-full border-collapse text-body">
            <thead>
              <tr class="border-b border-line bg-cream/60 dark:border-neutral-800 dark:bg-neutral-800/40">
                <!-- 拖曳把手欄（僅全部角色視圖；篩選中 index 對不上完整草稿） -->
                <th v-if="roleFilter === ALL_ROLES" class="sticky top-0 z-10 w-14 min-w-14 bg-cream px-1 py-2 lg:left-0 lg:z-20 dark:bg-neutral-800">
                  <span class="sr-only">拖曳排序與插入</span>
                </th>
                <!-- 開始、結束、主要事項：凍結在左邊（frozenLeft）；右緣分隔線用 after 畫，border-collapse 下 sticky 格的邊框不會跟著走 -->
                <th class="w-24 min-w-24 lg:z-20 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-[''] sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400" :class="frozenLeft.start">
                  開始
                </th>
                <th class="w-24 min-w-24 lg:z-20 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-[''] sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400" :class="frozenLeft.end">
                  結束
                </th>
                <th class="w-48 min-w-48 lg:z-20 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-[''] sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400" :class="frozenLeft.title">
                  主要事項
                </th>
                <th class="min-w-28 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  場地
                </th>
                <th class="min-w-32 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  共用物品
                </th>
                <th class="min-w-48 sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-left text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  備註
                </th>
                <!-- 對賓客公開此時段（賓客版流程頁 /schedule 只呈現勾選的列） -->
                <th class="w-20 whitespace-nowrap sticky top-0 z-10 border-r border-line bg-cream px-2 py-2 text-center text-caption font-medium dark:bg-neutral-800 text-ink-500 dark:border-neutral-800 dark:text-neutral-400">
                  <div class="flex items-center justify-center gap-1">
                    <span>賓客</span>
                    <UTooltip
                      v-model:open="isGuestColumnHelpOpen"
                      disable-closing-trigger
                      :content="{ side: 'bottom' }"
                      :ui="{ content: 'h-auto max-w-xs py-2' }"
                    >
                      <button
                        type="button"
                        class="flex items-center rounded text-ink-300 hover:text-ink dark:hover:text-paper"
                        aria-label="賓客欄說明"
                        @click="isGuestColumnHelpOpen = true"
                      >
                        <UIcon name="i-heroicons-information-circle" class="size-3.5" />
                      </button>
                      <template #content>
                        <p class="whitespace-normal font-normal">
                          點眼睛圖示對賓客公開，公開的時段才會出現在賓客版流程頁
                        </p>
                      </template>
                    </UTooltip>
                  </div>
                </th>
                <th
                  v-for="role in matrixRoles"
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
                class="group border-b border-line last:border-b-0 dark:border-neutral-800"
                :class="[
                  row.highlight ? 'bg-gold-light/20 hover:bg-gold-light/30 dark:bg-gold-deep/15' : 'hover:bg-cream/40 dark:hover:bg-neutral-800/30',
                  dragOverRowIndex === idx && draggingRowIndex !== null && draggingRowIndex !== idx && 'border-t-2 border-t-gold',
                ]"
              >
                <!-- 拖曳把手：整列一起搬（時間與時長跟著走） -->
                <td v-if="roleFilter === ALL_ROLES" class="px-1 py-0 lg:left-0 bg-white bg-linear-to-r lg:sticky lg:z-1" :class="frozenTint(row)">
                  <div class="flex items-center justify-center">
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
                    <!-- 上下兩顆＋：位置對應方向（上＝往上插入、下＝往下插入）。
                         名稱用「插入」不用「新增」：主 spec 以 /新增一列/ 找工具列那顆按鈕，同名會撞 strict mode -->
                    <div class="flex flex-col">
                      <UTooltip text="往上插入一列" :content="{ side: 'right' }">
                        <button
                          type="button"
                          class="flex h-5 w-6 items-center justify-center rounded text-ink-300 hover:text-ink dark:hover:text-paper"
                          :aria-label="`往上插入一列（${row.title || '此列'}）`"
                          @click="insertRow(row, 'above')"
                        >
                          <UIcon name="i-heroicons-plus" class="size-3.5" />
                        </button>
                      </UTooltip>
                      <UTooltip text="往下插入一列" :content="{ side: 'right' }">
                        <button
                          type="button"
                          class="flex h-5 w-6 items-center justify-center rounded text-ink-300 hover:text-ink dark:hover:text-paper"
                          :aria-label="`往下插入一列（${row.title || '此列'}）`"
                          @click="insertRow(row, 'below')"
                        >
                          <UIcon name="i-heroicons-plus" class="size-3.5" />
                        </button>
                      </UTooltip>
                    </div>
                  </div>
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800 bg-white bg-linear-to-r lg:sticky lg:z-1 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-['']" :class="[frozenLeft.start, frozenTint(row)]">
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
                <td class="border-r border-line p-1 dark:border-neutral-800 bg-white bg-linear-to-r lg:sticky lg:z-1 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-['']" :class="[frozenLeft.end, frozenTint(row)]">
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
                <td class="border-r border-line p-1 dark:border-neutral-800 bg-white bg-linear-to-r lg:sticky lg:z-1 lg:border-r-0 lg:after:absolute lg:after:inset-y-0 lg:after:right-0 lg:after:w-px lg:after:bg-line lg:after:content-['']" :class="[frozenLeft.title, frozenTint(row)]">
                  <UTextarea
                    v-model="row.title"
                    data-testid="rundown-cell-title"
                    variant="ghost"
                    size="sm"
                    :rows="1"
                    autoresize
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
                  <UTextarea
                    v-model="row.supplies"
                    data-testid="rundown-cell-supplies"
                    variant="ghost"
                    size="sm"
                    :rows="1"
                    autoresize
                    placeholder="共用物品"
                    class="w-full"
                  />
                </td>
                <td class="border-r border-line p-1 dark:border-neutral-800">
                  <UTextarea
                    v-model="row.note"
                    data-testid="rundown-cell-note"
                    variant="ghost"
                    size="sm"
                    :rows="1"
                    autoresize
                    placeholder="備註"
                    class="w-full"
                  />
                </td>
                <td class="border-r border-line p-1 text-center dark:border-neutral-800">
                  <UButton
                    data-testid="vibe-rundown-row-guest"
                    :icon="row.guestVisible ? 'i-heroicons-eye-20-solid' : 'i-heroicons-eye-slash'"
                    :color="row.guestVisible ? 'primary' : 'neutral'"
                    variant="ghost"
                    size="xs"
                    :aria-pressed="row.guestVisible"
                    :aria-label="`對賓客公開 ${row.title || '此列'}`"
                    @click="row.guestVisible = !row.guestVisible"
                  />
                </td>
                <td
                  v-for="role in matrixRoles"
                  :key="role.roleId"
                  class="border-r border-line p-1 dark:border-neutral-800"
                >
                  <!-- 角色格＝該角色要做的事＋做法；可換行，角色版流程頁照原換行顯示 -->
                  <UTextarea
                    :model-value="roleTaskOf(row, role.roleId)"
                    :data-testid="`rundown-cell-role-${role.roleId}`"
                    variant="ghost"
                    size="sm"
                    :rows="1"
                    autoresize
                    placeholder="要做的事、怎麼做"
                    :aria-label="`${role.name} 要做的事`"
                    class="w-full"
                    @update:model-value="setRoleTask(row, role.roleId, String($event))"
                  />
                  <!-- 該角色自己要帶的物品（issue #188）；整列共用的放「共用物品」欄 -->
                  <UInput
                    :model-value="roleSuppliesOf(row, role.roleId)"
                    variant="ghost"
                    size="xs"
                    icon="i-heroicons-shopping-bag"
                    placeholder="要帶的物品"
                    :aria-label="`${role.name} 要帶的物品`"
                    class="w-full"
                    @update:model-value="setRoleSupplies(row, role.roleId, String($event))"
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
          bordered
          title="尚無流程安排"
          :description="roleFilter === ALL_ROLES
            ? '點「新增一列」建立，或用「帶入宴客段範本」快速起步'
            : '此角色目前沒有參與的時段'"
        />
      </section>
    </div>

    <!-- 工作人員角色彈窗（issue #207）：新增、改名、移除、複製角色專屬連結；左右順序在表格上方「欄位」調整 -->
    <!-- title 給螢幕報讀用：自訂 #content 時 NuxtUI 會把它放進隱藏的 DialogTitle，版面不變 -->
    <UModal v-model:open="isRolesModalOpen" title="工作人員角色">
      <template #content>
        <div class="flex max-h-dvh flex-col p-6">
          <h3 class="text-body-l font-semibold text-ink dark:text-paper">
            工作人員角色
          </h3>
          <p class="mt-1 text-caption text-ink-300">
            點角色旁的連結圖示，複製該角色專屬的流程連結，貼給負責的人
          </p>

          <ul v-if="(roles?.length ?? 0) > 0" class="mt-4 min-h-0 flex-1 divide-y divide-line overflow-y-auto border-y border-line">
            <li
              v-for="role in roles"
              :key="role.roleId"
              :aria-label="role.name"
              class="flex items-center gap-1 py-2 pl-1"
            >
              <span class="mr-auto min-w-0 truncate text-body font-medium text-ink dark:text-paper">{{ role.name }}</span>
              <!-- 兩段式移除：點垃圾桶後就地變成「確認移除／取消」，全程不離開清單 -->
              <template v-if="roleRemoveConfirmId === role.roleId">
                <UButton
                  color="error"
                  variant="solid"
                  size="xs"
                  :loading="isRoleRemoving"
                  @click="confirmRoleRemove(role)"
                >
                  確認移除
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="isRoleRemoving"
                  @click="roleRemoveConfirmId = null"
                >
                  取消
                </UButton>
              </template>
              <!-- 有角色正在確認移除時，其他角色的操作先收起：畫面上只剩一組「確認移除／取消」，不會點錯列 -->
              <template v-else-if="roleRemoveConfirmId === null">
                <!-- 不包 UTooltip：彈窗開啟時焦點自動落在第一顆按鈕，提示框會自己跳出來；用途已寫在彈窗說明 -->
                <UButton
                  icon="i-heroicons-link"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`複製 ${role.name} 的連結`"
                  @click="copyRundownLink(role)"
                />
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
                  @click="roleRemoveConfirmId = role.roleId"
                />
              </template>
            </li>
          </ul>
          <p v-else class="mt-4 text-body text-ink-300">
            尚無角色，點「新增角色」建立第一個工作人員角色
          </p>

          <div class="mt-6 flex justify-between gap-3">
            <UButton
              icon="i-heroicons-plus"
              color="neutral"
              variant="outline"
              @click="openRoleCreate"
            >
              新增角色
            </UButton>
            <UButton
              color="neutral"
              variant="solid"
              @click="isRolesModalOpen = false"
            >
              完成
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 離開確認：有未儲存改動時攔下站內換頁 -->
    <ConfirmModal
      v-model:open="isLeaveOpen"
      title="離開這一頁？"
      description="尚未儲存的變更會消失。"
      confirm-label="離開"
      confirm-color="error"
      @confirm="confirmLeave"
    />

    <!-- 重置確認：捨棄未儲存草稿 -->
    <ConfirmModal
      v-model:open="isResetOpen"
      title="放棄變更"
      description="將捨棄尚未儲存的變更，還原到上次儲存的內容。"
      confirm-label="還原"
      confirm-color="error"
      @confirm="confirmReset"
    />

    <!-- 角色表單 Modal（新增 / 改名） -->
    <UModal v-model:open="isRoleFormOpen">
      <template #content>
        <div data-testid="rundown-role-form" class="p-6">
          <h3 class="mb-4 text-body-l font-semibold text-ink dark:text-paper">
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
          <h3 class="mb-2 text-body-l font-semibold text-ink dark:text-paper">
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
  </div>
</template>
