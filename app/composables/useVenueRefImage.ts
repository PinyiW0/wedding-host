// app/composables/useVenueRefImage.ts
// 場地參考圖底圖（issue #73 自 seating.vue 拆出，行為不變）：
// 上傳（jpg/png/pdf ≤5MB、PDF 取第一頁轉 PNG）、對位拖曳、縮放，結果持久化於 venue-layout
import type { MaybeRefOrGetter } from 'vue'
import type { VenueLayoutDetail } from '~/types/api/seating'
import { configureVenueLayout } from '~/api'

const REF_SCALE_MIN = 0.25
const REF_SCALE_MAX = 3
const REF_IMAGE_MAX_BYTES = 5 * 1024 * 1024

interface VenueRefImageDeps {
  weddingId: MaybeRefOrGetter<string>
  venueLayout: MaybeRefOrGetter<VenueLayoutDetail | null | undefined>
  refreshVenue: () => Promise<void>
}

export function useVenueRefImage(deps: VenueRefImageDeps) {
  const toast = useToast()
  const layoutValue = () => toValue(deps.venueLayout) ?? null

  // === 底圖呈現（顯示寬度上限 1200 等比縮放；載入後 canvasSize 需納入其範圍）===
  const refImageUrl = computed(() => layoutValue()?.referenceImageUrl ?? null)
  const refImageDims = useVenueRefImageDims(refImageUrl)
  // 底圖調整模式：拖曳移動、按鈕縮放。對位結果持久化於 venue-layout，跨進出頁面保留
  const isAdjustingRefImage = ref(false)
  const refImageTransform = ref({ x: 0, y: 0, scale: 1 })
  watch(refImageUrl, () => {
    isAdjustingRefImage.value = false
    const layout = layoutValue()
    refImageTransform.value = { x: layout?.refImageX ?? 0, y: layout?.refImageY ?? 0, scale: layout?.refImageScale ?? 1 }
  }, { immediate: true })

  // 對位結果寫回 venue-layout：連續拖放／縮放合併為一次 PUT，靜默儲存（失敗才提示）
  let refTransformSaveTimer: ReturnType<typeof setTimeout> | undefined
  async function saveRefImageTransform() {
    clearTimeout(refTransformSaveTimer)
    refTransformSaveTimer = undefined
    const layout = layoutValue()
    if (!layout?.referenceImageUrl)
      return
    const t = refImageTransform.value
    if (t.x === layout.refImageX && t.y === layout.refImageY && t.scale === layout.refImageScale)
      return
    try {
      await configureVenueLayout(toValue(deps.weddingId), {
        stageWidth: layout.stageWidth,
        stageHeight: layout.stageHeight,
        stagePositionX: layout.stagePositionX,
        stagePositionY: layout.stagePositionY,
        refImageX: t.x,
        refImageY: t.y,
        refImageScale: t.scale,
      })
      await deps.refreshVenue()
    }
    catch (error: any) {
      const message = error?.data?.message || error?.statusMessage || '請稍後再試'
      toast.add({ title: '參考圖位置儲存失敗', description: message, color: 'error' })
    }
  }
  function scheduleSaveRefImageTransform() {
    clearTimeout(refTransformSaveTimer)
    refTransformSaveTimer = setTimeout(saveRefImageTransform, 400)
  }
  function resetRefImageTransform() {
    refImageTransform.value = { x: 0, y: 0, scale: 1 }
    scheduleSaveRefImageTransform()
  }
  function finishRefImageAdjust() {
    isAdjustingRefImage.value = false
    void saveRefImageTransform()
  }

  function zoomRefImage(delta: number) {
    const next = Math.round((refImageTransform.value.scale + delta) * 100) / 100
    refImageTransform.value.scale = Math.min(REF_SCALE_MAX, Math.max(REF_SCALE_MIN, next))
    scheduleSaveRefImageTransform()
  }

  // 底圖實際渲染框（位置 + 縮放後尺寸），畫布尺寸與 template 共用
  const refImageBox = computed(() => computeRefImageBox(refImageDims.value, refImageTransform.value))

  const isMovingRefImage = ref(false)
  let refImageDragStart = { px: 0, py: 0, ox: 0, oy: 0 }
  function onRefImagePointerDown(event: PointerEvent) {
    if (!isAdjustingRefImage.value || event.button !== 0)
      return
    isMovingRefImage.value = true
    refImageDragStart = { px: event.clientX, py: event.clientY, ox: refImageTransform.value.x, oy: refImageTransform.value.y }
    window.addEventListener('pointermove', onRefImagePointerMove)
    window.addEventListener('pointerup', onRefImagePointerUp, { once: true })
    event.preventDefault()
  }
  function onRefImagePointerMove(event: PointerEvent) {
    if (!isMovingRefImage.value)
      return
    refImageTransform.value.x = Math.round(refImageDragStart.ox + (event.clientX - refImageDragStart.px))
    refImageTransform.value.y = Math.round(refImageDragStart.oy + (event.clientY - refImageDragStart.py))
  }
  function onRefImagePointerUp() {
    window.removeEventListener('pointermove', onRefImagePointerMove)
    if (isMovingRefImage.value)
      scheduleSaveRefImageTransform()
    isMovingRefImage.value = false
  }

  // === 上傳（jpg / png / pdf ≤ 5MB；PDF 取第一頁轉 PNG 後上傳）===
  const { uploadImage } = useImageUpload()
  const refImageInput = ref<HTMLInputElement | null>(null)
  const isUploadingRefImage = ref(false)

  // PDF 第一頁 → PNG dataURL（pdfjs 動態載入，僅選 PDF 時才抓該 chunk）
  async function pdfToPngDataUrl(file: File): Promise<string> {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
    return canvas.toDataURL('image/png')
  }

  // 寫回 venue-layout（尚無佈局時以預設舞台值一併建立）；換圖／移除時對位一併歸零
  async function saveRefImage(url: string | null) {
    const layout = layoutValue()
    await configureVenueLayout(toValue(deps.weddingId), {
      stageWidth: layout?.stageWidth ?? 360,
      stageHeight: layout?.stageHeight ?? 70,
      stagePositionX: layout?.stagePositionX ?? 270,
      stagePositionY: layout?.stagePositionY ?? 20,
      referenceImageUrl: url,
      refImageX: 0,
      refImageY: 0,
      refImageScale: 1,
    })
    await deps.refreshVenue()
  }

  async function onRefImageSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    // 清空 input 讓同一檔可重選
    input.value = ''
    if (!file || isUploadingRefImage.value)
      return
    const isPdf = file.type === 'application/pdf'
    const isImage = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!isPdf && !isImage) {
      toast.add({ title: '格式不支援', description: '請上傳 JPG、PNG 或 PDF 檔', color: 'error' })
      return
    }
    if (file.size > REF_IMAGE_MAX_BYTES) {
      toast.add({ title: '檔案過大', description: '參考圖上限 5MB，請壓縮後再上傳', color: 'error' })
      return
    }
    isUploadingRefImage.value = true
    try {
      const source = isPdf ? await pdfToPngDataUrl(file) : file
      const url = await uploadImage(source, toValue(deps.weddingId), 'venue')
      await saveRefImage(url)
      toast.add({ title: '參考圖已更新', color: 'success' })
    }
    catch (error: any) {
      const message = error?.data?.message || error?.message || '上傳失敗，請稍後再試'
      toast.add({ title: '上傳失敗', description: message, color: 'error' })
    }
    finally {
      isUploadingRefImage.value = false
    }
  }

  async function removeRefImage() {
    if (isUploadingRefImage.value)
      return
    isUploadingRefImage.value = true
    try {
      await saveRefImage(null)
      toast.add({ title: '參考圖已移除', color: 'success' })
    }
    catch (error: any) {
      const message = error?.data?.message || error?.statusMessage || '移除失敗，請稍後再試'
      toast.add({ title: '移除失敗', description: message, color: 'error' })
    }
    finally {
      isUploadingRefImage.value = false
    }
  }

  // 卸載時參考圖對位有未寫回的變更則立即送出
  onBeforeUnmount(() => {
    if (refTransformSaveTimer !== undefined)
      void saveRefImageTransform()
  })

  return {
    refImageUrl,
    refImageBox,
    refImageTransform,
    isAdjustingRefImage,
    onRefImagePointerDown,
    zoomRefImage,
    resetRefImageTransform,
    finishRefImageAdjust,
    refImageInput,
    isUploadingRefImage,
    onRefImageSelected,
    removeRefImage,
  }
}
