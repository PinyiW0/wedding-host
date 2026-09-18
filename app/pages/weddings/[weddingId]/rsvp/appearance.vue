<!-- app/pages/weddings/[weddingId]/rsvp/appearance.vue — RSVP 外觀設定（模板 + 主視覺照片組 + 即時預覽） -->
<script setup lang="ts">
import type { RsvpFormConfigDetail, RsvpTheme } from '~/types/api/rsvp-config'
import { configureRsvpForm, getRsvpFormConfig, getWedding, updateWedding } from '~/api'
import { RSVP_BANNER_PHOTO_MAX, RSVP_BANNER_SET_MAX } from '~/types/api/rsvp-config'

definePageMeta({ layout: 'default' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()
const toast = useToast()

const { data: wedding } = await getWedding(weddingId)
// 新人姓名可在此頁直接編輯（儲存時同步回婚禮資訊），預覽即時反映
const nameDraft = ref({
  groom: wedding.value?.groomName ?? '',
  bride: wedding.value?.brideName ?? '',
})
const groomName = computed(() => nameDraft.value.groom.trim() || '新郎')
const brideName = computed(() => nameDraft.value.bride.trim() || '新娘')

const { data: config } = await getRsvpFormConfig(weddingId)
const draft = ref<RsvpFormConfigDetail>(structuredClone(toRaw(config.value!)))

const THEMES: { value: RsvpTheme, label: string, hint: string }[] = [
  { value: 'minimal', label: '極簡白底', hint: '乾淨留白，聚焦文字' },
  { value: 'floral', label: '花卉水彩', hint: '柔和暖色花卉背景' },
  { value: 'photo', label: '大圖主視覺', hint: '以照片拼貼開場，賓客可左右切換' },
]

// 底色預設色票：低彩度、中明度，大面積鋪開才不會搶掉照片。
// 參考站兩組底色（陶土 #C7997E、橄欖 #B4B19A）也落在這個區間
const TONE_PRESETS = ['#BBA595', '#A8929A', '#B4B19A', '#C7997E', '#A8B2AC', '#D8C39B']

// 照片以 dataURL 進 draft，存檔時才直傳（與交通參考圖片同模式）
const MAX_BANNER_SIZE = 5 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function addBannerSet() {
  if (draft.value.banners.length >= RSVP_BANNER_SET_MAX)
    return
  // 新的一組預設挑一個還沒被用過的色，省得兩組同色、切換時看不出底色有換
  const used = new Set(draft.value.banners.map(b => b.tone))
  draft.value.banners.push({ tone: TONE_PRESETS.find(t => !used.has(t)) ?? TONE_PRESETS[0]!, photos: [] })
}

function removeBannerSet(index: number) {
  draft.value.banners.splice(index, 1)
}

async function onBannerPhotosChange(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // 允許重選同一批檔案
  const set = draft.value.banners[index]
  if (!set)
    return
  for (const file of files) {
    if (set.photos.length >= RSVP_BANNER_PHOTO_MAX) {
      toast.add({ title: '超過張數上限', description: `一組最多 ${RSVP_BANNER_PHOTO_MAX} 張，其餘已略過`, color: 'error' })
      break
    }
    if (file.size > MAX_BANNER_SIZE) {
      toast.add({ title: '圖片過大', description: `「${file.name}」超過 5MB，已略過`, color: 'error' })
      continue
    }
    // 逐檔依序讀取，保持選取順序——第一張是主圖
    set.photos.push(await readAsDataUrl(file))
  }
}

function removeBannerPhoto(setIndex: number, photoIndex: number) {
  draft.value.banners[setIndex]?.photos.splice(photoIndex, 1)
}

const isSaving = ref(false)
async function save() {
  isSaving.value = true
  try {
    // R2 啟用時逐張直傳（已是 URL 的原樣返回）；本機模式維持 dataURL。
    // 一張都沒有的組直接丟掉——server 端也會擋，這裡先擋是為了讓預覽與存檔結果一致
    const banners = []
    for (const set of draft.value.banners) {
      const photos: string[] = []
      for (const photo of set.photos)
        photos.push(await uploadImage(photo, weddingId.value, 'rsvp-banner'))
      if (photos.length)
        banners.push({ tone: set.tone, photos })
    }
    await configureRsvpForm(weddingId.value, {
      weddingId: weddingId.value,
      theme: draft.value.theme,
      // banner 是多組之前的單張欄位，server 會同步成第一組第一張，這裡不必自己算
      banners,
      questions: draft.value.questions,
    })
    // 新人姓名有異動才同步回婚禮資訊
    const groom = nameDraft.value.groom.trim()
    const bride = nameDraft.value.bride.trim()
    if (groom !== (wedding.value?.groomName ?? '') || bride !== (wedding.value?.brideName ?? '')) {
      await updateWedding(weddingId.value, { groomName: groom, brideName: bride })
      if (wedding.value) {
        wedding.value.groomName = groom
        wedding.value.brideName = bride
      }
    }
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
      description="選擇表單模板與主視覺照片；右側即時預覽賓客看到的表單"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
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
        <!-- 新人姓名（預覽 hero 即時反映，儲存時同步回婚禮資訊） -->
        <div>
          <div class="mb-3 flex items-center gap-3">
            <p class="text-overline uppercase text-gold-deep">
              新人姓名
            </p>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UInput
              v-model="nameDraft.groom"
              aria-label="新郎姓名"
              placeholder="新郎姓名"
              class="w-full"
            />
            <UInput
              v-model="nameDraft.bride"
              aria-label="新娘姓名"
              placeholder="新娘姓名"
              class="w-full"
            />
          </div>
          <p class="mt-2 text-caption text-ink-300">
            儲存後將同步更新婚禮資訊的新人姓名
          </p>
        </div>

        <!-- 模板 -->
        <div>
          <div class="mb-3 flex items-center gap-3">
            <p class="text-overline uppercase text-gold-deep">
              表單模板
            </p>
            <span class="h-px flex-1 bg-line" />
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="t in THEMES"
              :key="t.value"
              type="button"
              class="relative overflow-hidden rounded-lg border text-left transition"
              :class="draft.theme === t.value
                ? 'border-gold bg-white ring-1 ring-gold/30'
                : 'border-line bg-paper hover:border-gold-deep'"
              :aria-pressed="draft.theme === t.value"
              @click="draft.theme = t.value"
            >
              <!-- 風格縮影（純 CSS，不載外部資源） -->
              <span class="block h-16 w-full border-b border-line" aria-hidden="true">
                <span v-if="t.value === 'minimal'" class="flex h-full items-center justify-center bg-white">
                  <span class="h-px w-10 bg-gold" />
                </span>
                <span v-else-if="t.value === 'floral'" class="block h-full bg-gradient-to-br from-primary-100 via-paper to-primary-200" />
                <span v-else class="flex h-full items-center justify-center bg-ink">
                  <UIcon name="i-heroicons-photo" class="size-5 text-cream" />
                </span>
              </span>
              <!-- 選中：右上金勾，整卡不染色（quiet luxury） -->
              <span
                v-if="draft.theme === t.value"
                class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-white shadow"
              >
                <UIcon name="i-heroicons-check" class="size-3.5 text-gold" />
              </span>
              <span class="block p-4 pt-3">
                <span class="block text-body-l font-medium text-ink">{{ t.label }}</span>
                <span class="mt-1 block text-caption text-ink-300">{{ t.hint }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- 主視覺：一組＝一個底色＋最多三張照片，賓客在表單上左右切換整組 -->
        <div>
          <div class="mb-3 flex items-center gap-3">
            <p class="text-overline uppercase text-gold-deep">
              主視覺照片（選填）
            </p>
            <span class="h-px flex-1 bg-line" />
          </div>
          <p class="mb-4 text-caption text-ink-300">
            一組最多 {{ RSVP_BANNER_PHOTO_MAX }} 張，第一張是主圖。設兩組以上時，賓客滑過左右半邊就會整組切換，底色跟著換。
          </p>

          <div class="space-y-4">
            <div
              v-for="(set, setIndex) in draft.banners"
              :key="setIndex"
              class="rounded-lg border border-line bg-paper p-4"
            >
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-body font-medium text-ink">
                  第 {{ setIndex + 1 }} 組
                </p>
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`移除第 ${setIndex + 1} 組`"
                  @click="removeBannerSet(setIndex)"
                />
              </div>

              <!-- 照片列：第一張標主圖，其餘依序落在拼貼的小圖位置 -->
              <div class="mb-3 flex flex-wrap gap-3">
                <div
                  v-for="(photo, photoIndex) in set.photos"
                  :key="photoIndex"
                  class="relative"
                >
                  <div class="aspect-[3/4] w-20 overflow-hidden rounded-sm border border-line">
                    <img :src="photo" :alt="`第 ${setIndex + 1} 組第 ${photoIndex + 1} 張`" class="size-full object-cover">
                  </div>
                  <span
                    v-if="photoIndex === 0"
                    class="absolute inset-x-0 bottom-0 bg-ink/70 py-0.5 text-center text-micro text-paper"
                  >主圖</span>
                  <button
                    type="button"
                    class="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-line bg-paper text-ink-500 transition-colors duration-150 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                    :aria-label="`移除第 ${setIndex + 1} 組第 ${photoIndex + 1} 張`"
                    @click="removeBannerPhoto(setIndex, photoIndex)"
                  >
                    <UIcon name="i-heroicons-x-mark" class="size-3.5" />
                  </button>
                </div>

                <!-- 維持原生 input：FileUpload 元件寫死只吃一檔，這裡要一次選多張（同交通參考圖片） -->
                <label
                  v-if="set.photos.length < RSVP_BANNER_PHOTO_MAX"
                  class="flex aspect-[3/4] w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-line text-ink-300 transition-colors duration-150 hover:border-gold-deep hover:text-gold-deep focus-within:border-gold-deep"
                >
                  <UIcon name="i-heroicons-plus" class="size-5" />
                  <span class="text-micro">加照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    class="sr-only"
                    @change="onBannerPhotosChange(setIndex, $event)"
                  >
                </label>
              </div>

              <!-- 底色：六個預設色 + 自由選色。色值是資料不是設計 token，所以綁 inline style -->
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-caption text-ink-500">底色</span>
                <button
                  v-for="tone in TONE_PRESETS"
                  :key="tone"
                  type="button"
                  class="size-7 rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
                  :class="set.tone.toLowerCase() === tone.toLowerCase()
                    ? 'border-gold-deep ring-2 ring-gold-deep ring-offset-2 ring-offset-paper'
                    : 'border-line'"
                  :style="{ backgroundColor: tone }"
                  :aria-label="`底色 ${tone}`"
                  :aria-pressed="set.tone.toLowerCase() === tone.toLowerCase()"
                  @click="set.tone = tone"
                >
                  <span class="sr-only">{{ tone }}</span>
                </button>
                <input
                  v-model="set.tone"
                  type="color"
                  class="size-7 cursor-pointer rounded-full border border-line bg-paper"
                  :aria-label="`第 ${setIndex + 1} 組自訂底色`"
                >
              </div>
            </div>

            <UButton
              v-if="draft.banners.length < RSVP_BANNER_SET_MAX"
              icon="i-heroicons-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="addBannerSet"
            >
              新增一組
            </UButton>
          </div>
        </div>
      </section>

      <!-- 右：即時預覽（紙感框，與題目設定頁一致） -->
      <section class="stable-scroll rounded-lg border border-line bg-paper-soft p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:p-6">
        <div class="mb-5 flex items-center justify-center gap-3">
          <span class="h-px w-10 bg-gold" />
          <p class="text-overline uppercase text-gold-deep">
            賓客表單預覽
          </p>
          <span class="h-px w-10 bg-gold" />
        </div>
        <!-- 底色跟賓客頁同為 cream，預覽的淡金選中底才會跟實際畫面一致 -->
        <div class="mx-auto max-w-md rounded-lg bg-cream p-6 shadow dark:bg-neutral-900">
          <RsvpForm
            :config="draft"
            :groom-name="groomName"
            :bride-name="brideName"
            preview
          />
        </div>
      </section>
    </div>
  </div>
</template>
