<!-- app/components/common/FileUpload.vue -->
<!--
  通用檔案選擇 / 拖放元件（enabled_features: fileUpload）
  本專案無通用 /api/upload 端點，各頁面 API 合約不同：
    - 賓客批次匯入：以 { fileName } JSON 呼叫 import API
    - 祝福照片 / 謝卡圖片：以 dataUrl 處理
  因此本 wrapper 只負責「取得使用者選擇的檔案」，由父層決定如何上送。
-->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    accept?: string
    maxSizeMb?: number
    label?: string
    hint?: string
  }>(),
  {
    accept: 'image/*',
    maxSizeMb: 5,
    label: '點擊或拖放檔案上傳',
    hint: '',
  },
)

const emit = defineEmits<{
  // 選到合法檔案：回傳 File 物件、檔名、以及 base64 dataUrl（供圖片預覽 / 上送）
  selected: [payload: { file: File, name: string, dataUrl: string }]
  error: [message: string]
}>()

const inputRef = ref<HTMLInputElement>()
const isDragging = ref(false)
const isReading = ref(false)
const selectedName = ref('')

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.readAsDataURL(file)
  })
}

async function handleFiles(files: FileList | null) {
  if (!files?.length)
    return
  const file = files[0]!

  if (file.size > props.maxSizeMb * 1024 * 1024) {
    emit('error', `檔案大小不可超過 ${props.maxSizeMb}MB`)
    return
  }

  isReading.value = true
  try {
    const dataUrl = await readAsDataUrl(file)
    selectedName.value = file.name
    emit('selected', { file, name: file.name, dataUrl })
  }
  catch {
    emit('error', '讀取檔案失敗')
  }
  finally {
    isReading.value = false
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}
</script>

<template>
  <div
    data-testid="file-upload"
    class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors"
    :class="isDragging
      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
      : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700'"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
    @click="inputRef?.click()"
  >
    <UIcon name="i-heroicons-cloud-arrow-up" class="size-8 text-neutral-400" />
    <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
      {{ label }}
    </p>
    <p class="text-xs text-neutral-400">
      {{ hint || `最大 ${maxSizeMb}MB` }}
    </p>
    <p v-if="selectedName" data-testid="file-upload-name" class="mt-2 text-sm text-primary-600 dark:text-primary-400">
      {{ selectedName }}
    </p>
    <input
      ref="inputRef"
      data-testid="file-upload-input"
      type="file"
      class="hidden"
      :accept="accept"
      @change="handleFiles(($event.target as HTMLInputElement).files)"
    >
    <UButton v-if="isReading" loading disabled class="mt-2">
      讀取中...
    </UButton>
  </div>
</template>
