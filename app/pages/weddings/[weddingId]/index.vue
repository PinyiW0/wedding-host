<!-- app/pages/weddings/[weddingId]/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  UpdateWeddingBody,
} from '~/types/api/weddings'

import { z } from 'zod'
import { getWedding, updateWedding } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))

// 婚禮詳情（含 mapLink / parkingInfo / transportInfo，GET 已回傳完整欄位）
const { data: wedding, refresh } = await getWedding(weddingId)

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
    await updateWedding(weddingId.value, body)
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
      eyebrow="Wedding Details"
      description="管理此場婚禮的基本資訊"
    >
      <template #actions>
        <UButton
          data-testid="wedding-edit"
          icon="i-heroicons-pencil"
          color="neutral"
          variant="solid"
          @click="openEdit"
        >
          編輯
        </UButton>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div
        class="rounded-lg border border-line bg-white p-6 sm:p-8 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div class="mb-6 flex items-center gap-3">
          <span class="h-px w-8 bg-gold" />
          <p class="text-overline uppercase text-gold-deep">
            基本資訊
          </p>
        </div>

        <!-- 編輯式定義列：細線分隔，label 金色 overline、值墨黑 -->
        <dl class="divide-y divide-line dark:divide-neutral-800">
          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              婚禮名稱
            </dt>
            <dd class="font-display text-body-l text-ink sm:col-span-2 dark:text-paper">
              {{ wedding?.title }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              場地
            </dt>
            <dd
              data-testid="wedding-venue-display"
              class="text-ink sm:col-span-2 dark:text-paper"
            >
              {{ wedding?.venue }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              地址
            </dt>
            <dd class="text-ink sm:col-span-2 dark:text-paper">
              {{ wedding?.address }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              日期
            </dt>
            <dd class="font-display text-body-l text-ink sm:col-span-2 dark:text-paper">
              {{ wedding?.date }}
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              地圖連結
            </dt>
            <dd class="text-ink sm:col-span-2 dark:text-paper">
              <a
                v-if="wedding?.mapLink"
                :href="wedding.mapLink"
                target="_blank"
                rel="noopener"
                class="text-gold-deep hover:underline"
              >
                {{ wedding.mapLink }}
              </a>
              <span v-else class="text-ink-300">未設定</span>
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              停車資訊
            </dt>
            <dd class="text-ink sm:col-span-2 dark:text-paper">
              <span v-if="wedding?.parkingInfo">{{ wedding.parkingInfo }}</span>
              <span v-else class="text-ink-300">未設定</span>
            </dd>
          </div>

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              交通指引
            </dt>
            <dd class="text-ink sm:col-span-2 dark:text-paper">
              <span v-if="wedding?.transportInfo">{{ wedding.transportInfo }}</span>
              <span v-else class="text-ink-300">未設定</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- 編輯婚禮資訊 Modal -->
    <UModal v-model:open="isEditOpen">
      <template #content>
        <div data-testid="wedding-form-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            Edit Details
          </p>
          <h3
            class="mb-6 mt-1 font-display text-h2 font-semibold text-ink dark:text-paper"
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
                color="neutral"
                variant="solid"
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
