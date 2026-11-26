/**
 * 裁掉圖片四周的透明空白，回傳只剩畫的部分的 data URL（issue #194）。
 * 賓客在整張畫布上只畫一小角，直接縮進方框花就小到看不見；裁完再縮，花才撐得滿。
 * 整張全透明（賓客沒畫就送出）回傳空字串，讓呼叫端略過。
 * 只能在瀏覽器跑；跨來源圖片沒開 CORS 會讓 canvas 讀不到像素，失敗一律回傳原圖
 */
const ALPHA_MIN = 8
const PAD = 0.04

// R2 網址的花圖（issue #226）：頁面上的 <img> 先以一般模式載過同一個網址時，瀏覽器快取的那份回應沒有跨來源標頭，
// 之後再用 crossOrigin 載會直接拿快取、讀像素失敗。加一個查詢參數讓這次請求用另一份快取。
// dataURL／blob 不是網路請求，原樣回傳
const HTTP_URL_RE = /^https?:\/\//i

export function corsSrc(src: string): string {
  if (!HTTP_URL_RE.test(src))
    return src
  return `${src}${src.includes('?') ? '&' : '?'}cors=1`
}

export async function trimTransparent(src: string): Promise<string> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = corsSrc(src)
    await img.decode()
    const w = img.naturalWidth
    const h = img.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx)
      return src
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, w, h)
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3]! > ALPHA_MIN) {
          if (x < minX)
            minX = x
          if (x > maxX)
            maxX = x
          if (y < minY)
            minY = y
          if (y > maxY)
            maxY = y
        }
      }
    }
    if (maxX < 0)
      return ''
    // 留一點邊，搖曳轉動時筆觸不會貼著框
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * PAD)
    const left = Math.max(0, minX - pad)
    const top = Math.max(0, minY - pad)
    const cw = Math.min(w, maxX + pad + 1) - left
    const ch = Math.min(h, maxY + pad + 1) - top
    if (cw >= w * 0.95 && ch >= h * 0.95)
      return src
    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    out.getContext('2d')?.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch)
    return out.toDataURL('image/png')
  }
  catch {
    return src
  }
}
