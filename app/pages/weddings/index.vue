<!-- app/pages/weddings/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  CreateWeddingBody,
  WeddingListItem,
} from '~/types/api/weddings'

import { z } from 'zod'
import { createWedding, deleteWedding, listWeddings } from '~/api'

definePageMeta({ layout: 'default' })

const toast = useToast()

// 婚禮列表（端點仍回傳已軟刪除者，畫面一律濾掉：無回收區、無恢復入口，issue #174）
const { data: weddings, refresh } = await listWeddings({
  default: () => [],
})

// 搜尋：依名稱 / 場地過濾
const search = ref('')

// 日期排序：true = 由新到舊（預設），false = 由舊到新
const sortDateDesc = ref(true)

const activeWeddings = computed(() =>
  (weddings.value ?? [])
    .filter(w => !w.deletedAt)
    .filter(w => matchSearch(w))
    .sort((a, b) =>
      sortDateDesc.value ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    ),
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

    <!-- 搜尋 -->
    <div class="mb-6 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <UInput
        v-model="search"
        data-testid="wedding-search"
        icon="i-heroicons-magnifying-glass"
        placeholder="搜尋婚禮名稱或場地..."
        class="w-full sm:w-64"
      />
    </div>

    <div class="min-h-0 flex-1 space-y-8 overflow-auto">
      <!-- 婚禮列表（已刪除者不顯示）：管理用表格 -->
      <div>
        <div
          v-if="activeWeddings.length > 0"
          class="overflow-hidden rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div class="overflow-x-auto">
            <table data-testid="wedding-list" class="w-full min-w-[760px] text-left text-body">
              <thead>
                <tr class="border-b border-line text-overline uppercase text-ink-300 dark:border-neutral-800">
                  <th scope="col" class="px-5 py-3 font-medium">
                    婚禮名稱
                  </th>
                  <th scope="col" class="px-5 py-3 font-medium">
                    場地
                  </th>
                  <th scope="col" class="px-5 py-3 font-medium">
                    <span class="inline-flex items-center gap-1">
                      日期
                      <UButton
                        data-testid="wedding-sort-date"
                        :icon="sortDateDesc ? 'i-heroicons-bars-arrow-down' : 'i-heroicons-bars-arrow-up'"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :aria-label="sortDateDesc ? '排序：由新到舊，點擊改為由舊到新' : '排序：由舊到新，點擊改為由新到舊'"
                        @click="sortDateDesc = !sortDateDesc"
                      />
                    </span>
                  </th>
                  <th scope="col" class="px-5 py-3 font-medium">
                    狀態
                  </th>
                  <th scope="col" class="px-5 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="wedding in activeWeddings"
                  :key="wedding.weddingId"
                  :aria-label="wedding.title"
                  class="border-b border-line/60 transition-colors last:border-0 hover:bg-paper/60 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
                >
                  <td class="px-5 py-4">
                    <NuxtLink
                      :to="`/weddings/${wedding.weddingId}`"
                      class="font-display text-body-l font-medium text-ink hover:text-gold-deep dark:text-paper"
                    >
                      {{ wedding.title }}
                    </NuxtLink>
                  </td>
                  <td class="whitespace-nowrap px-5 py-4 text-ink-500 dark:text-neutral-400">
                    <span class="inline-flex items-center gap-2">
                      <UIcon name="i-heroicons-map-pin" class="size-4 shrink-0 text-gold" />
                      {{ wedding.venue }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-5 py-4 text-ink-500 dark:text-neutral-400">
                    <span class="inline-flex items-center gap-2">
                      <UIcon name="i-heroicons-calendar-days" class="size-4 shrink-0 text-gold" />
                      {{ wedding.date }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <StatusBadge color="success">
                      進行中
                    </StatusBadge>
                  </td>
                  <td class="px-5 py-4">
                    <div class="flex items-center justify-end gap-1">
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
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <EmptyState
          v-else
          title="目前沒有婚禮"
          description="點擊「建立婚禮」新增第一場婚禮"
        />
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
            class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper"
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
      :description="`確定要刪除「${deleteTarget?.title ?? ''}」嗎？刪除後不會顯示在列表上。`"
      confirm-label="刪除"
      confirm-color="error"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />
  </div>
</template>
