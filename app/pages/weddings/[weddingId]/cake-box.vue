<!-- app/pages/weddings/[weddingId]/cake-box.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CakeBoxTypeListItem,
  ConfigureCakeBoxAssignmentBody,
  CreateCakeBoxTypeBody,
  UpdateCakeBoxTypeBody,
} from '~/types/api/cakebox'

import { z } from 'zod'
import {
  configureCakeBoxAssignment,
  createCakeBoxType,
  deleteCakeBoxType,
  listCakeBoxAssignments,
  listCakeBoxTypes,
  listGuests,
  updateCakeBoxType,
} from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 喜餅款式清單
const { data: cakeBoxTypes, refresh } = await listCakeBoxTypes(
  weddingId,
  { default: () => [] },
)

// 賓客清單（供指派規則選擇對象賓客）
const { data: guests } = await listGuests(
  weddingId,
  { default: () => [] },
)

const activeGuests = computed(() =>
  (guests.value ?? []).filter(g => !g.deletedAt),
)

function guestName(guestId: string): string {
  return (guests.value ?? []).find(g => g.guestId === guestId)?.name ?? guestId
}

// 已設定指派規則清單（由 GET 讀回，重整仍能還原顯示）
const { data: assignments, refresh: refreshAssignments } = await listCakeBoxAssignments(
  weddingId,
  { default: () => [] },
)

// 指派結果改「依款式分組」呈現，當訂購／打包清單用（每款幾位、各是誰）
const assignmentGroups = computed(() => {
  const groups: Record<string, {
    cakeBoxTypeId: string
    cakeBoxTypeName: string
    guests: { key: string, guestName: string, assignmentRule: string }[]
  }> = {}
  for (const a of assignments.value ?? []) {
    const grp = (groups[a.cakeBoxTypeId] ??= {
      cakeBoxTypeId: a.cakeBoxTypeId,
      cakeBoxTypeName: a.cakeBoxTypeName || typeNameOf(a.cakeBoxTypeId),
      guests: [],
    })
    grp.guests.push({
      key: `${a.cakeBoxTypeId}-${a.guestId}`,
      guestName: guestName(a.guestId),
      assignmentRule: a.assignmentRule,
    })
  }
  return Object.values(groups)
})

// === 新增 / 編輯喜餅款式表單 ===
const schema = z.object({
  name: z.string().trim().min(1, '請輸入款式名稱'),
  description: z.string().trim(),
  isDefault: z.boolean(),
})

type Schema = z.output<typeof schema>

const isFormOpen = ref(false)
const isSubmitting = ref(false)
const formError = ref('')
const editingId = ref<string | null>(null)
const state = reactive<Schema>({
  name: '',
  description: '',
  isDefault: false,
})

function resetState() {
  state.name = ''
  state.description = ''
  state.isDefault = false
}

function openCreate() {
  editingId.value = null
  formError.value = ''
  resetState()
  isFormOpen.value = true
}

function openEdit(type: CakeBoxTypeListItem) {
  editingId.value = type.cakeBoxTypeId
  formError.value = ''
  state.name = type.name
  state.description = type.description ?? ''
  state.isDefault = type.isDefault
  isFormOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    const data = event.data
    if (editingId.value) {
      const body: UpdateCakeBoxTypeBody = {
        name: data.name,
        description: data.description,
      }
      await updateCakeBoxType(weddingId.value, editingId.value, body)
      toast.add({ title: '喜餅款式已更新', color: 'success' })
    }
    else {
      const body: CreateCakeBoxTypeBody = {
        name: data.name,
        description: data.description || undefined,
        isDefault: data.isDefault,
      }
      await createCakeBoxType(weddingId.value, body)
      toast.add({ title: '喜餅款式新增成功', color: 'success' })
    }
    isFormOpen.value = false
    await refresh()
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複造成測試 strict mode violation）
    formError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

// === 移除喜餅款式 ===
const isRemoveOpen = ref(false)
const isRemoving = ref(false)
const removeTarget = ref<CakeBoxTypeListItem | null>(null)

function openRemove(type: CakeBoxTypeListItem) {
  removeTarget.value = type
  isRemoveOpen.value = true
}

async function confirmRemove() {
  if (!removeTarget.value || isRemoving.value)
    return
  isRemoving.value = true
  try {
    await deleteCakeBoxType(weddingId.value, removeTarget.value.cakeBoxTypeId)
    toast.add({ title: '喜餅款式已移除', color: 'success' })
    isRemoveOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
    toast.add({ title: '移除失敗', description: message, color: 'error' })
  }
  finally {
    isRemoving.value = false
  }
}

// === 設定指派規則 ===
const typeOptions = computed(() =>
  (cakeBoxTypes.value ?? []).map(t => ({ label: t.name, value: t.cakeBoxTypeId })),
)
const guestOptions = computed(() =>
  activeGuests.value.map(g => ({ label: g.name, value: g.guestId })),
)

const isAssignOpen = ref(false)
const isAssigning = ref(false)
const assignError = ref('')
const assignState = reactive<{
  cakeBoxTypeId: string
  guestId: string
  assignmentRule: string
}>({
  cakeBoxTypeId: '',
  guestId: '',
  assignmentRule: '',
})

function openAssign() {
  assignError.value = ''
  assignState.cakeBoxTypeId = ''
  assignState.guestId = ''
  assignState.assignmentRule = ''
  isAssignOpen.value = true
}

async function confirmAssign() {
  if (isAssigning.value)
    return
  if (!assignState.cakeBoxTypeId) {
    assignError.value = '請選擇喜餅款式'
    return
  }
  if (!assignState.guestId) {
    assignError.value = '請選擇對象賓客'
    return
  }
  isAssigning.value = true
  assignError.value = ''
  try {
    const body: ConfigureCakeBoxAssignmentBody = {
      guestId: assignState.guestId,
      assignmentRule: assignState.assignmentRule,
    }
    await configureCakeBoxAssignment(weddingId.value, assignState.cakeBoxTypeId, body)
    toast.add({ title: '指派規則設定成功', color: 'success' })
    isAssignOpen.value = false
    await refreshAssignments()
  }
  catch (error: any) {
    assignError.value
      = error?.data?.message || error?.statusMessage || '設定失敗，請稍後再試'
  }
  finally {
    isAssigning.value = false
  }
}

// === 依分類自動帶入（規則：每個分類 → 一種款式；沒對到給預設款）===
const defaultType = computed(() => (cakeBoxTypes.value ?? []).find(t => t.isDefault) ?? null)

function guestCategory(category: string | null | undefined): string {
  return category || '未分類'
}

// 各分類人數
const distinctCategories = computed(() => {
  const set = new Set<string>()
  for (const g of activeGuests.value)
    set.add(guestCategory(g.category))
  return [...set]
})
function categoryCount(cat: string): number {
  return activeGuests.value.filter(g => guestCategory(g.category) === cat).length
}

// 各款式已指派人數（供訂購數量估算）
const assignedCountByType = computed(() => {
  const m: Record<string, number> = {}
  for (const a of assignments.value ?? [])
    m[a.cakeBoxTypeId] = (m[a.cakeBoxTypeId] ?? 0) + 1
  return m
})

function typeNameOf(typeId: string): string {
  return (cakeBoxTypes.value ?? []).find(t => t.cakeBoxTypeId === typeId)?.name ?? ''
}

// 由現有指派回推「該分類目前用哪一款」，供重開 modal 時預填（達到規則持久化效果）
function existingTypeByCategory(): Record<string, string> {
  const m: Record<string, string> = {}
  for (const a of assignments.value ?? []) {
    const g = (guests.value ?? []).find(x => x.guestId === a.guestId)
    if (!g)
      continue
    const cat = guestCategory(g.category)
    if (!m[cat])
      m[cat] = a.cakeBoxTypeId
  }
  return m
}

const isAutoOpen = ref(false)
const isApplying = ref(false)
const autoError = ref('')
const categoryRule = reactive<Record<string, string>>({})

function openAutoAssign() {
  autoError.value = ''
  const byCat = existingTypeByCategory()
  for (const cat of distinctCategories.value)
    categoryRule[cat] = byCat[cat] ?? defaultType.value?.cakeBoxTypeId ?? ''
  isAutoOpen.value = true
}

async function applyByCategory() {
  if (isApplying.value)
    return
  isApplying.value = true
  autoError.value = ''
  try {
    let applied = 0
    let skipped = 0
    for (const g of activeGuests.value) {
      const cat = guestCategory(g.category)
      const typeId = categoryRule[cat] || defaultType.value?.cakeBoxTypeId || ''
      if (!typeId) {
        skipped++
        continue
      }
      await configureCakeBoxAssignment(weddingId.value, typeId, {
        guestId: g.guestId,
        assignmentRule: `${cat}→${typeNameOf(typeId)}`,
      })
      applied++
    }
    await refreshAssignments()
    toast.add({
      title: `已依分類帶入 ${applied} 位`,
      description: skipped > 0 ? `${skipped} 位未對到規則且無預設款` : '可於下方逐位再微調',
      color: 'success',
    })
    isAutoOpen.value = false
  }
  catch (error: any) {
    autoError.value
      = error?.data?.message || error?.statusMessage || '帶入失敗，請稍後再試'
  }
  finally {
    isApplying.value = false
  }
}
</script>

<template>
  <div data-testid="cake-box-page" class="flex h-full flex-col">
    <PageHeader
      title="喜餅款式"
      :eyebrow="`Cake Box · ${(cakeBoxTypes ?? []).length} 款`"
      description="管理喜餅款式與賓客指派規則"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton
            data-testid="cake-box-auto-assign"
            icon="i-heroicons-sparkles"
            color="primary"
            variant="solid"
            @click="openAutoAssign"
          >
            依分類帶入
          </UButton>
          <UButton
            data-testid="cake-box-assign"
            icon="i-heroicons-adjustments-horizontal"
            color="neutral"
            variant="outline"
            @click="openAssign"
          >
            設定指派規則
          </UButton>
          <UButton
            data-testid="cake-box-create"
            icon="i-heroicons-plus"
            color="neutral"
            variant="solid"
            @click="openCreate"
          >
            新增喜餅款式
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 space-y-10 overflow-auto">
      <!-- 喜餅款式 — 編輯式卡片（預設款式金框 + 金勾） -->
      <section>
        <div class="mb-4 flex items-center gap-3">
          <span class="text-overline uppercase text-gold-deep">喜餅款式</span>
          <span class="h-px flex-1 bg-line" />
        </div>

        <div
          v-if="(cakeBoxTypes ?? []).length > 0"
          data-testid="cake-box-list"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="type in cakeBoxTypes"
            :key="type.cakeBoxTypeId"
            :data-testid="`cake-box-row-${type.cakeBoxTypeId}`"
            role="article"
            :aria-label="type.name"
            class="flex flex-col rounded-lg border p-6 transition-colors"
            :class="type.isDefault
              ? 'border-gold bg-paper dark:bg-neutral-900'
              : 'border-line bg-white hover:border-gold-deep dark:border-neutral-800 dark:bg-neutral-900'"
          >
            <div class="mb-2 flex items-start justify-between gap-3">
              <h3 class="font-display text-2xl font-medium text-ink dark:text-paper">
                {{ type.name }}
              </h3>
              <!-- 預設款式金勾，其餘空框（對齊參考「選中金勾」） -->
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded"
                :class="type.isDefault ? 'bg-gold text-white' : 'border border-line'"
              >
                <UIcon v-if="type.isDefault" name="i-heroicons-check" class="size-4" />
              </span>
            </div>

            <p class="min-h-5 text-body text-ink-500 dark:text-neutral-400">
              {{ type.description ?? '—' }}
            </p>

            <div class="mt-3 flex items-center gap-2">
              <UBadge
                v-if="type.isDefault"
                color="primary"
                variant="soft"
                size="sm"
              >
                預設
              </UBadge>
              <!-- 已指派人數（喜餅訂購數量估算） -->
              <span class="text-caption text-ink-400 dark:text-neutral-500">
                已指派 {{ assignedCountByType[type.cakeBoxTypeId] ?? 0 }} 位
              </span>
            </div>

            <div class="mt-5 flex justify-end gap-1 border-t border-line pt-4 dark:border-neutral-800">
              <UButton
                data-testid="cake-box-edit"
                icon="i-heroicons-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`編輯 ${type.name}`"
                @click="openEdit(type)"
              >
                編輯
              </UButton>
              <UButton
                data-testid="cake-box-remove"
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="sm"
                :aria-label="`移除 ${type.name}`"
                @click="openRemove(type)"
              >
                移除
              </UButton>
            </div>
          </div>
        </div>

        <div v-else data-testid="cake-box-list">
          <EmptyState
            title="目前沒有喜餅款式"
            description="點擊「新增喜餅款式」建立第一個款式"
          />
        </div>
      </section>

      <!-- 已設定指派規則（由 GET 讀回，重整仍能還原顯示） -->
      <section data-testid="cake-box-assignment-list">
        <div class="mb-4 flex items-center gap-3">
          <span class="text-overline uppercase text-gold-deep">已設定指派規則</span>
          <span class="h-px flex-1 bg-line" />
        </div>

        <div v-if="assignmentGroups.length === 0">
          <EmptyState
            title="尚未設定指派規則"
            description="點擊「設定指派規則」為賓客指派喜餅款式"
          />
        </div>
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            v-for="grp in assignmentGroups"
            :key="grp.cakeBoxTypeId"
            class="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <!-- 款式標頭：款名 + 該款人數（直接對應要訂幾盒） -->
            <div class="mb-3 flex items-center gap-2 border-b border-line pb-2 dark:border-neutral-800">
              <span class="size-2 shrink-0 rounded-full bg-gold" />
              <h3 class="font-medium text-ink dark:text-paper">
                {{ grp.cakeBoxTypeName }}
              </h3>
              <span class="ml-auto text-caption text-ink-400 dark:text-neutral-500">
                {{ grp.guests.length }} 位
              </span>
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="a in grp.guests"
                :key="a.key"
                :aria-label="a.guestName"
                class="flex flex-wrap items-baseline gap-x-2"
              >
                <span class="font-medium text-ink dark:text-paper">{{ a.guestName }}</span>
                <span
                  v-if="a.assignmentRule"
                  class="text-caption text-ink-500 dark:text-neutral-400"
                >
                  {{ a.assignmentRule }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- 新增 / 編輯喜餅款式 Modal -->
    <UModal v-model:open="isFormOpen">
      <template #content>
        <div data-testid="cake-box-form-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            {{ editingId ? '編輯喜餅款式' : '新增喜餅款式' }}
          </h3>

          <UAlert
            v-if="formError"
            data-testid="cake-box-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="formError"
            class="mb-4"
          />

          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="名稱"
              name="name"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.name"
                data-testid="cake-box-name"
                placeholder="請輸入款式名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField label="說明" name="description">
              <UTextarea
                v-model="state.description"
                data-testid="cake-box-description"
                placeholder="款式說明（選填）"
                class="w-full"
              />
            </UFormField>

            <UFormField v-if="!editingId" name="isDefault">
              <UCheckbox
                v-model="state.isDefault"
                data-testid="cake-box-default"
                label="設為預設款式"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isFormOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="cake-box-submit"
                color="neutral"
                variant="solid"
                :loading="isSubmitting"
              >
                {{ editingId ? '儲存' : '新增' }}
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 設定指派規則 Modal -->
    <UModal v-model:open="isAssignOpen">
      <template #content>
        <div data-testid="cake-box-assign-modal" class="p-6">
          <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            設定喜餅指派規則
          </h3>

          <UAlert
            v-if="assignError"
            data-testid="cake-box-assign-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="assignError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="指派規則" name="assignmentRule">
              <UInput
                v-model="assignState.assignmentRule"
                data-testid="assignment-rule"
                placeholder="如：家人→大餅＋豪華禮盒"
                class="w-full"
              />
            </UFormField>

            <UFormField label="喜餅款式" name="cakeBoxTypeId">
              <USelectMenu
                v-model="assignState.cakeBoxTypeId"
                data-testid="assignment-type-select"
                :items="typeOptions"
                value-key="value"
                placeholder="選擇喜餅款式"
                class="w-full"
              />
            </UFormField>

            <UFormField label="對象賓客" name="guestId">
              <USelectMenu
                v-model="assignState.guestId"
                data-testid="assignment-guest-select"
                :items="guestOptions"
                value-key="value"
                placeholder="選擇對象賓客"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isAssigning"
                @click="isAssignOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="assignment-submit"
                color="neutral"
                variant="solid"
                :loading="isAssigning"
                @click="confirmAssign"
              >
                設定
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 依分類帶入 Modal -->
    <UModal v-model:open="isAutoOpen">
      <template #content>
        <div data-testid="cake-box-auto-modal" class="p-6">
          <h3 class="mb-1 text-lg font-semibold text-neutral-900 dark:text-white">
            依分類帶入喜餅
          </h3>
          <p class="mb-4 text-body text-ink-500 dark:text-neutral-400">
            為每個賓客分類選一種款式，套用後所有賓客依分類自動帶入；沒對到的給預設款（{{ defaultType?.name ?? '尚未設定預設款' }}）。
          </p>

          <UAlert
            v-if="autoError"
            data-testid="cake-box-auto-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="autoError"
            class="mb-4"
          />

          <div v-if="distinctCategories.length === 0" class="py-4">
            <EmptyState
              title="目前沒有賓客分類"
              description="請先於賓客管理新增賓客"
            />
          </div>
          <div v-else class="max-h-80 space-y-3 overflow-auto">
            <div
              v-for="cat in distinctCategories"
              :key="cat"
              class="flex items-center gap-3"
            >
              <span class="w-28 shrink-0 text-body font-medium text-ink dark:text-paper">
                {{ cat }}
                <span class="text-caption text-ink-400">（{{ categoryCount(cat) }} 位）</span>
              </span>
              <USelectMenu
                v-model="categoryRule[cat]"
                :data-testid="`cake-box-auto-rule-${cat}`"
                :items="typeOptions"
                value-key="value"
                placeholder="選擇款式"
                class="flex-1"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-5">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isApplying"
              @click="isAutoOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="cake-box-auto-apply"
              color="primary"
              variant="solid"
              :loading="isApplying"
              :disabled="distinctCategories.length === 0"
              @click="applyByCategory"
            >
              套用
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 移除確認 -->
    <ConfirmModal
      v-model:open="isRemoveOpen"
      title="確認移除"
      :description="`確定要移除喜餅款式「${removeTarget?.name ?? ''}」嗎？`"
      confirm-label="移除"
      confirm-color="error"
      :loading="isRemoving"
      @confirm="confirmRemove"
    />
  </div>
</template>
