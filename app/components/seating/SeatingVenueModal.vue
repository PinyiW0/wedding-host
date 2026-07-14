<!-- app/components/seating/SeatingVenueModal.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { VenueLayoutBody, VenueLayoutDetail } from '~/types/api/seating'
import { z } from 'zod'
import { configureVenueLayout } from '~/api'

const props = defineProps<{
  weddingId: string
  /** GET 讀回的既有佈局；尚未設定時為 null（維持預設值） */
  layout: VenueLayoutDetail | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()

const venueSchema = z.object({
  stageWidth: z.number().int().min(0),
  stageHeight: z.number().int().min(0),
  stagePositionX: z.number().int(),
  stagePositionY: z.number().int(),
})
type VenueSchema = z.output<typeof venueSchema>

const isSubmitting = ref(false)
const formError = ref('')
const state = reactive<VenueSchema>({
  stageWidth: 300,
  stageHeight: 150,
  stagePositionX: 500,
  stagePositionY: 100,
})

// 開啟時用 GET 讀回的既有佈局填入；尚未設定時維持預設值
watch(isOpen, (open) => {
  if (!open)
    return
  formError.value = ''
  const layout = props.layout
  if (layout) {
    state.stageWidth = layout.stageWidth
    state.stageHeight = layout.stageHeight
    state.stagePositionX = layout.stagePositionX
    state.stagePositionY = layout.stagePositionY
  }
})

async function onSubmit(event: FormSubmitEvent<VenueSchema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    const body: VenueLayoutBody = { ...event.data }
    await configureVenueLayout(props.weddingId, body)
    toast.add({ title: '場地佈局已設定', color: 'success' })
    isOpen.value = false
    // 以 GET 為呈現真實來源（重整也靠 GET），由父層 refresh
    emit('saved')
  }
  catch (error: any) {
    formError.value
      = error?.data?.message || error?.statusMessage || '設定失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="venue-form-modal" class="p-6">
        <p class="text-overline uppercase text-gold-deep">
          場地
        </p>
        <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
          設定舞台位置
        </h3>

        <UAlert
          v-if="formError"
          data-testid="venue-error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="formError"
          class="mb-4"
        />

        <UForm
          :schema="venueSchema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="舞台寬度" name="stageWidth">
              <UInput
                v-model.number="state.stageWidth"
                data-testid="stage-width"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UFormField label="舞台高度" name="stageHeight">
              <UInput
                v-model.number="state.stageHeight"
                data-testid="stage-height"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UFormField label="舞台位置 X" name="stagePositionX">
              <UInput
                v-model.number="state.stagePositionX"
                data-testid="stage-position-x"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UFormField label="舞台位置 Y" name="stagePositionY">
              <UInput
                v-model.number="state.stagePositionY"
                data-testid="stage-position-y"
                type="number"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isSubmitting"
              @click="isOpen = false"
            >
              取消
            </UButton>
            <UButton
              type="submit"
              data-testid="venue-submit"
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
</template>
