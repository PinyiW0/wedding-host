// app/composables/useVenueCanvasGeometry.ts
// 場地畫布幾何（issue #151）：後台桌次規劃、接待台現場桌次圖、下載桌次圖三處共用的座標計算。
// 抽成單一真理是因為接待台原本用 CSS grid 流動排版、下載圖用「主桌置頂＋兩欄密排」，
// 兩者都對不上後台拖曳出來的 positionX / positionY，現場拿圖對不到實際場地。
import type { MaybeRefOrGetter } from 'vue'
import type { TableListItem, VenueLayoutDetail, VenueMarkerListItem } from '~/types/api/seating'

export interface CanvasPoint { x: number, y: number }
export interface CanvasBox extends CanvasPoint { width: number, height: number }

// 桌位格寬：主桌 200px、其餘 168px（圓桌為格的 64% 置中，座位環繞其外）
export function tableBoxWidth(isMain: boolean): number {
  return isMain ? 200 : 168
}

// 畫布尺寸推算用的單桌佔位（比格寬多留座位環與 hover 提示的餘裕）
const TABLE_BLOCK = 290
const CANVAS_PAD = 48
const CANVAS_MIN_WIDTH = 640
const CANVAS_MIN_HEIGHT = 420

interface CanvasExtentInput {
  tables: TableListItem[]
  markers: VenueMarkerListItem[]
  tablePos: (table: TableListItem) => CanvasPoint
  markerPos: (marker: VenueMarkerListItem) => CanvasPoint
  stageBox: CanvasBox | null
  refImageBox: CanvasBox | null
}

interface ContentBoundsInput extends CanvasExtentInput {
  isMainTable: (table: TableListItem) => boolean
}

// 舞台框：位置與尺寸取自 venueLayout；override 供拖曳中的本地覆寫
export function computeStageBox(
  layout: VenueLayoutDetail | null | undefined,
  override?: CanvasPoint | null,
): CanvasBox | null {
  if (!layout)
    return null
  const pos = override ?? { x: layout.stagePositionX, y: layout.stagePositionY }
  return { x: pos.x, y: pos.y, width: layout.stageWidth, height: layout.stageHeight }
}

// 參考圖原始顯示尺寸（寬度上限 1200 等比縮放）：載圖量 naturalWidth，
// 後台（可調整對位）與接待台（唯讀鏡射）都要據此算渲染框
export function useVenueRefImageDims(url: MaybeRefOrGetter<string | null | undefined>) {
  const dims = ref<{ width: number, height: number } | null>(null)
  watch(() => toValue(url), (next) => {
    dims.value = null
    if (!next || import.meta.server)
      return
    const img = new Image()
    img.onload = () => {
      // 載入期間 url 已換圖或被移除 → 這次結果作廢。
      // 否則舊圖尺寸會蓋回 dims，讓移除底圖後仍算出一個不存在的框，
      // 污染 canvasSize / contentBounds（畫面上是莫名多一塊留白）
      if (toValue(url) !== next)
        return
      const w = Math.min(img.naturalWidth, 1200)
      dims.value = { width: w, height: Math.round(img.naturalHeight * (w / img.naturalWidth)) }
    }
    img.src = next
  }, { immediate: true })
  return dims
}

// 參考圖渲染框：原始顯示尺寸 × 對位縮放
export function computeRefImageBox(
  dims: { width: number, height: number } | null,
  transform: { x: number, y: number, scale: number },
): CanvasBox | null {
  if (!dims)
    return null
  return {
    x: transform.x,
    y: transform.y,
    width: Math.round(dims.width * transform.scale),
    height: Math.round(dims.height * transform.scale),
  }
}

// 畫布尺寸：依最遠的桌位、標記、舞台與參考圖推算，確保可容納並可捲動（原點固定 0,0）
export function computeCanvasSize(input: CanvasExtentInput): { width: number, height: number } {
  let maxX = 0
  let maxY = 0
  for (const t of input.tables) {
    const p = input.tablePos(t)
    maxX = Math.max(maxX, p.x + TABLE_BLOCK)
    maxY = Math.max(maxY, p.y + TABLE_BLOCK)
  }
  for (const m of input.markers) {
    const p = input.markerPos(m)
    maxX = Math.max(maxX, p.x + m.width)
    maxY = Math.max(maxY, p.y + m.height)
  }
  for (const box of [input.stageBox, input.refImageBox]) {
    if (!box)
      continue
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }
  return {
    width: Math.max(CANVAS_MIN_WIDTH, maxX + CANVAS_PAD),
    height: Math.max(CANVAS_MIN_HEIGHT, maxY + CANVAS_PAD),
  }
}

// 內容邊界：實際佔用的最小包圍框（桌位以格寬計，不含座位環留白）。
// 供「整場等比塞進固定框」的呈現用——接待台右欄與下載圖 A4 都是固定寬度，
// 留白越少桌子畫得越大、桌名越可讀，而相對擺位不受影響。
export function computeContentBounds(input: ContentBoundsInput, pad = 0): CanvasBox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  function cover(box: CanvasBox) {
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }
  for (const t of input.tables) {
    const p = input.tablePos(t)
    const size = tableBoxWidth(input.isMainTable(t))
    cover({ x: p.x, y: p.y, width: size, height: size })
  }
  for (const m of input.markers) {
    const p = input.markerPos(m)
    cover({ x: p.x, y: p.y, width: m.width, height: m.height })
  }
  for (const box of [input.stageBox, input.refImageBox]) {
    if (box)
      cover(box)
  }
  if (!Number.isFinite(minX))
    return null
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}
