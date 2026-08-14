import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useVenueRefImageDims } from '~/composables/useVenueCanvasGeometry'

// 假 Image：把載入完成的時機交給測試控制，用來重現「圖還在載、url 就換掉」的競態
class FakeImage {
  onload: (() => void) | null = null
  naturalWidth = 800
  naturalHeight = 600
  private _src = ''
  static instances: FakeImage[] = []

  get src() {
    return this._src
  }

  set src(value: string) {
    this._src = value
    FakeImage.instances.push(this)
  }
}

vi.stubGlobal('Image', FakeImage)

// 觸發指定次序的圖片載入完成（0 = 第一張開始載的圖）
function finishLoad(index: number, size?: { width: number, height: number }) {
  const img = FakeImage.instances[index]!
  if (size) {
    img.naturalWidth = size.width
    img.naturalHeight = size.height
  }
  img.onload?.()
}

describe('useVenueRefImageDims 參考圖尺寸量測', () => {
  afterEach(() => {
    FakeImage.instances = []
  })

  it('圖載入完成後給出等比尺寸（寬度上限 1200）', async () => {
    const url = ref<string | null>('a.png')
    const dims = useVenueRefImageDims(url)
    await nextTick()

    finishLoad(0, { width: 2400, height: 1200 })

    expect(dims.value).toEqual({ width: 1200, height: 600 })
  })

  it('移除底圖後，先前那張圖才載完 → 尺寸不得被寫回', async () => {
    const url = ref<string | null>('a.png')
    const dims = useVenueRefImageDims(url)
    await nextTick()

    // 圖還在載的期間把底圖移除
    url.value = null
    await nextTick()

    // 舊圖這時才載完：若沒有 stale 防護，dims 會被塞回一個早已不存在的框，
    // 進而污染 canvasSize / contentBounds
    finishLoad(0)

    expect(dims.value).toBeNull()
  })

  it('換圖時舊圖較晚載完 → 以新圖尺寸為準', async () => {
    const url = ref<string | null>('a.png')
    const dims = useVenueRefImageDims(url)
    await nextTick()

    url.value = 'b.png'
    await nextTick()

    // 新圖先完成，舊圖後到
    finishLoad(1, { width: 600, height: 300 })
    finishLoad(0, { width: 900, height: 900 })

    expect(dims.value).toEqual({ width: 600, height: 300 })
  })
})
