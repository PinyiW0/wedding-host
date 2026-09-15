// app/components/story/storyRingsGeometry.ts — 一對婚戒的網點幾何（純函式、無 DOM，StoryRings.vue 專用）。
// 半色調（halftone）的做法：把戒指的實心剪影鋪上一層六角錯列的格點，每一格依該處的明暗決定圓點大小，
// 點越大越暗。剪影與明暗都用解析式判定（橢圓、多邊形），不畫離屏 canvas 再取像——結果可重現、可單元測試。
//
// 座標：盒寬 W 為單位（x = u·W、y = v·W），盒高 H = 0.6W（5:3）。輸出一律換成 CSS px。
// 兩枚戒指各在自己的局部座標判定：原點＝圓心、轉了傾角 φ、戒圈的厚度沿局部 +y 掃掠 d（像從斜上方看一截圓管）。
// 看得到的面有三種：頂面（外橢圓減內橢圓，最亮）、透過洞看到的內側遠壁（最暗）、正對我們的外側近壁（左上有一道高光）。
// 左圈是新郎的寬素圈、右圈是新娘戒——頂端一顆爪鑲單鑽（側面看：冠部梯形＋亭部倒三角，兩支爪、一個戒座）。
// 兩圈交扣：上交點左圈壓右圈、下交點右圈壓左圈，被壓的那圈在贏家邊緣留一列空隙，眼睛才讀得出前後。
// 明暗 D 除了決定點的大小，也給出色調 tone（暗墨 → 高光金）：受光的頂面與近壁高光帶是金色，其餘是墨色——雙色套印。

export interface RingPoint {
  /** 目標 A：半色調格點（CSS px） */
  x: number
  y: number
  /** 目標 B：鑽石刻面線上的點；戒圈粒子的 B 就是 A */
  bx: number
  by: number
  /** B 點所在刻面線的切線角（弧度），菱形沿線排 */
  bAng: number
  /** 基礎半徑（CSS px） */
  r: number
  /** 是鑽石的粒子（會變身），否則是戒圈 */
  gem: boolean
  /** 色調（0 暗墨 → 1 高光金），由明暗 D 推出；鑽石、爪與戒座都是 0 */
  tone: number
  /** 在自己戒圈上的角度（弧度，局部座標），掃光沿著它轉；右圈加了 π，兩圈的光錯半拍 */
  ang: number
}

export interface RingsGeometry {
  points: RingPoint[]
  /** 戒圈網格格距與鑽石網格格距（CSS px） */
  s: number
  sGem: number
  /** 鑽石中心與三個閃光錨點（CSS px） */
  gem: { cx: number, cy: number, glints: { x: number, y: number }[] }
}

/** 盒子的長寬比（元件的 aspect-ratio 與這裡的 H = 0.6W 必須一致） */
export const RINGS_ASPECT = 5 / 3

interface RingSpec {
  cx: number
  cy: number
  /** 外橢圓半軸 */
  a: number
  b: number
  /** 傾角（弧度） */
  phi: number
  /** 戒圈厚度的掃掠量（沿局部 +y） */
  d: number
  /** 邊厚（頂面的環寬） */
  t: number
}

const DEG = Math.PI / 180

export const LEFT_RING: RingSpec = { cx: 0.340, cy: 0.300, a: 0.238, b: 0.195, phi: -12 * DEG, d: 0.065, t: 0.038 }
export const RIGHT_RING: RingSpec = { cx: 0.690, cy: 0.325, a: 0.200, b: 0.164, phi: 12 * DEG, d: 0.048, t: 0.030 }

/** 兩圈交扣的分界（兩圓心的中點）：這條線以上左圈在前，以下右圈在前 */
const V_CROSS = 0.3125

/** 鑽石的尺度單位 g（腰圍寬 = g）與腰圍中心在右戒局部座標的高度（−y） */
const STONE_G = 0.138
const STONE_Y = 0.231

/* 鑽石側面輪廓（g 單位，y 向下為正）：桌面 y=−0.16 半寬 0.275、腰圍 y=0 半寬 0.5、底尖 (0, 0.43) */
const TABLE_Y = -0.16
const TABLE_HW = 0.275
const GIRDLE_HW = 0.5
const CULET_Y = 0.43

/** 刻面線（g 單位）：腰圍、桌面、冠部外框×2、冠部分隔×2、亭部外框×2、亭部分隔×2 */
const FACET_SEGMENTS: [number, number, number, number][] = [
  [-GIRDLE_HW, 0, GIRDLE_HW, 0],
  [-TABLE_HW, TABLE_Y, TABLE_HW, TABLE_Y],
  [-GIRDLE_HW, 0, -TABLE_HW, TABLE_Y],
  [GIRDLE_HW, 0, TABLE_HW, TABLE_Y],
  [-TABLE_HW, TABLE_Y, -TABLE_HW, 0],
  [TABLE_HW, TABLE_Y, TABLE_HW, 0],
  [-GIRDLE_HW, 0, 0, CULET_Y],
  [GIRDLE_HW, 0, 0, CULET_Y],
  [-TABLE_HW, 0, 0, CULET_Y],
  [TABLE_HW, 0, 0, CULET_Y],
]

/** 閃光錨點（g 單位）：桌面左角、腰圍右端、底尖 */
const GLINT_ANCHORS: [number, number][] = [[-TABLE_HW, TABLE_Y], [GIRDLE_HW, 0], [0, CULET_Y]]

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 世界（盒寬單位）→ 戒指局部座標 */
function toLocal(ring: RingSpec, u: number, v: number): [number, number] {
  const dx = u - ring.cx
  const dy = v - ring.cy
  const c = Math.cos(ring.phi)
  const s = Math.sin(ring.phi)
  return [dx * c + dy * s, -dx * s + dy * c]
}

/** 戒指局部座標 → 世界（盒寬單位） */
function toWorld(ring: RingSpec, lx: number, ly: number): [number, number] {
  const c = Math.cos(ring.phi)
  const s = Math.sin(ring.phi)
  return [ring.cx + lx * c - ly * s, ring.cy + lx * s + ly * c]
}

/** 橢圓在 x 處的半高；x 超出半軸回 −1 */
function halfHeight(a: number, b: number, x: number): number {
  const q = 1 - (x / a) ** 2
  return q < 0 ? -1 : b * Math.sqrt(q)
}

type Surface = 'hole' | 'far' | 'top' | 'near'

/**
 * 局部座標的點落在戒圈的哪一面，與該處的暗度 D（0 亮 → 1 暗）。
 * h > 0 時整個實體向外膨脹 h（洞同時向內縮 h），用來在另一圈周圍留白。
 */
function classify(ring: RingSpec, lx: number, ly: number, h = 0): { surface: Surface, D: number } | null {
  const a = ring.a + h
  const b = ring.b + h
  const aIn = ring.a - ring.t - h
  const bIn = ring.b - (ring.t * ring.b) / ring.a - h
  const hOut = halfHeight(a, b, lx)
  if (hOut < 0 || ly < -hOut || ly > ring.d + hOut)
    return null
  const hIn = aIn > 0 ? halfHeight(aIn, bIn, lx) : -1
  const inTop = hIn >= 0 && Math.abs(ly) <= hIn
  const inBottom = hIn >= 0 && Math.abs(ly - ring.d) <= hIn
  if (inTop && inBottom)
    return { surface: 'hole', D: 0 }
  // 透過洞看到的內側遠壁：越靠洞頂越深
  if (inTop)
    return { surface: 'far', D: 0.62 + 0.25 * (1 - clamp01((ly + hIn) / ring.d)) }
  const u = lx / a
  // 頂面：左上受光，往右、往下一點點變暗
  if (Math.abs(ly) <= hOut)
    return { surface: 'top', D: 0.22 + 0.14 * ((u + 1) / 2) + 0.06 * ((ly / b + 1) / 2) }
  // 外側近壁：高光在 u = −0.3，往兩側變暗，越靠下緣越暗
  const D = 0.40 + 0.45 * Math.min(1, Math.abs(u + 0.3) / 1.1) ** 1.2 + 0.10 * clamp01((ly - hOut) / ring.d)
  return { surface: 'near', D: Math.min(0.9, D) }
}

/** 右戒局部座標 → 鑽石座標（g 單位） */
function toStone(lx: number, ly: number): [number, number] {
  return [lx / STONE_G, (ly + STONE_Y) / STONE_G]
}

/** 鑽石側面輪廓在 sy 處的半寬（pad 向外加厚）；不在高度範圍回 −1 */
function stoneHalfWidth(sy: number, pad = 0): number {
  if (sy < TABLE_Y - pad || sy > CULET_Y + pad)
    return -1
  if (sy <= 0)
    return TABLE_HW + (GIRDLE_HW - TABLE_HW) * clamp01((sy - TABLE_Y) / -TABLE_Y) + pad
  return GIRDLE_HW * Math.max(0, 1 - sy / CULET_Y) + pad
}

function inStone(sx: number, sy: number, pad = 0): boolean {
  const hw = stoneHalfWidth(sy, pad)
  return hw >= 0 && Math.abs(sx) <= hw
}

/** 刻面明暗：冠部中央最亮、亭部側面最暗、腰帶一條細細的深線 */
function stoneFacetD(sx: number, sy: number): number {
  if (Math.abs(sy) <= 0.015)
    return 0.72
  if (sy < 0)
    return Math.abs(sx) <= TABLE_HW ? 0.28 : 0.48
  const hwCentre = TABLE_HW * (1 - sy / CULET_Y)
  return Math.abs(sx) <= hwCentre ? 0.36 : 0.60
}

/** 兩支爪：夾在腰圍兩側，從腰圍上方一點伸到亭部中段 */
function inProng(sx: number, sy: number): boolean {
  return Math.abs(Math.abs(sx) - 0.46) <= 0.06 && sy >= -0.06 && sy <= 0.30
}

/** 戒座：亭部下方的小梯形，接到戒圈頂面 */
function inSeat(sx: number, sy: number): boolean {
  if (sy < 0.32 || sy > 0.50)
    return false
  const hw = 0.30 - (0.10 * (sy - 0.32)) / 0.18
  return Math.abs(sx) <= hw
}

/** 鑽石座標 → 世界（盒寬單位） */
function stoneToWorld(sx: number, sy: number): [number, number] {
  return toWorld(RIGHT_RING, sx * STONE_G, sy * STONE_G - STONE_Y)
}

/** 鑽石連同爪與戒座的世界外框（盒寬單位；v 除以 0.6 才是盒高的比例） */
export function stoneBounds(): { u0: number, v0: number, u1: number, v1: number } {
  const corners: [number, number][] = [
    [-TABLE_HW, TABLE_Y],
    [TABLE_HW, TABLE_Y],
    [-GIRDLE_HW, 0],
    [GIRDLE_HW, 0],
    [0, CULET_Y],
    [-0.52, -0.06],
    [0.52, -0.06],
    [-0.52, 0.30],
    [0.52, 0.30],
    [-0.30, 0.32],
    [0.30, 0.32],
    [-0.20, 0.50],
    [0.20, 0.50],
  ]
  let u0 = Infinity
  let v0 = Infinity
  let u1 = -Infinity
  let v1 = -Infinity
  for (const [sx, sy] of corners) {
    const [u, v] = stoneToWorld(sx, sy)
    u0 = Math.min(u0, u)
    v0 = Math.min(v0, v)
    u1 = Math.max(u1, u)
    v1 = Math.max(v1, v)
  }
  return { u0, v0, u1, v1 }
}

/** 六角錯列格：列距 0.866s、奇數列錯半格、每點抖 ±0.06s（抖動用注入的亂數，測試才可重現） */
function forEachGrid(
  W: number,
  H: number,
  s: number,
  rand: () => number,
  fn: (x: number, y: number) => void,
): void {
  const pitch = s * 0.866
  for (let row = 0, y = s / 2; y < H; row++, y += pitch) {
    const offset = row % 2 ? s / 2 : 0
    for (let x = s / 2 + offset; x < W; x += s)
      fn(x + (rand() - 0.5) * 0.12 * s, y + (rand() - 0.5) * 0.12 * s)
  }
}

/** 半徑：0.21s（最亮）～0.41s（最暗）；夾住 D 免得最暗處黏成實心，上限壓在 0.41s 讓暗面不會結成一塊黑 */
function radiusFor(s: number, D: number): number {
  return s * (0.18 + 0.26 * clamp(D, 0.1, 0.9))
}

/**
 * 色調：D 越亮越金。0.62 以上（遠壁、爪、戒座）全是墨色；頂面 D 0.22～0.42 落在 0.48～0.95，
 * 近壁只有 u = −0.3 那道高光帶（D 0.40～0.50）沾到金。
 */
function toneFor(D: number): number {
  return clamp01((0.62 - D) / 0.42)
}

/** 依刻面線長度用最大餘數法分配 N 個點，沿線等距取樣，回傳世界座標（CSS px）與切線角 */
function sampleFacetLines(N: number, W: number): { x: number, y: number, ang: number }[] {
  const lengths = FACET_SEGMENTS.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0))
  const total = lengths.reduce((sum, l) => sum + l, 0)
  const quota = lengths.map(l => (N * l) / total)
  const counts = quota.map(q => Math.floor(q))
  let remainder = N - counts.reduce((sum, c) => sum + c, 0)
  const byFraction = quota
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((p, q) => q.frac - p.frac)
  for (const { i } of byFraction) {
    if (remainder <= 0)
      break
    counts[i]! += 1
    remainder -= 1
  }
  const out: { x: number, y: number, ang: number }[] = []
  FACET_SEGMENTS.forEach(([x0, y0, x1, y1], i) => {
    const n = counts[i]!
    const [wx0, wy0] = stoneToWorld(x0, y0)
    const [wx1, wy1] = stoneToWorld(x1, y1)
    const ang = Math.atan2(wy1 - wy0, wx1 - wx0)
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      out.push({ x: (wx0 + (wx1 - wx0) * t) * W, y: (wy0 + (wy1 - wy0) * t) * W, ang })
    }
  })
  return out
}

/**
 * 建出整組格點。W／H 是盒子的 CSS px；rand 是 0～1 的亂數來源（元件給 Math.random，測試給固定序列）。
 * 格距 s = W/130，夾在 2.7～4.5px：手機 302px 寬 2.7、桌機 576px 寬 4.4，約兩千到三千顆。
 * （第一版是 W/80、約一千顆，新人嫌一顆太大、黑太重，改細一級。）
 */
export function buildRings(W: number, H: number, rand: () => number): RingsGeometry {
  const s = clamp(W / 130, 2.7, 4.5)
  const sGem = 0.7 * s
  const halo = (0.9 * s) / W
  const stonePad = (0.6 * s) / (STONE_G * W)
  const vCross = V_CROSS * W
  const points: RingPoint[] = []

  function pushBand(x: number, y: number, D: number, lx: number, ly: number, right: boolean): void {
    const ang = Math.atan2(ly, lx) + (right ? Math.PI : 0)
    points.push({ x, y, bx: x, by: y, bAng: 0, r: radiusFor(s, D), gem: false, tone: toneFor(D), ang })
  }

  // 戒圈：兩圈各自分類，交界處由 V_CROSS 決定誰在前，被壓的那圈在贏家膨脹 halo 的實體內不放點
  forEachGrid(W, H, s, rand, (x, y) => {
    const u = x / W
    const v = y / W
    const [lxR, lyR] = toLocal(RIGHT_RING, u, v)
    const [sx, sy] = toStone(lxR, lyR)
    if (inProng(sx, sy)) {
      pushBand(x, y, 0.85, lxR, lyR, true)
      return
    }
    if (inStone(sx, sy, stonePad))
      return
    if (inSeat(sx, sy)) {
      pushBand(x, y, 0.70, lxR, lyR, true)
      return
    }
    const [lxL, lyL] = toLocal(LEFT_RING, u, v)
    const leftWins = y < vCross
    const winner = leftWins ? LEFT_RING : RIGHT_RING
    const [wlx, wly] = leftWins ? [lxL, lyL] : [lxR, lyR]
    const [llx, lly] = leftWins ? [lxR, lyR] : [lxL, lyL]
    const win = classify(winner, wlx, wly)
    if (win && win.surface !== 'hole') {
      pushBand(x, y, win.D, wlx, wly, !leftWins)
      return
    }
    const lose = classify(leftWins ? RIGHT_RING : LEFT_RING, llx, lly)
    if (!lose || lose.surface === 'hole')
      return
    const inflated = classify(winner, wlx, wly, halo)
    if (inflated && inflated.surface !== 'hole')
      return
    pushBand(x, y, lose.D, llx, lly, leftWins)
  })

  // 鑽石：更細的網格只鋪在石頭輪廓內（爪壓在石頭上，爪的位置讓給戒圈群）
  const bounds = stoneBounds()
  const gemRaw: { x: number, y: number, D: number }[] = []
  const gx0 = bounds.u0 * W - sGem
  const gy0 = bounds.v0 * W - sGem
  const gW = (bounds.u1 - bounds.u0) * W + 2 * sGem
  const gH = (bounds.v1 - bounds.v0) * W + 2 * sGem
  forEachGrid(gW, gH, sGem, rand, (x, y) => {
    const wx = gx0 + x
    const wy = gy0 + y
    const [lx, ly] = toLocal(RIGHT_RING, wx / W, wy / W)
    const [sx, sy] = toStone(lx, ly)
    if (inStone(sx, sy) && !inProng(sx, sy))
      gemRaw.push({ x: wx, y: wy, D: stoneFacetD(sx, sy) })
  })

  // 目標 B 恰好取一樣多的點；兩組都繞著鑽石中心依角度排序、按名次配對，路徑短、少交叉
  const facet = sampleFacetLines(gemRaw.length, W)
  const [gcu, gcv] = stoneToWorld(0, (TABLE_Y + CULET_Y) / 2)
  const gcx = gcu * W
  const gcy = gcv * W
  function rank<T extends { x: number, y: number }>(list: T[]): T[] {
    return [...list].sort((p, q) => {
      const ap = Math.atan2(p.y - gcy, p.x - gcx)
      const aq = Math.atan2(q.y - gcy, q.x - gcx)
      return ap - aq || Math.hypot(p.x - gcx, p.y - gcy) - Math.hypot(q.x - gcx, q.y - gcy)
    })
  }
  const gemSorted = rank(gemRaw)
  const facetSorted = rank(facet)
  gemSorted.forEach((g, i) => {
    const b = facetSorted[i]!
    points.push({ x: g.x, y: g.y, bx: b.x, by: b.y, bAng: b.ang, r: radiusFor(sGem, g.D), gem: true, tone: 0, ang: 0 })
  })

  const glints = GLINT_ANCHORS.map(([sx, sy]) => {
    const [u, v] = stoneToWorld(sx, sy)
    return { x: u * W, y: v * W }
  })

  return { points, s, sGem, gem: { cx: gcx, cy: gcy, glints } }
}
