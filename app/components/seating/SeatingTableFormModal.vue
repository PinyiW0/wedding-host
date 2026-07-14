<!-- app/components/seating/SeatingTableFormModal.vue -->
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CreateTableBody, TableListItem, UpdateTableBody } from '~/types/api/seating'
import { z } from 'zod'
import { createTable, updateTable } from '~/api'

const props = defineProps<{
  weddingId: string
  /** 編輯對象；null 為新增模式（顯示批次數量欄） */
  table: TableListItem | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const toast = useToast()

const tableSchema = z.object({
  tableName: z.string().trim().min(1, '請輸入桌次名稱'),
  capacity: z.number().int().min(1, '座位數至少 1'),
  positionX: z.number().int(),
  positionY: z.number().int(),
  // 批次新增桌數（僅新增模式使用；編輯模式固定 1）
  count: z.number().int().min(1, '至少 1 桌').max(20, '一次最多 20 桌'),
})
type TableSchema = z.output<typeof tableSchema>

const isSubmitting = ref(false)
const formError = ref('')
const state = reactive<TableSchema>({
  tableName: '',
  capacity: 10,
  positionX: 0,
  positionY: 0,
  count: 1,
})

// 開啟時依模式帶入初始值（編輯帶原值、新增回預設）
watch(isOpen, (open) => {
  if (!open)
    return
  formError.value = ''
  state.tableName = props.table?.tableName ?? ''
  state.capacity = props.table?.capacity ?? 10
  state.positionX = props.table?.positionX ?? 0
  state.positionY = props.table?.positionY ?? 0
  state.count = 1
})

async function onSubmit(event: FormSubmitEvent<TableSchema>) {
  if (isSubmitting.value)
    return
  isSubmitting.value = true
  formError.value = ''
  try {
    const data = event.data
    if (props.table) {
      const body: UpdateTableBody = {
        tableName: data.tableName,
        capacity: data.capacity,
        positionX: data.positionX,
        positionY: data.positionY,
      }
      await updateTable(props.weddingId, props.table.tableId, body)
      toast.add({ title: '桌次已更新', color: 'success' })
    }
    else if (data.count <= 1) {
      const body: CreateTableBody = {
        tableName: data.tableName,
        capacity: data.capacity,
        positionX: data.positionX,
        positionY: data.positionY,
      }
      await createTable(props.weddingId, body)
      toast.add({ title: '桌次新增成功', color: 'success' })
    }
    else {
      // 批次新增：名稱加流水號、位置以 3 欄格狀階梯展開（避免全疊在同一點）
      for (let i = 0; i < data.count; i++) {
        const body: CreateTableBody = {
          tableName: `${data.tableName}${i + 1}`,
          capacity: data.capacity,
          positionX: data.positionX + (i % 3) * 200,
          positionY: data.positionY + Math.floor(i / 3) * 310,
        }
        await createTable(props.weddingId, body)
      }
      toast.add({ title: `已新增 ${data.count} 桌`, color: 'success' })
    }
    isOpen.value = false
    emit('saved')
  }
  catch (error: any) {
    formError.value
      = error?.data?.message || error?.statusMessage || '操作失敗，請稍後再試'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="table-form-modal" class="p-6">
        <p class="text-overline uppercase text-gold-deep">
          桌次
        </p>
        <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink">
          {{ table ? '編輯桌次' : '新增桌次' }}
        </h3>

        <UAlert
          v-if="formError"
          data-testid="table-error"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="formError"
          class="mb-4"
        />

        <UForm
          :schema="tableSchema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            label="桌次名稱"
            name="tableName"
            class="relative mb-6"
            :ui="{ error: 'absolute top-full left-0 mt-1' }"
          >
            <UInput
              v-model="state.tableName"
              data-testid="table-name"
              placeholder="如：主桌、男方家屬桌"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="座位數"
            name="capacity"
            class="relative mb-6"
            :ui="{ error: 'absolute top-full left-0 mt-1' }"
          >
            <UInput
              v-model.number="state.capacity"
              data-testid="table-capacity"
              type="number"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="!table"
            label="一次新增幾桌"
            name="count"
            class="relative mb-6"
            :ui="{ error: 'absolute top-full left-0 mt-1' }"
          >
            <UInput
              v-model.number="state.count"
              data-testid="table-batch-count"
              type="number"
              min="1"
              max="20"
              class="w-full"
            />
            <p class="mt-1 text-caption text-ink-300">
              超過 1 桌時，名稱自動加流水號、位置階梯展開
            </p>
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="位置 X" name="positionX">
              <UInput
                v-model.number="state.positionX"
                data-testid="table-position-x"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UFormField label="位置 Y" name="positionY">
              <UInput
                v-model.number="state.positionY"
                data-testid="table-position-y"
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
              data-testid="table-submit"
              color="primary"
              :loading="isSubmitting"
            >
              {{ table ? '儲存' : '新增' }}
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
