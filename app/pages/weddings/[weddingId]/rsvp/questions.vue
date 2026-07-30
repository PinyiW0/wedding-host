<!-- app/pages/weddings/[weddingId]/rsvp/questions.vue — RSVP 題目設定（系統題開關/標籤/排序 + 自訂題 + 即時預覽） -->
<script setup lang="ts">
import type {
  RsvpAudience,
  RsvpCustomType,
  RsvpFormConfigDetail,
  RsvpQuestion,
} from '~/types/api/rsvp-config'
import { configureRsvpForm, getRsvpFormConfig, getWedding } from '~/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const toast = useToast()

const { data: wedding } = await getWedding(weddingId)
const groomName = computed(() => wedding.value?.groomName || '新郎')
const brideName = computed(() => wedding.value?.brideName || '新娘')

const { data: config } = await getRsvpFormConfig(weddingId)
// 以草稿編輯，存檔才送出（深拷貝避免動到 fetch 快取）
const draft = ref<RsvpFormConfigDetail>(structuredClone(toRaw(config.value!)))

const CUSTOM_TYPE_LABELS: Record<RsvpCustomType, string> = {
  text: '單行文字',
  single: '單選',
  multi: '多選',
}

// 顯示對象：省略＝所有人，賓客選了對應側別才看得到該題
const AUDIENCE_OPTIONS: { value: RsvpAudience, label: string }[] = [
  { value: 'all', label: '所有人' },
  { value: 'groom', label: '只有男方親友' },
  { value: 'bride', label: '只有女方親友' },
]

function isBuiltin(q: RsvpQuestion) {
  return q.type === 'builtin'
}

function audienceOf(q: RsvpQuestion): RsvpAudience {
  return q.audience ?? 'all'
}

function setAudience(q: RsvpQuestion, audience: RsvpAudience) {
  q.audience = audience
}

function move(index: number, delta: number) {
  const list = draft.value.questions
  const target = index + delta
  if (target < 0 || target >= list.length)
    return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item!)
}

function nextCustomId() {
  const ids = new Set(
    draft.value.questions.filter(q => q.type !== 'builtin').map(q => (q as { id: string }).id),
  )
  let n = 1
  while (ids.has(`custom-${n}`)) n++
  return `custom-${n}`
}

function addCustom() {
  draft.value.questions.push({
    type: 'text',
    id: nextCustomId(),
    label: '新題目',
    required: false,
    order: draft.value.questions.length + 1,
    options: [],
  })
}

function removeCustom(index: number) {
  draft.value.questions.splice(index, 1)
}

function setCustomType(q: RsvpQuestion, type: RsvpCustomType) {
  if (q.type === 'builtin')
    return
  q.type = type
  if ((type === 'single' || type === 'multi') && !q.options?.length)
    q.options = [{ value: '選項一', label: '選項一' }]
}

function optionsToText(q: RsvpQuestion) {
  if (q.type === 'builtin')
    return ''
  return (q.options ?? []).map(o => o.label).join('\n')
}

function setOptions(q: RsvpQuestion, text: string) {
  if (q.type === 'builtin')
    return
  q.options = text
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(label => ({ value: label, label }))
}

const isSaving = ref(false)
async function save() {
  isSaving.value = true
  try {
    const questions = draft.value.questions.map((q, i) => ({ ...q, order: i + 1 }))
    await configureRsvpForm(weddingId.value, {
      weddingId: weddingId.value,
      theme: draft.value.theme,
      banner: draft.value.banner,
      questions,
    })
    toast.add({ title: '已儲存', description: 'RSVP 題目設定已更新', color: 'success' })
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
  <div data-testid="rsvp-questions-page" class="flex h-full flex-col">
    <PageHeader
      title="RSVP 題目設定"
      eyebrow="RSVP · 表單題目"
      description="開關系統題、調整標籤與順序，或新增自訂題；右側即時預覽賓客看到的表單"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            icon="i-heroicons-paint-brush"
            color="neutral"
            variant="outline"
            :to="`/weddings/${weddingId}/rsvp/appearance`"
          >
            外觀設定
          </UButton>
          <UButton
            data-testid="rsvp-questions-save"
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
      <!-- 左：題目編輯 -->
      <section class="stable-scroll space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:pr-1">
        <div
          v-for="(q, index) in draft.questions"
          :key="isBuiltin(q) ? `b-${q.key}` : `c-${(q as { id: string }).id}`"
          class="group rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
          :class="isBuiltin(q) && !(q as { enabled: boolean }).enabled ? 'border-dashed opacity-60' : ''"
        >
          <div class="flex items-start gap-3">
            <!-- 序號錨點（serif 大數字，type-led） -->
            <span class="w-9 shrink-0 select-none font-display text-h2 font-semibold leading-none text-ink-300/50">
              {{ String(index + 1).padStart(2, '0') }}
            </span>

            <!-- 排序（hover 卡片才現身，降噪） -->
            <div class="flex flex-col opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <UButton
                icon="i-heroicons-chevron-up"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="index === 0"
                :aria-label="`上移 ${q.label}`"
                @click="move(index, -1)"
              />
              <UButton
                icon="i-heroicons-chevron-down"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="index === draft.questions.length - 1"
                :aria-label="`下移 ${q.label}`"
                @click="move(index, 1)"
              />
            </div>

            <div class="min-w-0 flex-1 space-y-3">
              <div class="flex items-baseline gap-2">
                <!-- 題型 eyebrow：金色只留給自訂題（強調），系統題用中性 -->
                <span
                  class="text-overline uppercase"
                  :class="isBuiltin(q) ? 'text-ink-300' : 'text-gold-deep'"
                >
                  {{ isBuiltin(q) ? '系統題' : CUSTOM_TYPE_LABELS[(q as { type: RsvpCustomType }).type] }}
                </span>
                <span v-if="!isBuiltin(q)" class="text-caption text-ink-300">{{ (q as { id: string }).id }}</span>
              </div>

              <!-- 標籤編輯 -->
              <UInput
                v-model="q.label"
                :aria-label="`題目標籤 ${index + 1}`"
                placeholder="題目標籤"
                class="w-full"
              />

              <!-- 補充說明（系統題與自訂題皆可填） -->
              <UInput
                v-model="(q as { description: string }).description"
                :aria-label="`題目說明 ${index + 1}`"
                placeholder="補充說明（選填，例：只有高雄地區的家人才需要選）"
                class="w-full"
              />

              <!-- 顯示對象：限定哪一側親友看得到這題 -->
              <div>
                <label class="mb-1 block text-caption text-ink-300">顯示對象</label>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="opt in AUDIENCE_OPTIONS"
                    :key="opt.value"
                    size="xs"
                    v-bind="choiceProps(audienceOf(q) === opt.value)"
                    :aria-label="`${opt.label} ${q.label}`"
                    @click="setAudience(q, opt.value)"
                  >
                    {{ opt.label }}
                  </UButton>
                </div>
              </div>

              <!-- 自訂題：型別 + 選項 -->
              <template v-if="!isBuiltin(q)">
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="(label, type) in CUSTOM_TYPE_LABELS"
                    :key="type"
                    size="xs"
                    v-bind="choiceProps((q as { type: string }).type === type)"
                    @click="setCustomType(q, type as RsvpCustomType)"
                  >
                    {{ label }}
                  </UButton>
                </div>
                <div v-if="(q as { type: string }).type !== 'text'">
                  <label class="mb-1 block text-caption text-ink-300">選項（一行一個）</label>
                  <UTextarea
                    :model-value="optionsToText(q)"
                    :rows="3"
                    placeholder="選項一&#10;選項二"
                    class="w-full"
                    @update:model-value="setOptions(q, String($event))"
                  />
                </div>
              </template>
            </div>

            <!-- 開關 / 刪除 -->
            <div class="flex flex-col items-end gap-2">
              <USwitch
                v-if="isBuiltin(q)"
                v-model="(q as { enabled: boolean }).enabled"
                :aria-label="`${(q as { enabled: boolean }).enabled ? '停用' : '啟用'} ${q.label}`"
              />
              <UButton
                v-else
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="`刪除 ${q.label}`"
                @click="removeCustom(index)"
              />
            </div>
          </div>
        </div>

        <!-- 虛線邀請框：新增自訂題 -->
        <UButton
          icon="i-heroicons-plus"
          color="neutral"
          variant="ghost"
          block
          class="border border-dashed border-line text-ink-500 hover:border-gold hover:text-gold-deep"
          @click="addCustom"
        >
          新增題目
        </UButton>
      </section>

      <!-- 右：即時預覽（紙感框，統一套系） -->
      <section class="stable-scroll rounded-lg border border-line bg-paper-soft p-4 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:p-6">
        <div class="mb-5 flex items-center justify-center gap-3">
          <span class="h-px w-10 bg-gold" />
          <p class="text-overline uppercase text-gold-deep">
            賓客表單預覽
          </p>
          <span class="h-px w-10 bg-gold" />
        </div>
        <div class="mx-auto max-w-md rounded-lg bg-white p-6 shadow dark:bg-neutral-900">
          <RsvpForm
            :config="draft"
            :groom-name="groomName"
            :bride-name="brideName"
            :wedding-date="wedding?.date"
            :venue="wedding?.venue"
            preview
          />
        </div>
      </section>
    </div>
  </div>
</template>
