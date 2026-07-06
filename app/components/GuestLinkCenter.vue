<!-- app/components/GuestLinkCenter.vue -->
<script setup lang="ts">
import QRCode from 'qrcode'
import { getSignedLink } from '~/api'

// 連結中心（issue #15）：單一賓客的四類簽名連結 + QR code
// 一枚 g.<guestId>.<digest> 簽名通用四類公開頁（sig 只綁 weddingId+guestId，不綁路徑）
const props = defineProps<{
  weddingId: string
  guest: { guestId: string, name: string } | null
}>()

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()

interface LinkEntry {
  key: string
  label: string
  description: string
  url: string
  qr: string
}

const entries = ref<LinkEntry[]>([])
const isLoading = ref(false)
const loadError = ref(false)

// 四類公開頁的 URL 組法（與各頁面既有的參數形態一致）
function buildLinks(guestId: string, sig: string): Omit<LinkEntry, 'qr'>[] {
  const origin = window.location.origin
  const wid = props.weddingId
  return [
    { key: 'rsvp', label: 'RSVP 出席回覆', description: '婚禮前：填寫出席意願與人數', url: `${origin}/rsvp/${guestId}?weddingId=${wid}&sig=${sig}` },
    { key: 'blessing', label: '祝福上傳', description: '婚禮前後：留言與上傳祝福照片', url: `${origin}/blessing/${wid}?guestId=${guestId}&sig=${sig}` },
    { key: 'checkin', label: '自助報到', description: '婚禮當天：掃碼自助報到', url: `${origin}/checkin?weddingId=${wid}&guestId=${guestId}&sig=${sig}` },
    { key: 'thankyou', label: '謝卡', description: '婚禮後：專屬感謝卡片', url: `${origin}/thankyou/${wid}/${guestId}?sig=${sig}` },
  ]
}

// 面板開啟（或開啟中切換賓客）時取簽名並生成 QR；guestId 比對擋住慢回應覆蓋新賓客的結果
watch([open, () => props.guest?.guestId], async ([isOpen, guestId]) => {
  if (!isOpen || !guestId)
    return
  isLoading.value = true
  loadError.value = false
  entries.value = []
  try {
    const { sig } = await getSignedLink(props.weddingId, guestId)
    if (props.guest?.guestId !== guestId)
      return
    entries.value = await Promise.all(buildLinks(guestId, sig).map(async link => ({
      ...link,
      qr: await QRCode.toDataURL(link.url, { width: 240, margin: 1 }),
    })))
  }
  catch {
    loadError.value = true
  }
  finally {
    if (props.guest?.guestId === guestId)
      isLoading.value = false
  }
})

async function copyLink(entry: LinkEntry) {
  try {
    await navigator.clipboard.writeText(entry.url)
    toast.add({ title: `已複製${entry.label}連結`, description: entry.url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: entry.url, color: 'error' })
  }
}
</script>

<template>
  <USlideover v-model:open="open">
    <template #content>
      <div data-testid="vibe-link-center-panel" class="flex h-full flex-col overflow-y-auto p-6">
        <p class="text-overline uppercase text-gold-deep">
          Link Center
        </p>
        <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
          {{ guest?.name }} 的專屬連結
        </h3>
        <p class="mb-6 mt-1 text-caption text-ink-300">
          四類連結共用同一組簽名，複製傳送或出示 QR code 供賓客掃描
        </p>

        <div v-if="isLoading" class="flex flex-1 items-center justify-center text-ink-300">
          <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />
        </div>

        <div v-else-if="loadError" class="space-y-3 text-center">
          <p class="text-caption text-ink-500 dark:text-neutral-300">
            連結簽名載入失敗，請稍後再試
          </p>
        </div>

        <div v-else class="space-y-5">
          <div
            v-for="entry in entries"
            :key="entry.key"
            :data-testid="`vibe-link-entry-${entry.key}`"
            class="rounded-lg border border-line p-4 dark:border-neutral-800"
          >
            <div class="flex items-start gap-4">
              <img
                :src="entry.qr"
                :alt="`${entry.label} QR code`"
                class="size-24 shrink-0 rounded border border-line dark:border-neutral-800"
              >
              <div class="min-w-0 flex-1">
                <p class="font-medium text-ink dark:text-paper">
                  {{ entry.label }}
                </p>
                <p class="mt-0.5 text-caption text-ink-300">
                  {{ entry.description }}
                </p>
                <p class="mt-2 truncate text-caption text-ink-500 dark:text-neutral-400">
                  {{ entry.url }}
                </p>
                <UButton
                  :data-testid="`vibe-link-copy-${entry.key}`"
                  icon="i-heroicons-clipboard-document"
                  color="neutral"
                  variant="soft"
                  size="xs"
                  class="mt-2"
                  :aria-label="`複製${entry.label}連結`"
                  @click="copyLink(entry)"
                >
                  複製連結
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
