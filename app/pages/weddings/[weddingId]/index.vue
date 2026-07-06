<!-- app/pages/weddings/[weddingId]/index.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

import type {
  UpdateWeddingBody,
} from '~/types/api/weddings'

import { z } from 'zod'
import { getDashboardStats, getWedding, updateWedding } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()

// 婚禮詳情（含 mapLink / parkingInfo / transportInfo，GET 已回傳完整欄位）
const { data: wedding, refresh } = await getWedding(weddingId)

// === 儀表板統計（issue #11：出席率／報到進度／禮金／待確認數）===
const { data: dashboardStats } = await getDashboardStats(weddingId)

const statCards = computed(() => {
  const s = dashboardStats.value
  if (!s)
    return []
  const rsvpHints = [`不出席 ${s.rsvp.declined}・待回覆 ${s.rsvp.pending} 組`]
  if (s.pendingReviewCount > 0)
    rsvpHints.push(`待審核 ${s.pendingReviewCount} 位`)
  return [
    {
      key: 'attendance',
      label: '出席人數',
      value: String(s.attendance.headcount),
      hint: `大人 ${s.attendance.adults}・小孩 ${s.attendance.children}・素食 ${s.attendance.vegetarian} 組`,
    },
    {
      key: 'rsvp',
      label: '出席回覆',
      value: `${s.rsvp.attending}/${s.rsvp.totalGroups} 組`,
      hint: rsvpHints.join('・'),
    },
    {
      key: 'checkin',
      label: '報到進度',
      value: `${s.checkIn.checkedIn}/${s.checkIn.expected} 組`,
      hint: '已報到／預期出席',
    },
    {
      key: 'gift',
      label: '禮金累計',
      value: `NT$ ${s.giftMoney.totalAmount.toLocaleString()}`,
      hint: `已登記 ${s.giftMoney.recordCount} 筆`,
    },
  ]
})

// === 編輯婚禮資訊 ===
const schema = z.object({
  title: z.string().trim().min(1, '請輸入婚禮名稱'),
  venue: z.string().trim().min(1, '請輸入場地'),
  address: z.string().trim().min(1, '請輸入地址'),
  date: z.string().trim().min(1, '請選擇日期'),
  groomName: z.string().trim().optional(),
  brideName: z.string().trim().optional(),
  mapLink: z.string().trim().optional(),
  parkingInfo: z.string().trim().optional(),
  transportInfo: z.string().trim().optional(),
  transportImageUrls: z.array(z.string()).optional(),
})

type Schema = z.output<typeof schema>

const isEditOpen = ref(false)
const isSubmitting = ref(false)
const state = reactive<Schema>({
  title: '',
  venue: '',
  address: '',
  date: '',
  groomName: '',
  brideName: '',
  mapLink: '',
  parkingInfo: '',
  transportInfo: '',
  transportImageUrls: [],
})

function openEdit() {
  state.title = wedding.value?.title ?? ''
  state.venue = wedding.value?.venue ?? ''
  state.address = wedding.value?.address ?? ''
  state.date = wedding.value?.date ?? ''
  state.groomName = wedding.value?.groomName ?? ''
  state.brideName = wedding.value?.brideName ?? ''
  state.mapLink = wedding.value?.mapLink ?? ''
  state.parkingInfo = wedding.value?.parkingInfo ?? ''
  state.transportInfo = wedding.value?.transportInfo ?? ''
  state.transportImageUrls = [...(wedding.value?.transportImageUrls ?? [])]
  isEditOpen.value = true
}

// 交通參考圖片：以 dataURL 儲存（與花圖／banner 同模式），可一次選多張
const MAX_TRANSPORT_IMAGE_SIZE = 5 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function onTransportImageChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // 允許重選同一批檔案
  for (const file of files) {
    if (file.size > MAX_TRANSPORT_IMAGE_SIZE) {
      toast.add({ title: '圖片過大', description: `「${file.name}」超過 5MB，已略過`, color: 'error' })
      continue
    }
    // 逐檔依序讀取，保持選取順序
    state.transportImageUrls = [...(state.transportImageUrls ?? []), await readAsDataUrl(file)]
  }
}
function removeTransportImage(index: number) {
  state.transportImageUrls = (state.transportImageUrls ?? []).filter((_, i) => i !== index)
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  try {
    // R2 啟用時逐張直傳（已是 URL 的原樣保留）；本機模式維持 dataURL
    const transportImageUrls: string[] = []
    for (const url of event.data.transportImageUrls ?? [])
      transportImageUrls.push(await uploadImage(url, weddingId.value, 'transport'))
    const body: UpdateWeddingBody = {
      title: event.data.title,
      venue: event.data.venue,
      address: event.data.address,
      date: event.data.date,
      groomName: event.data.groomName ?? '',
      brideName: event.data.brideName ?? '',
      mapLink: event.data.mapLink ?? '',
      parkingInfo: event.data.parkingInfo ?? '',
      transportInfo: event.data.transportInfo ?? '',
      transportImageUrls,
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
      <!-- 籌備統計總覽（儀表板；dashboard-stats 聚合端點，樣式對齊賓客頁 stats bar） -->
      <div
        data-testid="vibe-dashboard-stats"
        class="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800"
      >
        <div
          v-for="card in statCards"
          :key="card.key"
          :data-testid="`vibe-dashboard-${card.key}`"
          class="bg-white px-5 py-4 dark:bg-neutral-900"
        >
          <p class="text-caption text-ink-500 dark:text-neutral-400">
            {{ card.label }}
          </p>
          <p class="mt-1 font-display text-h2 font-semibold leading-none text-ink dark:text-paper">
            {{ card.value }}
          </p>
          <p class="mt-1 text-caption text-ink-500 dark:text-neutral-400">
            {{ card.hint }}
          </p>
        </div>
      </div>

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
              新人姓名
            </dt>
            <dd
              data-testid="wedding-couple-display"
              class="text-ink sm:col-span-2 dark:text-paper"
            >
              <span v-if="wedding?.groomName || wedding?.brideName">
                {{ wedding?.groomName || '—' }} &amp; {{ wedding?.brideName || '—' }}
              </span>
              <span v-else class="text-ink-300">未設定</span>
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

          <div class="grid grid-cols-1 gap-1 py-4 sm:grid-cols-3 sm:gap-4">
            <dt class="text-overline uppercase text-gold-deep">
              交通參考圖片
            </dt>
            <dd class="text-ink sm:col-span-2 dark:text-paper">
              <div
                v-if="wedding?.transportImageUrls?.length"
                class="flex flex-wrap gap-3"
              >
                <img
                  v-for="(url, i) in wedding.transportImageUrls"
                  :key="i"
                  :src="url"
                  :alt="`交通參考圖片 ${i + 1}`"
                  class="max-h-40 rounded border border-line"
                >
              </div>
              <span v-else class="text-ink-300">未設定</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- 編輯婚禮資訊 Modal -->
    <UModal v-model:open="isEditOpen">
      <template #content>
        <div data-testid="wedding-form-modal" class="max-h-[85vh] overflow-y-auto p-6">
          <p class="text-overline uppercase text-gold-deep">
            Edit Details
          </p>
          <h3
            class="mb-6 mt-1 text-body-l font-semibold text-ink dark:text-paper"
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

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField
                label="新郎姓名"
                name="groomName"
                class="relative mb-6"
                :ui="{ error: 'absolute top-full left-0 mt-1' }"
              >
                <UInput
                  v-model="state.groomName"
                  data-testid="wedding-groom-name"
                  placeholder="例：振茗"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="新娘姓名"
                name="brideName"
                class="relative mb-6"
                :ui="{ error: 'absolute top-full left-0 mt-1' }"
              >
                <UInput
                  v-model="state.brideName"
                  data-testid="wedding-bride-name"
                  placeholder="例：品儀"
                  class="w-full"
                />
              </UFormField>
            </div>

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

            <UFormField
              label="交通參考圖片"
              name="transportImageUrls"
              class="relative mb-6"
              :ui="{ error: 'absolute top-full left-0 mt-1' }"
            >
              <div class="space-y-3">
                <!-- 維持原生 input（不被 label 關聯）：getByLabel(/交通/) 凍結 strict 匹配只能命中「交通指引」 -->
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  data-testid="wedding-transport-image"
                  class="block w-full text-caption text-ink-500 file:mr-3 file:rounded file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:text-ink"
                  @change="onTransportImageChange"
                >
                <p class="text-caption text-ink-300">
                  可一次選擇多張圖片（單張上限 5MB）
                </p>
                <div v-if="state.transportImageUrls?.length" class="flex flex-wrap gap-3">
                  <div
                    v-for="(url, i) in state.transportImageUrls"
                    :key="i"
                    class="relative inline-block"
                  >
                    <img
                      :src="url"
                      :alt="`交通參考圖片預覽 ${i + 1}`"
                      class="max-h-32 rounded border border-line"
                    >
                    <UButton
                      icon="i-heroicons-x-mark"
                      color="error"
                      variant="solid"
                      size="xs"
                      class="absolute right-1 top-1"
                      :aria-label="`移除交通參考圖片 ${i + 1}`"
                      @click="removeTransportImage(i)"
                    />
                  </div>
                </div>
              </div>
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
