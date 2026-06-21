<!-- app/pages/weddings/[weddingId]/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  UpdateWeddingBody,
  WeddingDetail,
  WeddingUpdatedEvent,
} from '~/types/api/weddings'

import { z } from 'zod'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 婚禮詳情（含 mapLink / parkingInfo / transportInfo，GET 已回傳完整欄位）
const { data: wedding, refresh } = await useFetch<WeddingDetail>(
  () => `/api/v1/weddings/${weddingId.value}`,
)

// === 編輯婚禮資訊 ===
const schema = z.object({
  title: z.string().trim().min(1, '請輸入婚禮名稱'),
  venue: z.string().trim().min(1, '請輸入場地'),
  address: z.string().trim().min(1, '請輸入地址'),
  date: z.string().trim().min(1, '請選擇日期'),
  mapLink: z.string().trim().optional(),
  parkingInfo: z.string().trim().optional(),
  transportInfo: z.string().trim().optional(),
})

type Schema = z.output<typeof schema>

const isEditOpen = ref(false)
const isSubmitting = ref(false)
const state = reactive<Schema>({
  title: '',
  venue: '',
  address: '',
  date: '',
  mapLink: '',
  parkingInfo: '',
  transportInfo: '',
})

function openEdit() {
  state.title = wedding.value?.title ?? ''
  state.venue = wedding.value?.venue ?? ''
  state.address = wedding.value?.address ?? ''
  state.date = wedding.value?.date ?? ''
  state.mapLink = wedding.value?.mapLink ?? ''
  state.parkingInfo = wedding.value?.parkingInfo ?? ''
  state.transportInfo = wedding.value?.transportInfo ?? ''
  isEditOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  try {
    const body: UpdateWeddingBody = {
      title: event.data.title,
      venue: event.data.venue,
      address: event.data.address,
      date: event.data.date,
      mapLink: event.data.mapLink ?? '',
      parkingInfo: event.data.parkingInfo ?? '',
      transportInfo: event.data.transportInfo ?? '',
    }
    await $fetch<WeddingUpdatedEvent>(
      `/api/v1/weddings/${weddingId.value}`,
      { method: 'PATCH', body },
    )
    toast.add({ title: '婚禮資訊已更新', color: 'success' })
    isEditOpen.value = false
    await refresh()
  }
  catch (error: any) {
    const message
      = error?.data?.message || error?.statusMessage || '更新失敗，請稍後再試'
    toast.add({ title: '更新失敗', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div data-testid="wedding-detail-page" class="flex h-full flex-col">
    <PageHeader
      :title="wedding?.title ?? '婚禮詳情'"
      description="管理此場婚禮的基本資訊"
    >
      <template #actions>
        <UButton
          data-testid="wedding-edit"
          icon="i-heroicons-pencil"
          color="primary"
          @click="openEdit"
        >
          編輯
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div
        class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      >
        <dl class="divide-y divide-neutral-200 dark:divide-neutral-800">
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              婚禮名稱
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              {{ wedding?.title }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              場地
            </dt>
            <dd
              data-testid="wedding-venue-display"
              class="text-neutral-900 sm:col-span-2 dark:text-white"
            >
              {{ wedding?.venue }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              地址
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              {{ wedding?.address }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              日期
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              {{ wedding?.date }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              地圖連結
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              <a
                v-if="wedding?.mapLink"
                :href="wedding.mapLink"
                target="_blank"
                rel="noopener"
                class="text-primary-600 hover:underline dark:text-primary-400"
              >
                {{ wedding.mapLink }}
              </a>
              <span v-else class="text-neutral-400">未設定</span>
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              停車資訊
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              {{ wedding?.parkingInfo || '未設定' }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt
              class="text-sm font-medium text-neutral-500 dark:text-neutral-400"
            >
              交通指引
            </dt>
            <dd class="text-neutral-900 sm:col-span-2 dark:text-white">
              {{ wedding?.transportInfo || '未設定' }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- 編輯婚禮資訊 Modal -->
    <UModal v-model:open="isEditOpen">
      <template #content>
        <div data-testid="wedding-form-modal" class="p-6">
          <h3
            class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white"
          >
            編輯婚禮資訊
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

            <UFormField
              label="地圖連結"
              name="mapLink"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UInput
                v-model="state.mapLink"
                data-testid="wedding-map-link"
                placeholder="https://maps.google.com/..."
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="停車資訊"
              name="parkingInfo"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UTextarea
                v-model="state.parkingInfo"
                data-testid="wedding-parking-info"
                placeholder="請輸入停車資訊"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="交通指引"
              name="transportInfo"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <UTextarea
                v-model="state.transportInfo"
                data-testid="wedding-transport-info"
                placeholder="請輸入交通指引"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isSubmitting"
                @click="isEditOpen = false"
              >
                取消
              </UButton>
              <UButton
                type="submit"
                data-testid="wedding-submit"
                color="primary"
                :loading="isSubmitting"
              >
                儲存
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UModal>
  </div>
</template>
