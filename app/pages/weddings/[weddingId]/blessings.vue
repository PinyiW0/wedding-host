<!-- app/pages/weddings/[weddingId]/blessings.vue -->
<script setup lang="ts">
import type {
  BlessingListItem,
  BlessingStatus,
  BlessingWallStatus,
  RejectBlessingBody,
} from '~/types/api/blessings'
import type { ProjectionMediaType, UpdateProjectionSettingsBody } from '~/types/api/projection'
import QRCode from 'qrcode'
import { approveBlessing, getProjectionSettings, getSignedLink, listBlessings, projectBlessing, rejectBlessing, updateProjectionSettings } from '~/api'
import { blessingStatusMeta } from '~/utils/statusMeta'
import { toYouTubeEmbed } from '~/utils/videoEmbed'

definePageMeta({ layout: 'default' })

const route = useRoute()
const toast = useToast()
const weddingId = computed(() => String(route.params.weddingId))
const { uploadImage } = useImageUpload()

const { data: blessings } = await listBlessings(weddingId, { default: () => [] })

const items = computed(() => blessings.value ?? [])

// 投影即時推送：approve / 推到投影幕 / 更新投影設定 → 通知開著的投影牆即時更新
const { broadcast } = useProjectionChannel(weddingId)

// === 投影設定（中央媒體 + 自訂花朵）===
const { data: projectionSettings, refresh: refreshProjectionSettings } = await getProjectionSettings(weddingId, {
  default: () => null,
})

const isProjectionSettingsOpen = ref(false)
const isSettingsSaving = ref(false)
const settingsDraft = reactive({
  mediaType: 'none' as ProjectionMediaType,
  photoDataUrl: '',
  videoUrl: '',
  customFlowers: [] as string[],
})

const MEDIA_OPTIONS: { label: string, value: ProjectionMediaType }[] = [
  { label: '無', value: 'none' },
  { label: '照片', value: 'photo' },
  { label: '影片', value: 'video' },
]

// 共用祝福 QR（issue #17）：w. 婚禮簽名連結，現場立牌供賓客掃碼自填姓名送祝福
const isSharedBlessingOpen = ref(false)
const sharedBlessingUrl = ref('')
const sharedBlessingQr = ref('')
const sharedBlessingError = ref(false)
async function openSharedBlessingQr() {
  isSharedBlessingOpen.value = true
  if (sharedBlessingQr.value)
    return
  sharedBlessingError.value = false
  try {
    const { sig } = await getSignedLink(weddingId.value)
    sharedBlessingUrl.value = `${window.location.origin}/blessing/${weddingId.value}?sig=${sig}`
    sharedBlessingQr.value = await QRCode.toDataURL(sharedBlessingUrl.value, { width: 320, margin: 1 })
  }
  catch {
    sharedBlessingError.value = true
  }
}

async function copySharedBlessingLink() {
  try {
    await navigator.clipboard.writeText(sharedBlessingUrl.value)
    toast.add({ title: '已複製共用祝福連結', description: sharedBlessingUrl.value, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: sharedBlessingUrl.value, color: 'error' })
  }
}

// 複製附簽名的投影牆連結：供未登入的現場投影設備開啟（enforced 模式憑簽名放行）
async function copyProjectionLink() {
  const base = `${window.location.origin}/projection/${weddingId.value}`
  try {
    const { sig } = await getSignedLink(weddingId.value)
    const url = `${base}?sig=${sig}`
    await navigator.clipboard.writeText(url)
    toast.add({ title: '已複製投影連結', description: url, color: 'success' })
  }
  catch {
    toast.add({ title: '複製失敗', description: base, color: 'error' })
  }
}

function openProjectionSettings() {
  const s = projectionSettings.value
  settingsDraft.mediaType = s?.mediaType ?? 'none'
  settingsDraft.photoDataUrl = s?.photoDataUrl ?? ''
  settingsDraft.videoUrl = s?.videoUrl ?? ''
  settingsDraft.customFlowers = [...(s?.customFlowers ?? [])]
  isProjectionSettingsOpen.value = true
}

// 依連結即時提示播放方式
const videoHint = computed(() => {
  const url = settingsDraft.videoUrl.trim()
  if (!url)
    return ''
  return toYouTubeEmbed(url) ? '將以 YouTube 內嵌播放' : '將以影片檔播放'
})

function onProjectionPhotoSelected(payload: { dataUrl: string }) {
  settingsDraft.photoDataUrl = payload.dataUrl
}
function onCustomFlowerSelected(payload: { dataUrl: string }) {
  settingsDraft.customFlowers = [...settingsDraft.customFlowers, payload.dataUrl]
}
function removeCustomFlower(index: number) {
  settingsDraft.customFlowers = settingsDraft.customFlowers.filter((_, i) => i !== index)
}
function onUploadError(message: string) {
  toast.add({ title: '上傳失敗', description: message, color: 'error' })
}

async function saveProjectionSettings() {
  if (isSettingsSaving.value)
    return
  isSettingsSaving.value = true
  try {
    // R2 啟用時照片與花朵圖逐張直傳（已是 URL 的原樣保留）；本機模式維持 dataURL
    const photoDataUrl = settingsDraft.photoDataUrl
      ? await uploadImage(settingsDraft.photoDataUrl, weddingId.value, 'projection')
      : ''
    const customFlowers: string[] = []
    for (const flower of settingsDraft.customFlowers)
      customFlowers.push(await uploadImage(flower, weddingId.value, 'projection'))
    const body: UpdateProjectionSettingsBody = {
      mediaType: settingsDraft.mediaType,
      photoDataUrl: photoDataUrl || null,
      videoUrl: settingsDraft.videoUrl.trim() || null,
      customFlowers,
    }
    await updateProjectionSettings(weddingId.value, body)
    broadcast()
    toast.add({ title: '投影設定已儲存', color: 'success' })
    isProjectionSettingsOpen.value = false
    await refreshProjectionSettings()
  }
  catch (error: any) {
    toast.add({
      title: '儲存失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    isSettingsSaving.value = false
  }
}

// 頭像金圓首字：取留言內容首字作為編輯式裝飾（無姓名欄位時的視覺替代）
function initialOf(blessing: BlessingListItem) {
  return blessing.message.trim().charAt(0) || '祝'
}

function setStatus(
  blessingId: string,
  status: BlessingStatus,
  reason: string | null = null,
  wallStatus?: BlessingWallStatus,
) {
  // useFetch 的 data 為 shallowRef，深層 mutate 不觸發響應；以重新賦值整個陣列觸發更新
  blessings.value = (blessings.value ?? []).map(b =>
    b.blessingId === blessingId
      ? { ...b, status, rejectReason: reason, ...(wallStatus !== undefined ? { wallStatus } : {}) }
      : b,
  )
}

// === 推到投影幕 ===
const projectingId = ref<string | null>(null)
async function doProject(blessing: BlessingListItem) {
  if (projectingId.value)
    return
  projectingId.value = blessing.blessingId
  try {
    const res = await projectBlessing(weddingId.value, blessing.blessingId)
    setStatus(blessing.blessingId, blessing.status, blessing.rejectReason, res.wallStatus)
    broadcast()
    toast.add({ title: '已推到投影幕', color: 'success' })
  }
  catch (error: any) {
    toast.add({
      title: '推送失敗',
      description: error?.data?.message || error?.statusMessage || '請稍後再試',
      color: 'error',
    })
  }
  finally {
    projectingId.value = null
  }
}

// === 審核通過 ===
const isApproveOpen = ref(false)
const isApproving = ref(false)
const approveTarget = ref<BlessingListItem | null>(null)

function openApprove(blessing: BlessingListItem) {
  approveTarget.value = blessing
  isApproveOpen.value = true
}

async function confirmApprove() {
  if (!approveTarget.value || isApproving.value)
    return
  isApproving.value = true
  const blessingId = approveTarget.value.blessingId
  try {
    const res = await approveBlessing(weddingId.value, blessingId)
    setStatus(blessingId, res.status, null, 'pending_wall')
    broadcast()
    toast.add({ title: '祝福已通過', color: 'success' })
    isApproveOpen.value = false
  }
  catch (error: any) {
    const message = error?.data?.message || error?.statusMessage || '審核失敗，請稍後再試'
    toast.add({ title: '審核失敗', description: message, color: 'error' })
  }
  finally {
    isApproving.value = false
  }
}

// === 審核拒絕 ===
const isRejectOpen = ref(false)
const isRejecting = ref(false)
const rejectError = ref('')
const rejectTarget = ref<BlessingListItem | null>(null)
const rejectReason = ref('')

function openReject(blessing: BlessingListItem) {
  rejectTarget.value = blessing
  rejectReason.value = ''
  rejectError.value = ''
  isRejectOpen.value = true
}

async function submitReject() {
  if (!rejectTarget.value || isRejecting.value)
    return
  if (!rejectReason.value.trim()) {
    rejectError.value = '請輸入拒絕原因'
    return
  }
  isRejecting.value = true
  rejectError.value = ''
  const blessingId = rejectTarget.value.blessingId
  try {
    const body: RejectBlessingBody = { reason: rejectReason.value.trim() }
    const res = await rejectBlessing(weddingId.value, blessingId, body)
    setStatus(blessingId, res.status, res.reason)
    toast.add({ title: '祝福已拒絕', color: 'success' })
    isRejectOpen.value = false
  }
  catch (error: any) {
    // 失敗訊息僅 inline 顯示（避免與 toast 重複觸發 strict mode）
    rejectError.value
      = error?.data?.message || error?.statusMessage || '審核失敗，請稍後再試'
  }
  finally {
    isRejecting.value = false
  }
}
</script>

<template>
  <div data-testid="blessings-page" class="flex h-full flex-col">
    <PageHeader
      title="投影祝福審核"
      eyebrow="Guest Blessings"
      description="審核賓客提交的祝福留言（通過 / 拒絕），並推到投影即時牆"
    >
      <template #actions>
        <div class="flex items-center gap-3">
          <UButton
            data-testid="vibe-shared-blessing-qr"
            icon="i-heroicons-qr-code"
            color="neutral"
            variant="outline"
            @click="openSharedBlessingQr"
          >
            共用祝福 QR
          </UButton>
          <UButton
            data-testid="projection-settings"
            icon="i-heroicons-cog-6-tooth"
            color="neutral"
            variant="outline"
            @click="openProjectionSettings"
          >
            投影設定
          </UButton>
          <UButton
            data-testid="vibe-copy-projection-link"
            icon="i-heroicons-link"
            color="neutral"
            variant="outline"
            aria-label="複製投影連結"
            @click="copyProjectionLink"
          >
            複製投影連結
          </UButton>
          <UButton
            data-testid="open-projection"
            icon="i-heroicons-tv"
            color="primary"
            variant="solid"
            :to="`/projection/${weddingId}`"
            target="_blank"
            external
          >
            開啟投影牆
          </UButton>
        </div>
      </template>
    </PageHeader>

    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="items.length === 0">
        <EmptyState title="目前沒有祝福" description="賓客提交祝福後會顯示於此" />
      </div>

      <ul v-else class="space-y-4">
        <li
          v-for="blessing in items"
          :key="blessing.blessingId"
          :data-testid="`blessing-row-${blessing.blessingId}`"
          :aria-label="blessing.message"
          class="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div class="flex items-start gap-5">
            <!-- 頭像金圓 + Cormorant 首字 -->
            <div
              class="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-light font-display text-2xl text-gold-deep"
              aria-hidden="true"
            >
              {{ initialOf(blessing) }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p class="text-caption uppercase tracking-wide text-ink-500">
                  {{ blessing.guestName ? `${blessing.guestName} · 現場填寫` : `賓客 · ${blessing.guestId}` }}
                </p>
                <div class="flex shrink-0 items-center gap-2">
                  <StatusBadge :color="blessingStatusMeta(blessing.status).color">
                    {{ blessingStatusMeta(blessing.status).label }}
                  </StatusBadge>
                </div>
              </div>

              <p class="mt-2 text-body-l leading-relaxed text-ink-700 dark:text-neutral-200">
                {{ blessing.message }}
              </p>

              <img
                v-if="blessing.photoUrl"
                :src="blessing.photoUrl"
                alt="祝福照片"
                class="mt-3 max-h-32 rounded-lg border border-line object-cover"
              >
              <p
                v-if="blessing.rejectReason"
                class="mt-2 border-l-[3px] border-gold pl-3 text-body text-ink-500"
              >
                拒絕原因：{{ blessing.rejectReason }}
              </p>

              <div
                v-if="blessing.status === 'submitted'"
                class="mt-4 flex gap-2 border-t border-line pt-4"
              >
                <UButton
                  :data-testid="`blessing-approve-${blessing.blessingId}`"
                  color="neutral"
                  variant="solid"
                  size="sm"
                  @click="openApprove(blessing)"
                >
                  通過
                </UButton>
                <UButton
                  :data-testid="`blessing-reject-${blessing.blessingId}`"
                  color="error"
                  variant="outline"
                  size="sm"
                  @click="openReject(blessing)"
                >
                  拒絕
                </UButton>
              </div>

              <!-- 已通過：上牆狀態 + 推到投影幕 -->
              <div
                v-else-if="blessing.status === 'approved'"
                class="mt-4 flex items-center gap-3 border-t border-line pt-4"
              >
                <UBadge
                  :color="blessing.wallStatus === 'on_wall' ? 'success' : 'warning'"
                  variant="soft"
                >
                  {{ blessing.wallStatus === 'on_wall' ? '已上牆' : '待上牆' }}
                </UBadge>
                <UButton
                  v-if="blessing.wallStatus !== 'on_wall'"
                  :data-testid="`blessing-project-${blessing.blessingId}`"
                  color="primary"
                  variant="outline"
                  size="sm"
                  icon="i-heroicons-tv"
                  :loading="projectingId === blessing.blessingId"
                  @click="doProject(blessing)"
                >
                  推到投影幕
                </UButton>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 審核通過確認 -->
    <ConfirmModal
      v-model:open="isApproveOpen"
      title="審核通過祝福"
      :description="`確定要通過此祝福嗎？「${approveTarget?.message ?? ''}」`"
      confirm-label="確認通過"
      confirm-color="success"
      :loading="isApproving"
      @confirm="confirmApprove"
    />

    <!-- 審核拒絕 Modal -->
    <UModal v-model:open="isRejectOpen">
      <template #content>
        <div data-testid="blessing-reject-modal" class="p-6">
          <p class="text-overline uppercase text-gold-deep">
            Review
          </p>
          <h3 class="mb-4 mt-1 text-body-l font-semibold text-ink dark:text-paper">
            審核拒絕祝福
          </h3>

          <UAlert
            v-if="rejectError"
            data-testid="blessing-reject-error"
            icon="i-heroicons-exclamation-triangle"
            color="error"
            variant="soft"
            :title="rejectError"
            class="mb-4"
          />

          <div class="space-y-4">
            <UFormField label="拒絕原因" name="reason">
              <UTextarea
                v-model="rejectReason"
                data-testid="blessing-reject-reason"
                :rows="3"
                placeholder="請輸入拒絕原因"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-3 pt-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="isRejecting"
                @click="isRejectOpen = false"
              >
                取消
              </UButton>
              <UButton
                data-testid="blessing-reject-submit"
                color="error"
                :loading="isRejecting"
                @click="submitReject"
              >
                送出拒絕
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 投影設定 Slideover（中央媒體 + 自訂花朵；儲存鈕命名避開凍結 regex：拒絕/送出/確定/退回/通過） -->
    <USlideover v-model:open="isProjectionSettingsOpen">
      <template #content>
        <div data-testid="projection-settings-panel" class="flex h-full flex-col overflow-y-auto p-6">
          <p class="text-overline uppercase text-gold-deep">
            Projection
          </p>
          <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
            投影設定
          </h3>
          <p class="mb-6 mt-1 text-caption text-ink-300">
            設定投影牆中央的照片／影片與花朵裝飾；儲存後投影牆即時更新
          </p>

          <div class="space-y-6">
            <!-- 中央媒體型態 -->
            <div>
              <div class="mb-3 flex items-center gap-3">
                <p class="text-overline uppercase text-gold-deep">
                  中央媒體
                </p>
                <span class="h-px flex-1 bg-line" />
              </div>
              <div class="flex gap-2">
                <UButton
                  v-for="opt in MEDIA_OPTIONS"
                  :key="opt.value"
                  :color="settingsDraft.mediaType === opt.value ? 'primary' : 'neutral'"
                  :variant="settingsDraft.mediaType === opt.value ? 'solid' : 'outline'"
                  size="sm"
                  @click="settingsDraft.mediaType = opt.value"
                >
                  {{ opt.label }}
                </UButton>
              </div>
            </div>

            <!-- 照片上傳 -->
            <div v-if="settingsDraft.mediaType === 'photo'">
              <div v-if="settingsDraft.photoDataUrl" class="space-y-3">
                <img
                  :src="settingsDraft.photoDataUrl"
                  alt="投影照片預覽"
                  class="max-h-48 w-full rounded-lg border border-line object-cover"
                >
                <UButton
                  icon="i-heroicons-trash"
                  color="error"
                  variant="outline"
                  size="sm"
                  @click="settingsDraft.photoDataUrl = ''"
                >
                  移除照片
                </UButton>
              </div>
              <FileUpload
                v-else
                accept="image/*"
                label="點擊或拖放照片"
                hint="將顯示於投影牆中央"
                @selected="onProjectionPhotoSelected"
                @error="onUploadError"
              />
            </div>

            <!-- 影片連結 -->
            <div v-else-if="settingsDraft.mediaType === 'video'">
              <UFormField label="影片連結" name="projectionVideoUrl">
                <UInput
                  v-model="settingsDraft.videoUrl"
                  data-testid="projection-video-url"
                  placeholder="貼上 YouTube 連結或影片檔網址"
                  class="w-full"
                />
              </UFormField>
              <p v-if="videoHint" class="mt-2 text-caption text-gold-deep">
                {{ videoHint }}
              </p>
            </div>

            <!-- 自訂花朵 -->
            <div>
              <div class="mb-3 flex items-center gap-3">
                <p class="text-overline uppercase text-gold-deep">
                  自訂花朵
                </p>
                <span class="h-px flex-1 bg-line" />
              </div>
              <p class="mb-3 text-caption text-ink-500">
                與賓客手繪小花一起做投影裝飾動畫（建議透明背景 PNG）
              </p>
              <div v-if="settingsDraft.customFlowers.length" class="mb-3 flex flex-wrap gap-3">
                <div
                  v-for="(src, i) in settingsDraft.customFlowers"
                  :key="i"
                  class="relative"
                >
                  <img
                    :src="src"
                    :alt="`自訂花朵 ${i + 1}`"
                    class="size-16 rounded border border-line object-contain"
                  >
                  <UButton
                    icon="i-heroicons-x-mark"
                    color="error"
                    variant="solid"
                    size="xs"
                    class="absolute -right-2 -top-2"
                    :aria-label="`移除自訂花朵 ${i + 1}`"
                    @click="removeCustomFlower(i)"
                  />
                </div>
              </div>
              <FileUpload
                accept="image/*"
                label="點擊或拖放花朵圖片（可多次加入）"
                @selected="onCustomFlowerSelected"
                @error="onUploadError"
              />
            </div>
          </div>

          <div class="mt-auto flex justify-end gap-3 pt-6">
            <UButton
              color="neutral"
              variant="outline"
              :disabled="isSettingsSaving"
              @click="isProjectionSettingsOpen = false"
            >
              取消
            </UButton>
            <UButton
              data-testid="projection-settings-save"
              color="neutral"
              variant="solid"
              :loading="isSettingsSaving"
              @click="saveProjectionSettings"
            >
              儲存投影設定
            </UButton>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- 共用祝福 QR：現場立牌可印，賓客掃碼自填姓名送祝福 -->
    <UModal v-model:open="isSharedBlessingOpen">
      <template #content>
        <div data-testid="vibe-shared-blessing-panel" class="flex flex-col items-center p-6 text-center">
          <p class="text-overline uppercase text-gold-deep">
            Shared Blessing
          </p>
          <h3 class="mt-1 text-body-l font-semibold text-ink dark:text-paper">
            共用祝福 QR
          </h3>
          <p class="mt-1 text-caption text-ink-300">
            列印或投放於現場，賓客掃碼後自填姓名即可送出祝福
          </p>

          <p v-if="sharedBlessingError" class="mt-6 text-caption text-ink-500 dark:text-neutral-300">
            連結簽名載入失敗，請稍後再試
          </p>
          <template v-else-if="sharedBlessingQr">
            <img
              :src="sharedBlessingQr"
              alt="共用祝福連結 QR code"
              class="mt-6 size-52 rounded border border-line dark:border-neutral-800"
            >
            <p class="mt-3 w-full truncate text-caption text-ink-500 dark:text-neutral-400">
              {{ sharedBlessingUrl }}
            </p>
            <UButton
              data-testid="vibe-shared-blessing-copy"
              icon="i-heroicons-clipboard-document"
              color="neutral"
              variant="soft"
              class="mt-3"
              @click="copySharedBlessingLink"
            >
              複製連結
            </UButton>
          </template>
          <div v-else class="mt-6 flex h-52 items-center justify-center text-ink-300">
            <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
