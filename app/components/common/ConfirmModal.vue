<!-- app/components/common/ConfirmModal.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
    confirmLabel?: string
    confirmColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
    loading?: boolean
  }>(),
  {
    title: '確認操作',
    description: '確定要執行此操作嗎？',
    confirmLabel: '確認',
    confirmColor: 'primary',
    loading: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div data-testid="confirm-modal" class="bg-paper p-8 dark:bg-neutral-900">
        <h3 class="text-body-l font-semibold text-ink dark:text-paper">
          {{ title }}
        </h3>
        <p class="mt-3 text-body text-ink-500 dark:text-neutral-400">
          {{ description }}
        </p>
        <div class="mt-8 flex justify-end gap-3">
          <!-- 額外動作（選用）：置於取消左側，如「移至其他座位」 -->
          <slot name="extra" />
          <UButton
            data-testid="confirm-cancel"
            color="neutral"
            variant="outline"
            :disabled="loading"
            @click="emit('cancel'); isOpen = false"
          >
            取消
          </UButton>
          <UButton
            data-testid="confirm-ok"
            :color="confirmColor"
            :loading="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
