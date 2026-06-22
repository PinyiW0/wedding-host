<!-- app/pages/weddings/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateWeddingBody,
  WeddingListItem,
} from '~/types/api/weddings'

import { z } from 'zod'
import { createWedding, deleteWedding, listWeddings, restoreWedding } from '~/api'

definePageMeta({ layout: 'default' })

const toast = useToast()

// 婚禮列表（含已軟刪除，UI 以 deletedAt 分區呈現）
const { data: weddings, refresh } = await listWeddings({
  default: () => [],
})

// 搜尋：依名稱 / 場地過濾
const search = ref('')

const activeWeddings = computed(() =>
  (weddings.value ?? [])
    .filter(w => !w.deletedAt)
    .filter(w => matchSearch(w)),
)

const deletedWeddings = computed(() =>
  (weddings.value ?? [])
    .filter(w => w.deletedAt)
    .filter(w => matchSearch(w)),
)

function matchSearch(w: WeddingListItem) {
  const keyword = search.value.trim()
  if (!keyword)
    return true
  return w.title.includes(keyword) || w.venue.includes(keyword)
}

// === 建立婚禮 ===
const schema = z.object({
  title: z.string().trim().min(1, '請輸入婚禮名稱'),
  venue: z.string().trim().min(1, '請輸入場地'),
  address: z.string().trim().min(1, '請輸入地址'),
  date: z.string().trim().min(1, '請選擇日期'),
})

type Schema = z.output<typeof schema>

const isCreateOpen = ref(false)
const isSubmitting = ref(false)
const state = reactive<Schema>({ title: '', venue: '', address: '', date: '' })

function openCreate() {
  state.title = ''
  state.venue = ''
  state.address = ''
  state.date = ''
  isCreateOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  try {
    const body: CreateWeddingBody = {
      title: event.data.title,
      venue: event.data.venue,
      address: event.data.address,
      date: event.data.date,
    }
    await createWedding(body)
    toast.add({ title: '婚禮建立成功', color: 'success' })
    isCreateOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '建立失敗，請稍後再試'
    toast.add({ title: '建立失敗', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}

// === 軟刪除婚禮 ===
const isDeleteOpen = ref(false)
const isDeleting = ref(false)
const deleteTarget = ref<WeddingListItem | null>(null)

function openDelete(wedding: WeddingListItem) {
  deleteTarget.value = wedding
  isDeleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value || isDeleting.value)
    return
  isDeleting.value = true
  try {
    await deleteWedding(deleteTarget.value.weddingId)
    toast.add({ title: '婚禮已刪除', color: 'success' })
    isDeleteOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '刪除失敗，請稍後再試'
    toast.add({ title: '刪除失敗', description: message, color: 'error' })
  }
  finally {
    isDeleting.value = false
  }
}

// === 恢復婚禮 ===
const isRestoreOpen = ref(false)
const isRestoring = ref(false)
const restoreTarget = ref<WeddingListItem | null>(null)

function openRestore(wedding: WeddingListItem) {
  restoreTarget.value = wedding
  isRestoreOpen.value = true
}

async function confirmRestore() {
  if (!restoreTarget.value || isRestoring.value)
    return
  isRestoring.value = true
  try {
    await restoreWedding(restoreTarget.value.weddingId)
    toast.add({ title: '婚禮已恢復', color: 'success' })
    isRestoreOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '恢復失敗，請稍後再試'
    toast.add({ title: '恢復失敗', description: message, color: 'error' })
  }
  finally {
    isRestoring.value = false
  }
}
</script>

<template>
  <div data-testid="weddings-page" class="flex h-full flex-col">
    <PageHeader
      title="婚禮"
      eyebrow="Wedding Collection"
      description="管理所有婚禮場次"
    >
      <template #actions>
        <UButton
          data-testid="wedding-create"
          icon="i-heroicons-plus"
          color="neutral"
          variant="solid"
          @click="openCreate"
        >
          建立婚禮
        </UButton>
      </template>
    </PageHeader>

    <!-- 搜尋框 -->
    <div class="mb-6 flex shrink-0 justify-end">
      <UInput
        v-model="search"
        data-testid="wedding-search"
        icon="i-heroicons-magnifying-glass"
        placeholder="搜尋婚禮名稱或場地..."
        class="w-full sm:w-64"
      />
    </div>

    <div class="min-h-0 flex-1 space-y-12 overflow-auto">
      <!-- 婚禮列表（未刪除）：編輯式卡片網格 -->
      <div>
        <div
          v-if="activeWeddings.length > 0"
          data-testid="wedding-list"
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          <article
            v-for="wedding in activeWeddings"
            :key="wedding.weddingId"
            :aria-label="wedding.title"
            class="group flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
          >
            <!-- Save-the-Date 風格頂圖區（漸層 placeholder） -->
            <NuxtLink
              :to="`/weddings/${wedding.weddingId}`"
              class="relative block aspect-video bg-gradient-to-br from-paper via-[#EFE7D8] to-[#E8DECB] dark:from-neutral-800 dark:via-neutral-800 dark:to-neutral-900"
            >
              <span
                class="absolute left-5 top-5 inline-flex items-center gap-2 text-overline uppercase text-gold-deep"
              >
                <span class="h-px w-6 bg-gold" />
                Save the Date
              </span>
              <span
                class="absolute bottom-5 right-5 font-display text-2xl italic text-ink/30 dark:text-paper/30"
              >
                {{ wedding.date }}
              </span>
            </NuxtLink>

            <!-- 卡片內文 -->
            <div class="flex flex-1 flex-col p-6">
              <div class="flex items-start justify-between gap-3">
                <NuxtLink
                  :to="`/weddings/${wedding.weddingId}`"
                  class="font-display text-h2 font-semibold leading-tight text-ink hover:text-gold-deep dark:text-paper"
                >
                  {{ wedding.title }}
                </NuxtLink>
                <UBadge color="success" variant="subtle" class="shrink-0">
                  進行中
                </UBadge>
              </div>

              <dl class="mt-4 space-y-2 text-caption text-ink-500 dark:text-neutral-400">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-map-pin" class="size-4 text-gold" />
                  <span>{{ wedding.venue }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-calendar-days" class="size-4 text-gold" />
                  <span>{{ wedding.date }}</span>
                </div>
              </dl>

              <div class="mt-6 flex items-center justify-between border-t border-line pt-4 dark:border-neutral-800">
                <UButton
                  :to="`/weddings/${wedding.weddingId}`"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  trailing-icon="i-heroicons-arrow-right"
                >
                  進入管理
                </UButton>
                <UButton
                  data-testid="wedding-delete"
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :aria-label="`刪除 ${wedding.title}`"
                  @click="openDelete(wedding)"
                >
                  刪除
                </UButton>
              </div>
            </div>
          </article>
        </div>

        <EmptyState
          v-else
          title="目前沒有婚禮"
          description="點擊「建立婚禮」新增第一場婚禮"
        />
      </div>

      <!-- 回收區（已軟刪除） -->
      <div v-if="deletedWeddings.length > 0">
        <div class="mb-4 flex items-center gap-3">
          <span class="h-px w-8 bg-line" />
          <p class="text-overline uppercase text-ink-300">
            已刪除的婚禮
          </p>
        </div>
        <div
          data-testid="wedding-deleted-list"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="wedding in deletedWeddings"
            :key="wedding.weddingId"
            role="article"
            :aria-label="wedding.title"
            class="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line bg-paper px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="min-w-0">
              <p class="truncate font-display text-body-l font-medium text-ink-500 line-through dark:text-neutral-400">
                {{ wedding.title }}
              </p>
              <p class="truncate text-caption text-ink-300">
                {{ wedding.venue }}
              </p>
            </div>
            <UButton
              data-testid="wedding-restore"
              icon="i-heroicons-arrow-uturn-left"
              color="primary"
              variant="ghost"
              size="sm"
              :aria-label="`恢復 ${wedding.title}`"
              @click="openRestore(wedding)"
            >
              恢復
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 建立婚禮 Modal -->
    <UModal v-model:open="isCreateOpen">
      <template #content>
        <div data-testid="wedding-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            New Wedding
          </p>
          <h3
            class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper"
          >
            建立婚禮
          </h3>
          <UForm
            :schema="schema"
            :state="state"
            class="space-y-4"
            @submit="onSubmit"
          >
            <UFormField
              label="婚禮名稱"
              name="title"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.title"
                data-testid="wedding-title"
                placeholder="請輸入婚禮名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="場地"
              name="venue"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.venue"
                data-testid="wedding-venue"
                placeholder="請輸入場地名稱"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="地址"
              name="address"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.address"
                data-testid="wedding-address"
                placeholder="請輸入地址"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="日期"
              name="date"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.date"
                data-testid="wedding-date"
                type="date"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isCreateOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="wedding-submit"
                color="neutral"
                variant="solid"
                :loading="isSubmitting"
              >
                建立
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>

    <!-- 刪除確認 -->
    <ConfirmModal
      v-model:open="isDeleteOpen"
      title="確認刪除"
      :description="`確定要刪除「${deleteTarget?.title ?? ''}」嗎？刪除後可從回收區恢復。`"
      confirm-label="刪除"
      confirm-color="error"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />

    <!-- 恢復確認 -->
    <ConfirmModal
      v-model:open="isRestoreOpen"
      title="確認恢復"
      :description="`確定要恢復「${restoreTarget?.title ?? ''}」嗎？`"
      confirm-label="恢復"
      confirm-color="primary"
      :loading="isRestoring"
      @confirm="confirmRestore"
    />
  </div>
</template>
