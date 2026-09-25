<script setup lang="ts">
const props = defineProps<{
  note: string
  recipient: string
  saveNote: (note: string) => Promise<void>
}>()
const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const error = ref('')
function edit() {
  draft.value = props.note
  error.value = ''
  editing.value = true
}
async function save() {
  if (saving.value)
    return
  saving.value = true
  error.value = ''
  try {
    await props.saveNote(draft.value)
    editing.value = false
  }
  catch {
    error.value = '儲存失敗，請重試；輸入內容已保留。'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-48 max-w-sm">
    <template v-if="editing">
      <UTextarea v-model="draft" data-testid="cake-note-input" :aria-label="`${recipient} 的喜餅備註`" :maxlength="2000" :disabled="saving" autoresize class="w-full" />
      <p v-if="error" role="alert" class="text-caption text-error-600">
        {{ error }}
      </p>
      <div class="mt-1 flex gap-2">
        <UButton data-testid="cake-note-save" size="xs" :loading="saving" @click="save">
          儲存
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" :disabled="saving" @click="editing = false">
          取消
        </UButton>
      </div>
    </template>
    <template v-else>
      <p v-if="note" class="whitespace-pre-wrap break-words text-body text-ink-500 dark:text-neutral-400">
        {{ note }}
      </p>
      <UButton data-testid="cake-note-edit" size="xs" color="neutral" variant="ghost" :aria-label="`編輯 ${recipient} 的喜餅備註`" @click="edit">
        {{ note ? '編輯備註' : '新增備註' }}
      </UButton>
    </template>
  </div>
</template>
