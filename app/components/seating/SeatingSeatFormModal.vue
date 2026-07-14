<!-- app/components/seating/SeatingSeatFormModal.vue -->
<script setup lang="ts">
import type { SeatGuestBody } from '~/types/api/seating'
import { seatGuest } from '~/api'

const props = defineProps<{
  weddingId: string
  guestOptions: { label: string, value: string }[]
  tableOptions: { label: string, value: string }[]
  /** 改選桌次時建議下一個座位號 */
  suggestSeatNumber: (tableId: string) => number
}>()

const emit = defineEmits<{
  seated: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()

const isSeating = ref(false)
const formError = ref('')
const state = reactive<{ guestId: string, tableId: string, seatNumber: number }>({
  guestId: '',
  tableId: '',
  seatNumber: 1,
})

watch(isOpen, (open) => {
  if (!open)
    return
  formError.value = ''
  state.guestId = ''
  state.tableId = ''
  state.seatNumber = 1
})

// 在 Modal 內改選桌次時，自動建議下一個座位號
function onTableChange(tableId: string) {
  state.seatNumber = props.suggestSeatNumber(tableId)
}

async function confirmSeat() {
  if (isSeating.value)
    return
  if (!state.guestId || !state.tableId) {
    formError.value = '請選擇賓客與桌次'
    return
  }
  isSeating.value = true
  formError.value = ''
  try {
    const body: SeatGuestBody = {
      guestId: state.guestId,
      seatNumber: state.seatNumber,
    }
    await seatGuest(props.weddingId, state.tableId, body)
    toast.add({ title: '已安排座位', color: 'success' })
    isOpen.value = false
    emit('seated')
  }
  catch (error: any) {
    formError.value
      = error?.data?.message || error?.statusMessage || '安排失敗，請稍後再試'
  }
  finally {
    isSeating.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="seat-form-modal" class="p-6">
        <p class="text-overline uppercase text-gold-deep">
          座位
        </p>
        <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
          安排座位
        </h3>

        <UAlert
          v-if="formError"
          data-testid="seat-error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="formError"
          class="mb-4"
        />

        <div class="space-y-4">
          <UFormField label="賓客" name="guestId">
            <USelectMenu
              v-model="state.guestId"
              data-testid="seat-guest-select"
              :items="guestOptions"
              value-key="value"
              placeholder="選擇賓客"
              class="w-full"
            />
          </UFormField>

          <UFormField label="桌次" name="tableId">
            <USelectMenu
              v-model="state.tableId"
              data-testid="seat-table-select"
              :items="tableOptions"
              value-key="value"
              placeholder="選擇桌次"
              class="w-full"
              @update:model-value="onTableChange"
            />
          </UFormField>

          <UFormField label="座位號" name="seatNumber">
            <UInput
              v-model.number="state.seatNumber"
              data-testid="seat-number"
              type="number"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isSeating"
              @click="isOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="seat-submit"
              color="primary"
              :loading="isSeating"
              @click="confirmSeat"
            >
              安排
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
