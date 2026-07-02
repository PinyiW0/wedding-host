<!-- app/pages/weddings/[weddingId]/rsvp/appearance.vue — RSVP 外觀設定（模板 + banner + 即時預覽） -->
<script setup lang="ts">
import type { RsvpFormConfigDetail, RsvpTheme } from '~/types/api/rsvp-config'
import { configureRsvpForm, getRsvpFormConfig, getWedding } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const toast = useToast()

const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

const { data: config } = await getRsvpFormConfig(weddingId)
const draft = ref<RsvpFormConfigDetail>(structuredClone(toRaw(config.value!)))

const THEMES: { value: RsvpTheme, label: string, hint: string }[] = [
  { value: 'minimal', label: '極簡白底', hint: '乾淨留白，聚焦文字' },
  { value: 'floral', label: '花卉水彩', hint: '柔和暖色花卉背景' },
  { value: 'photo', label: '大圖主視覺', hint: '以 banner 大圖開場' },
]

function onBannerSelected(payload: { dataUrl: string }) {
  draft.value.banner = payload.dataUrl
}
function onBannerError(message: string) {
  toast.add({ title: '上傳失敗', description: message, color: 'error' })
}
function removeBanner() {
  draft.value.banner = null
}

const isSaving = ref(false)
async function save() {
  isSaving.value = true
  try {
    await configureRsvpForm(weddingId.value, {
      weddingId: weddingId.value,
      theme: draft.value.theme,
      banner: draft.value.banner,
      questions: draft.value.questions,
    })
    toast.add({ title: '已儲存', description: 'RSVP 外觀設定已更新', color: 'success' })
  }
  catch (error: any) {
    toast.add({
      title: '儲存失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div data-testid="rsvp-appearance-page" class="flex h-full flex-col">
    <PageHeader
      title="RSVP 外觀設定"
      eyebrow="RSVP · 表單外觀"
      description="選擇表單模板與主視覺 banner；右側即時預覽賓客看到的表單"
    >
      <template #actions>
        <div class="flex items-center gap-3">
          <UButton
            icon="i-heroicons-queue-list"
            color="neutral"
            variant="outline"
            :to="`/weddings/${weddingId}/rsvp/questions`"
          >
            題目設定
          </UButton>
          <UButton
            data-testid="rsvp-appearance-save"
            icon="i-heroicons-check"
            color="primary"
            :loading="isSaving"
            @click="save"
          >
            儲存設定
          </UButton>
        </div>
      </template>
    </PageHeader>

    <!-- 左右各自獨立捲動：短的編輯欄不再被拉伸成一大截空白，預覽欄自己捲 -->
    <div class="flex flex-col gap-8 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
      <!-- 左：外觀編輯 -->
      <section class="stable-scroll space-y-6 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:pr-1">
        <!-- 模板 -->
        <div>
          <p class="mb-3 text-overline uppercase text-gold-deep">
            表單模板
          </p>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="t in THEMES"
              :key="t.value"
              type="button"
              class="rounded-lg border-2 p-4 text-left transition"
              :class="draft.theme === t.value
                ? 'border-gold bg-primary-100'
                : 'border-line bg-paper hover:border-gold-deep'"
              :aria-pressed="draft.theme === t.value"
              @click="draft.theme = t.value"
            >
              <span class="block text-body-l font-medium text-ink">{{ t.label }}</span>
              <span class="mt-1 block text-caption text-ink-300">{{ t.hint }}</span>
            </button>
          </div>
        </div>

        <!-- Banner -->
        <div>
          <p class="mb-3 text-overline uppercase text-gold-deep">
            主視覺 banner（選填）
          </p>
          <div v-if="draft.banner" class="space-y-3">
            <div class="aspect-[5/2] w-full overflow-hidden rounded-lg border border-line">
              <img :src="draft.banner" alt="banner 預覽" class="size-full object-cover">
            </div>
            <UButton
              icon="i-heroicons-trash"
              color="error"
              variant="outline"
              size="sm"
              @click="removeBanner"
            >
              移除 banner
            </UButton>
          </div>
          <FileUpload
            v-else
            accept="image/*"
            label="點擊或拖放圖片設定 banner"
            hint="建議寬幅圖；高度受限不佔表單主體"
            @selected="onBannerSelected"
            @error="onBannerError"
          />
        </div>
      </section>

      <!-- 右：即時預覽 -->
      <section class="stable-scroll rounded-lg border border-line bg-paper-soft p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:p-6">
        <p class="mb-4 text-overline uppercase text-gold-deep">
          賓客表單預覽
        </p>
        <RsvpForm
          :config="draft"
          :groom-name="groomName"
          :bride-name="brideName"
          preview
        />
      </section>
    </div>
  </div>
</template>
