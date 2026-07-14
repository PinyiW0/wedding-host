<!-- app/components/seating/SeatingMarkerModal.vue -->
<script setup lang="ts">
import type { VenueMarkerListItem } from '~/types/api/seating'
import { createVenueMarker, deleteVenueMarker, updateVenueMarker } from '~/api'

const props = defineProps<{
  weddingId: string
  /** 編輯對象；null 為加入模式 */
  marker: VenueMarkerListItem | null
  /** 編輯對象目前畫布位置（含拖曳中的本地覆寫） */
  position: { x: number, y: number } | null
}>()

const emit = defineEmits<{
  changed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()

const isSubmitting = ref(false)
const formError = ref('')
const draft = reactive({ label: '', width: 140, height: 48, positionX: 24, positionY: 24 })

// 開啟時依模式帶入初始值（編輯帶原值與目前位置、加入回預設）
watch(isOpen, (open) => {
  if (!open)
    return
  formError.value = ''
  draft.label = props.marker?.label ?? ''
  draft.width = props.marker?.width ?? 140
  draft.height = props.marker?.height ?? 48
  draft.positionX = props.position?.x ?? 24
  draft.positionY = props.position?.y ?? 24
})

async function submitMarker() {
  if (isSubmitting.value)
    return
  const label = draft.label.trim()
  if (!label) {
    formError.value = '請輸入標記文字'
    return
  }
  isSubmitting.value = true
  formError.value = ''
  try {
    if (props.marker) {
      await updateVenueMarker(props.weddingId, props.marker.markerId, {
        label,
        width: Number(draft.width) || 140,
        height: Number(draft.height) || 48,
        positionX: Number(draft.positionX) || 0,
        positionY: Number(draft.positionY) || 0,
      })
      toast.add({ title: '標記已更新', color: 'success' })
    }
    else {
      await createVenueMarker(props.weddingId, {
        label,
        width: Number(draft.width) || 140,
        height: Number(draft.height) || 48,
      })
      toast.add({ title: '標記已加入', color: 'success' })
    }
    isOpen.value = false
    emit('changed')
  }
  catch (error: any) {
    formError.value = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}

async function removeMarker() {
  if (!props.marker || isSubmitting.value)
    return
  isSubmitting.value = true
  try {
    await deleteVenueMarker(props.weddingId, props.marker.markerId)
    toast.add({ title: '標記已刪除', color: 'success' })
    isOpen.value = false
    emit('changed')
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '刪除失敗，請稍後再試'
    toast.add({ title: '刪除失敗', description: message, color: 'error' })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="venue-marker-modal" class="max-h-[85vh] overflow-y-auto p-6">
        <p class="text-overline uppercase text-gold-deep">
          Marker
        </p>
        <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
          {{ marker ? '編輯標記' : '加入標記' }}
        </h3>
        <p class="mb-5 mt-1 text-caption text-ink-300">
          在平面圖上標示門口、送客區、進場入口等位置；加入後可直接拖曳調整
        </p>

        <UAlert
          v-if="formError"
          data-testid="venue-marker-error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="formError"
          class="mb-4"
        />

        <div class="space-y-4">
          <UFormField label="標記文字" name="markerLabel">
            <UInput
              v-model="draft.label"
              data-testid="venue-marker-label"
              placeholder="如：門口、送客區、進場入口"
              class="w-full"
              @keyup.enter="submitMarker"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="寬（px）" name="markerWidth">
              <UInput
                v-model.number="draft.width"
                type="number"
                min="40"
                class="w-full"
              />
            </UFormField>
            <UFormField label="高（px）" name="markerHeight">
              <UInput
                v-model.number="draft.height"
                type="number"
                min="24"
                class="w-full"
              />
            </UFormField>
          </div>

          <div v-if="marker" class="grid grid-cols-2 gap-3">
            <UFormField label="X 位置" name="markerX">
              <UInput
                v-model.number="draft.positionX"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Y 位置" name="markerY">
              <UInput
                v-model.number="draft.positionY"
                type="number"
                min="0"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between gap-3">
          <UButton
            v-if="marker"
            data-testid="venue-marker-delete"
            icon="i-heroicons-trash"
            color="error"
            variant="outline"
            :loading="isSubmitting"
            @click="removeMarker"
          >
            刪除標記
          </UButton>
          <span v-else />
          <div class="flex gap-3">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isSubmitting"
              @click="isOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="venue-marker-submit"
              color="neutral"
              variant="solid"
              :loading="isSubmitting"
              @click="submitMarker"
            >
              儲存標記
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
