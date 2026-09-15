// app/components/story/storyHeartDots.ts — 網點版愛心的幾何（純函式、無 DOM，StoryHeartDots.vue 專用）。
// 跟一對戒指同一套語言：六角錯列的小圓點鋪滿愛心的剪影，左上受光、右下偏暗，
// 暗處點大一點、色調偏灰，亮處點小一點、色調偏金。愛心的輪廓取自 StoryHeart 的那條 path（24×24 viewBox），
// 用貝茲曲線取樣成多邊形再做點在多邊形內的判定；沒有亂數，SSR 與 client 算出來一樣。

export interface HeartDot {
  x: number
  y: number
  r: number
  /** 色階 0（暗灰）～3（高光金），對應戒指的四階 */
  tone: number
}

/** StoryHeart 那條 path 的貝茲段（M12 21.35 起，順時針回到起點） */
const HEART_CURVES: [number, number, number, number, number, number, number, number][] = [
  // 左下斜線 → 左瓣
  [12, 21.35, 12, 21.35, 10.55, 20.03, 10.55, 20.03],
  [10.55, 20.03, 5.4, 15.36, 2, 12.28, 2, 8.5],
  [2, 8.5, 2, 5.42, 4.42, 3, 7.5, 3],
  [7.5, 3, 9.24, 3, 10.91, 3.81, 12, 5.09],
  // 右瓣
  [12, 5.09, 13.09, 3.81, 14.76, 3, 16.5, 3],
  [16.5, 3, 19.58, 3, 22, 5.42, 22, 8.5],
  [22, 8.5, 22, 12.28, 18.6, 15.36, 13.45, 20.04],
  [13.45, 20.04, 13.45, 20.04, 12, 21.35, 12, 21.35],
]

/** 把貝茲段取樣成一圈多邊形頂點 */
function heartPolygon(steps = 10): [number, number][] {
  const out: [number, number][] = []
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of HEART_CURVES) {
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const u = 1 - t
      const x = u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3
      const y = u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3
      out.push([x, y])
    }
  }
  return out
}

/** 射線法：點在多邊形內 */
function inside(poly: [number, number][], x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    const crosses = (yi > y) !== (yj > y)
    if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit
  }
  return hit
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * 鋪點。pitch 是格距（viewBox 單位，24 = 整顆愛心）；離輪廓不到半格的點不放，邊緣才乾淨。
 * 明暗 D：左上 0.20、右下 0.70，往右下用 s^1.4 慢慢變暗——上半顆大多是金、右下角落才是灰；
 * 點半徑 pitch·(0.18 + 0.26·D)，色階 clamp01((0.62 − D)/0.42) 切四階，都跟戒指同一條公式。
 */
export function heartDots(pitch: number): HeartDot[] {
  const poly = heartPolygon()
  const rowPitch = pitch * 0.866
  const dots: HeartDot[] = []
  const edge = pitch * 0.45
  for (let row = 0, y = 3 + pitch / 2; y < 21.5; row++, y += rowPitch) {
    const offset = row % 2 ? pitch / 2 : 0
    for (let x = 2 + pitch / 2 + offset; x < 22; x += pitch) {
      if (!inside(poly, x, y))
        continue
      // 四個方向離輪廓都要有餘裕，免得點壓在邊上
      if (!inside(poly, x - edge, y) || !inside(poly, x + edge, y) || !inside(poly, x, y - edge) || !inside(poly, x, y + edge))
        continue
      const nx = (x - 2) / 20
      const ny = (y - 3) / 18.35
      const D = 0.20 + 0.50 * clamp01((nx + ny) / 2) ** 1.4
      const tone = clamp01((0.62 - D) / 0.42)
      dots.push({ x, y, r: pitch * (0.18 + 0.26 * D), tone: Math.min(3, Math.floor(tone * 4)) })
    }
  }
  return dots
}
