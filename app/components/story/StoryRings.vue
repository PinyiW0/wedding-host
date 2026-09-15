<!-- app/components/story/StoryRings.vue — 一對婚戒，用一格一格的小圓點畫成（半色調版畫）。
     走到「距離歸零」那一頁時，粒子從散開的沙塵聚合成兩枚戒指——距離歸零，兩個人也合在一起。
     滑鼠靠近會把圓點推開、放開就彈回；游標停在鑽石上時，鑽石那一區的圓點沿刻面線重排成金色的菱形並閃光。
     幾何全部程序式算出（storyRingsGeometry.ts），沒有圖檔；顏色讀 @theme token，跟著全站色板走。
     畫法是「紙底加墨」的四層：受光面金、暗面墨的雙色套印；每顆點底下一圈 multiply 的墨暈；
     動的時候不清畫布、削透明度留殘影；成形後一道高光每 7 秒沿戒圈掃一圈（位置不動，只有光在走）。
     canvas 的 rAF 蓋不到 main.css 的 reduced-motion guard，所以這裡自己判斷：不散沙、不推開、鑽石瞬切。
     觸控沒有游標，推開整組不掛；鑽石改用一顆透明按鈕點開（同時給讀屏名稱與鍵盤焦點）。
     那顆按鈕還有一個作用：StoryDeck 的翻頁把「起手點在 button 裡」排除在點擊翻頁之外，所以點鑽石不會順手翻掉整頁。
     聚合等「這一頁走到了」而且「畫面真的看得到它」才起跑——桌機翻頁的滑動要 1.8 秒，
     光看 drawn 會讓整段聚合演在還在滑的面板上，滑到定位時已經散場了。
     整頁完全離開畫面之後就打散回沙，下次再滾到這一頁會重新聚合一次（新人要求每次都看得到進場）。 -->
<!-- 沒有 JS（live=false）時畫一張線稿：canvas 是空的，但版位、輪廓與讀屏描述都在。 -->
<script setup lang="ts">
import type { RingPoint } from './storyRingsGeometry'
import { buildRings, RINGS_ASPECT, stoneBounds } from './storyRingsGeometry'

const props = defineProps<{
  /** JS 已接管；false（SSR／無 JS）時畫線稿、不掛互動 */
  live: boolean
  /** 使用者已走到這一頁：聚合從這一刻開始（到過就不收回） */
  drawn: boolean
}>()

/** 聚合：每顆粒子飄 1.3 秒，最遠的那顆延遲 0.95 秒起飛，落定約在 drawn 之後 2.6 秒——接在桌機兩顆愛心合一（2.3 秒）之後 */
const FLY_MS = 1300
const DELAY_MAX_MS = 950
const DELAY_JITTER_MS = 260
const START_MS = 200
/** 飄過來的側向弧幅（佔盒寬）：每顆粒子沿自己的弧線繞過來，不是走直線，看起來像花瓣落定 */
const ARC_MAX = 0.13
/** 進場淡入分 8 桶：桶越多，最暗那批越接近全透明，開頭才真的是「從無到有」 */
const FADE_BUCKETS = 8
/** 鑽石變身 0.48 秒；閃光每 1.8 秒一輪、每次亮 0.52 秒，三個錨點錯開，亮著就一直閃 */
const GEM_MS = 480
const GLINT_CYCLE_MS = 1800
const GLINT_LIT_MS = 520
const GLINT_OFFSETS = [0, 600, 1200]
/** 星芒外徑（格距的倍數）：亮起來時的大小，靜止時只有它的 0.55 */
const GLINT_SIZE = 3.4
/**
 * 鑽石沒被指到時也每 3.6 秒閃一下——它得一直看得出來是一顆鑽石，不是等人來 hover 才存在。
 * 只在這一格真的在畫面上時才跑（IntersectionObserver 一路盯著，捲出去就停）。
 */
const IDLE_GLINT_MS = 3600
/** 物理：彈簧、阻尼、游標推力半徑與強度。固定 60fps 步長，120Hz 螢幕與分頁節流後手感一致 */
const STEP_MS = 1000 / 60
const SPRING = 0.08
const DAMPING = 0.86
const PUSH_FORCE = 2.4
/** 靜止判定：位移與速度都小於這個值就收掉迴圈 */
const REST_EPSILON = 0.05
/** 整頁完全離開畫面後等這麼久才打散：翻到一半又拉回來、捲動時邊緣抖一下，都不重播 */
const SCATTER_DELAY_MS = 300
/** 成形後只剩掃光與閃光在動，畫面每 33ms 更新一次就夠（三千多顆點兩道 pass，60fps 白燒電） */
const IDLE_PAINT_MS = 1000 / 30
/** 色調四階：暗墨、過渡、受光的金屬、高光；分桶時 tone 乘 4 取整 */
const TONE_STEPS = 4
/** 墨暈：每顆點底下一圈 1.9 倍半徑、一成透明度的暈，重疊處用 multiply 變深——是墨滲進紙，不是光 */
const HALO_SCALE = 1.9
const HALO_ALPHA = 0.08
/** 殘影：動的時候不清畫布，每格削掉上一格 22% 的透明度；停下來那一格清乾淨，靜止永遠是俐落的半色調 */
const TRAIL_FADE = 0.22
/** 掃光：一道高光每 7 秒沿戒圈轉一圈（cos^4 的柔窗約 66° 寬），窗內的 tone 往高光推七成——是一片柔和的光暈，不是一塊補丁 */
const SWEEP_MS = 7000
const SWEEP_POW = 4
const SWEEP_GAIN = 0.7

interface Particle extends RingPoint {
  /** 現況位置與速度 */
  px: number
  py: number
  vx: number
  vy: number
  /** 散沙起點與起飛延遲 */
  sx: number
  sy: number
  delay: number
  /** 側向弧的幅度（含正負，決定往哪一邊繞）與單位法向量 */
  arc: number
  nx: number
  ny: number
}

const root = useTemplateRef<HTMLElement>('root')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

const hovering = ref(false)
const pinned = ref(false)
const keyboardFocused = ref(false)
const gemOn = computed(() => hovering.value || pinned.value || keyboardFocused.value)

// 鑽石按鈕的位置：幾何已正規化，是固定的百分比，SSR 與 client 算出來一樣
const gemBox = stoneBounds()
const gemStyle = {
  left: `${(gemBox.u0 * 100).toFixed(2)}%`,
  top: `${((gemBox.v0 / (1 / RINGS_ASPECT)) * 100).toFixed(2)}%`,
  width: `${((gemBox.u1 - gemBox.u0) * 100).toFixed(2)}%`,
  height: `${(((gemBox.v1 - gemBox.v0) / (1 / RINGS_ASPECT)) * 100).toFixed(2)}%`,
}

let particles: Particle[] = []
let ctx: CanvasRenderingContext2D | null = null
let boxW = 0
let boxH = 0
let sGem = 0
let gemCentre = { cx: 0, cy: 0, glints: [] as { x: number, y: number }[] }
let pushRadius = 60

let phase: 'sand' | 'assembling' | 'settled' = 'sand'
let flyT0 = 0
let maxDelay = 0
let gemMix = 0
let gemAnim: { from: number, t0: number } | null = null
let glintT0 = -Infinity
let pointerOn = false
let pointerX = 0
let pointerY = 0
let frame = 0
let lastNow = 0
let lastPaint = 0
let acc = 0
let dpr = 1

/** 這一格真的出現在畫面上了（桌機翻頁滑動中不算） */
let visible = false
let reduced = false
let hoverable = false
let motionQuery: MediaQueryList | null = null
let pointerQuery: MediaQueryList | null = null
let observer: ResizeObserver | null = null
let inView: IntersectionObserver | null = null
let gone: IntersectionObserver | null = null
let scatterTimer = 0

/** 四階色調（暗 → 亮）、鑽石的冷灰、變身的金、閃光的紙白與金邊；mount 時讀 @theme token，這裡是後備。
 * 最暗只到 ink-500：戒指是插畫不是墨塊，黑壓不住紙的呼吸（第一版用 ink-700，新人嫌黑太重） */
let tones = ['#6B655C', '#8C857A', '#9A7B43', '#B8965A']
let gemDot = '#A8A096'
let gemInk = '#B8965A'
let glintInk = '#FAF7F1'
let glintEdge = '#9A7B43'

/** 讀一個 @theme 色票；沒讀到（測試環境、token 改名）就用後備 hex */
function readToken(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback
}

function wake(): void {
  if (!frame) {
    lastNow = performance.now()
    acc = 0
    frame = requestAnimationFrame(tick)
  }
}

/** 依目前尺寸重建粒子。已經成形的就直接貼到新目標，不重播聚合 */
function build(width: number, height: number): void {
  const canvas = canvasRef.value
  if (!canvas || width <= 0)
    return
  boxW = width
  boxH = height
  dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  pushRadius = Math.min(72, Math.max(48, width * 0.14))

  const geo = buildRings(width, height, Math.random)
  sGem = geo.sGem
  gemCentre = geo.gem
  const cx = width / 2
  const cy = height / 2
  const half = width * 0.5
  maxDelay = 0
  particles = geo.points.map((p) => {
    // 散沙起點：目標往外推一段，是一團「快要成形的塵」，不是滿版雜訊。
    // 距離用 rand² 讓多數粒子留在目標附近、越遠越稀，塵的邊緣自然淡出；
    // 落點只收在盒內的橢圓裡，不夾成矩形——夾成矩形的話殘影會把整個盒子的四條邊畫出來
    const [sx, sy] = sandOrigin(p.x, p.y, width, height)
    // 從盒中心（兩圈交疊處）往外依序落定
    const delay = DELAY_MAX_MS * Math.min(1, Math.hypot(p.x - cx, p.y - cy) / half) + Math.random() * DELAY_JITTER_MS
    maxDelay = Math.max(maxDelay, delay)
    // 飛行方向的法線：位移沿著它盪出一道弧，起點與終點的偏移都是 0，只有中途繞出去
    const dx = p.x - sx
    const dy = p.y - sy
    const dist = Math.hypot(dx, dy) || 1
    const arc = (Math.random() - 0.5) * 2 * ARC_MAX * width
    return { ...p, px: sx, py: sy, vx: 0, vy: 0, sx, sy, delay, arc, nx: -dy / dist, ny: dx / dist }
  })

  // reduced-motion 一律終態；已經成形過就不重播（換螢幕、轉向時不該再演一次）
  if (reduced || phase === 'settled')
    settle()
  gemMix = gemOn.value && reduced ? 1 : gemMix
  paint(performance.now())
  if (phase === 'assembling')
    wake()
  else
    maybeAssemble()
}

/** 散沙起點：從目標往外拋、抽到盒內橢圓為止（最多 8 次，抽不到就縮回目標旁邊） */
function sandOrigin(x: number, y: number, width: number, height: number): [number, number] {
  const cx = width / 2
  const cy = height / 2
  const ax = width * 0.49
  const ay = height * 0.49
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2
    const rho = width * (0.08 + Math.random() ** 2 * 0.34)
    const sx = x + Math.cos(angle) * rho
    const sy = y + Math.sin(angle) * rho
    if (((sx - cx) / ax) ** 2 + ((sy - cy) / ay) ** 2 <= 1)
      return [sx, sy]
  }
  const angle = Math.random() * Math.PI * 2
  return [x + Math.cos(angle) * width * 0.04, y + Math.sin(angle) * width * 0.04]
}

/** 走到了、看得到了、粒子也建好了，才開始聚合（三個條件到齊的那一刻起跑，誰最後到都一樣） */
function maybeAssemble(): void {
  if (!props.drawn || !visible || !particles.length || phase !== 'sand')
    return
  if (reduced) {
    settle()
    paint(performance.now())
    return
  }
  phase = 'assembling'
  flyT0 = performance.now() + START_MS
  wake()
}

/** 打散回沙：粒子各自回到（重新抽的）起點，下次看到這一頁再聚合一次；reduced-motion 永遠是成形的，不打散 */
function scatter(): void {
  if (reduced || phase === 'sand' || !particles.length)
    return
  phase = 'sand'
  for (const p of particles) {
    const [sx, sy] = sandOrigin(p.x, p.y, boxW, boxH)
    p.sx = sx
    p.sy = sy
    p.px = sx
    p.py = sy
    p.vx = 0
    p.vy = 0
  }
  paint(performance.now())
}

/** 直接擺成終態（reduced-motion、或重新整理時已經停在這一頁） */
function settle(): void {
  phase = 'settled'
  for (const p of particles) {
    p.px = p.x
    p.py = p.y
    p.vx = 0
    p.vy = 0
  }
}

/** 目前這顆粒子要去哪裡：鑽石粒子在 A（原位）與 B（刻面線）之間依 gemMix 內插 */
function targetOf(p: Particle): [number, number] {
  if (!p.gem || gemMix <= 0)
    return [p.x, p.y]
  return [p.x + (p.bx - p.x) * gemMix, p.y + (p.by - p.y) * gemMix]
}

/** 一個固定步長的物理步：彈簧回目標＋游標推開 */
function step(): number {
  let energy = 0
  const gemHeld = gemOn.value
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!
    const [tx, ty] = targetOf(p)
    let ax = (tx - p.px) * SPRING
    let ay = (ty - p.py) * SPRING
    // 變身中的鑽石粒子不受推力：它正在排隊站上刻面線，被推開會散掉
    if (pointerOn && !(p.gem && gemHeld)) {
      const dx = p.px - pointerX
      const dy = p.py - pointerY
      const d = Math.hypot(dx, dy)
      if (d < pushRadius && d > 0.001) {
        const f = (1 - d / pushRadius) ** 2 * PUSH_FORCE
        ax += (dx / d) * f
        ay += (dy / d) * f
      }
    }
    p.vx = (p.vx + ax) * DAMPING
    p.vy = (p.vy + ay) * DAMPING
    p.px += p.vx
    p.py += p.vy
    energy = Math.max(energy, Math.abs(p.px - tx), Math.abs(p.py - ty), Math.abs(p.vx), Math.abs(p.vy))
  }
  return energy
}

/** 建 n 個各自獨立的空桶（不能用 Array.fill([])，那樣每一桶會是同一個陣列） */
function emptyBuckets(n: number): Particle[][] {
  const out: Particle[][] = []
  for (let i = 0; i < n; i++)
    out.push([])
  return out
}

/** 八頂點的星芒，鑽石亮起來時在三個錨點輪流閃 */
function starPath(c: CanvasRenderingContext2D, x: number, y: number, outer: number): void {
  const inner = outer * 0.22
  c.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    const vx = x + Math.cos(a) * r
    const vy = y + Math.sin(a) * r
    if (i === 0)
      c.moveTo(vx, vy)
    else
      c.lineTo(vx, vy)
  }
  c.closePath()
}

/** 進場進度 0～1：還是散沙就是 0（幾乎看不見的小點）、聚合中看時間、成形了就是 1 */
function flyK(p: Particle, now: number): number {
  if (phase === 'sand')
    return 0
  if (phase === 'assembling')
    return Math.min(1, Math.max(0, (now - flyT0 - p.delay) / FLY_MS))
  return 1
}

/** 這顆戒圈粒子此刻的色階（0～3）：底色是幾何給的 tone，掃光的窗經過時往高光推 */
function toneIndex(p: Particle, sweepAng: number, sweeping: boolean): number {
  let t = p.tone
  if (sweeping) {
    const b = Math.max(0, Math.cos(p.ang - sweepAng)) ** SWEEP_POW
    t += (1 - t) * SWEEP_GAIN * b
  }
  return Math.min(TONE_STEPS - 1, Math.floor(t * TONE_STEPS))
}

/** 一桶圓點一次 fill；聚合中的點一邊飛一邊長大（0.25 → 1 倍半徑），scale 給墨暈用 */
function fillGroup(c: CanvasRenderingContext2D, list: Particle[], scale: number, now: number): void {
  c.beginPath()
  for (const p of list) {
    const r = p.r * (0.25 + 0.75 * flyK(p, now)) * scale
    c.moveTo(p.px + r, p.py)
    c.arc(p.px, p.py, r, 0, Math.PI * 2)
  }
  c.fill()
}

function paint(now: number, energy = 0): void {
  const c = ctx
  if (!c)
    return
  const assembling = phase === 'assembling'

  // 動的時候留殘影：不清畫布，把上一格的透明度削掉一截（destination-out 不需要知道底色，canvas 維持透明）；
  // 靜止的那一格清乾淨，停下來永遠是俐落的半色調，不會糊
  const moving = !reduced && (assembling || pointerOn || energy > REST_EPSILON)
  if (moving) {
    c.globalCompositeOperation = 'destination-out'
    c.globalAlpha = TRAIL_FADE
    c.fillStyle = tones[0]!
    c.fillRect(0, 0, boxW, boxH)
    c.globalCompositeOperation = 'source-over'
  }
  else {
    c.clearRect(0, 0, boxW, boxH)
  }

  // 分桶：4 階色調 × 8 淡入桶，鑽石的灰點另佔 8 桶（第 5 色，隨 gemMix 淡出）；一桶一次 fill，不逐顆切狀態。
  // 起點透明度是 0——粒子先無中生有，再一邊變大一邊浮現
  const sweeping = phase === 'settled' && !reduced
  const sweepAng = ((now % SWEEP_MS) / SWEEP_MS) * Math.PI * 2
  const last = FADE_BUCKETS - 1
  const groups = emptyBuckets((TONE_STEPS + 1) * FADE_BUCKETS)
  const gems: Particle[] = []
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!
    if (p.gem) {
      gems.push(p)
      if (gemMix >= 1)
        continue
    }
    const fade = Math.min(last, Math.floor(flyK(p, now) * FADE_BUCKETS))
    const tone = p.gem ? TONE_STEPS : toneIndex(p, sweepAng, sweeping)
    groups[tone * FADE_BUCKETS + fade]!.push(p)
  }
  const colours = [...tones, gemDot]
  // 桶心的 k 開根號：一浮現就看得到淡淡的影子，最後那段才慢慢吃到滿
  const alphaOf = (gi: number): number => {
    const fade = gi % FADE_BUCKETS
    const a = fade === last && !assembling ? 1 : Math.sqrt((fade + 0.5) / FADE_BUCKETS)
    return Math.floor(gi / FADE_BUCKETS) === TONE_STEPS ? a * (1 - gemMix) : a
  }

  // 第一道：墨暈。同色、大一圈、很淡，重疊處 multiply 變深——像墨滲進紙
  c.globalCompositeOperation = 'multiply'
  groups.forEach((list, gi) => {
    if (!list.length)
      return
    c.fillStyle = colours[Math.floor(gi / FADE_BUCKETS)]!
    c.globalAlpha = alphaOf(gi) * HALO_ALPHA
    fillGroup(c, list, HALO_SCALE, now)
  })
  c.globalCompositeOperation = 'source-over'

  // 第二道：圓點本體
  groups.forEach((list, gi) => {
    if (!list.length)
      return
    c.fillStyle = colours[Math.floor(gi / FADE_BUCKETS)]!
    c.globalAlpha = alphaOf(gi)
    fillGroup(c, list, 1, now)
  })

  // 第三道：鑽石變身——灰點已在上面依 1 − gemMix 淡出，這裡金菱形依 gemMix 淡入，兩層疊著過渡
  if (gems.length && gemMix > 0) {
    c.globalAlpha = gemMix
    c.fillStyle = gemInk
    const long = sGem * 0.78 * (0.6 + 0.4 * gemMix)
    const short = sGem * 0.50 * (0.6 + 0.4 * gemMix)
    c.beginPath()
    for (const p of gems) {
      const cos = Math.cos(p.bAng)
      const sin = Math.sin(p.bAng)
      c.moveTo(p.px + cos * long, p.py + sin * long)
      c.lineTo(p.px - sin * short, p.py + cos * short)
      c.lineTo(p.px - cos * long, p.py - sin * long)
      c.lineTo(p.px + sin * short, p.py - cos * short)
      c.closePath()
    }
    c.fill()
  }

  // 第四道：閃光。紙上沒有比紙更亮的顏色，星星是從墨裡挖出來的一塊紙白、鑲一圈金邊。
  // 亮著的時候三個錨點輪流一直閃；沒被指到時也每 IDLE_GLINT_MS 在中間那點閃一下，
  // 讓鑽石一直看得出來是鑽石（新人要求「出現 forever」）
  if (!reduced && phase !== 'assembling') {
    c.lineWidth = 1.2
    c.strokeStyle = glintEdge
    const lit = gemMix > 0.5
    gemCentre.glints.forEach((g, i) => {
      let env = 0
      let scale = 1
      if (lit) {
        const span = (now - glintT0 - (GLINT_OFFSETS[i] ?? 0)) % GLINT_CYCLE_MS
        if (span >= 0 && span <= GLINT_LIT_MS)
          env = Math.sin((Math.PI * span) / GLINT_LIT_MS) ** 2
      }
      else if (i === 1) {
        // 靜止時只讓腰圍那一點閃，小一號，是鑽石的反光不是特效
        const span = now % IDLE_GLINT_MS
        if (span <= GLINT_LIT_MS)
          env = Math.sin((Math.PI * span) / GLINT_LIT_MS) ** 2 * 0.95
        scale = 0.85
      }
      if (env <= 0.01)
        return
      const size = sGem * GLINT_SIZE * scale * (0.5 + 0.5 * env)
      // 底下先一片大一倍、很淡的金色光暈：紙白的星星在紙上看不見，得靠這片暖光在紙上留下痕跡
      c.globalAlpha = env * 0.35
      c.fillStyle = tones[3]!
      starPath(c, g.x, g.y, size * 1.8)
      c.fill()
      c.globalAlpha = env
      c.fillStyle = glintInk
      starPath(c, g.x, g.y, size)
      c.fill()
      c.stroke()
    })
  }
  c.globalAlpha = 1
}

function tick(now: number): void {
  const dt = Math.min(now - lastNow, 100)
  lastNow = now

  if (phase === 'assembling') {
    let done = true
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!
      const k = Math.min(1, Math.max(0, (now - flyT0 - p.delay) / FLY_MS))
      const e = 1 - (1 - k) ** 3
      // 位移走直線、再沿法線盪出一道弧（sin 在兩端都是 0，所以起點與落點都準）
      const swing = Math.sin(Math.PI * k) * p.arc
      p.px = p.sx + (p.x - p.sx) * e + p.nx * swing
      p.py = p.sy + (p.y - p.sy) * e + p.ny * swing
      if (k < 1)
        done = false
    }
    if (done) {
      phase = 'settled'
      for (const p of particles) {
        p.vx = 0
        p.vy = 0
      }
    }
  }

  if (gemAnim) {
    const k = Math.min(1, (now - gemAnim.t0) / GEM_MS)
    const to = gemOn.value ? 1 : 0
    const before = gemMix
    gemMix = gemAnim.from + (to - gemAnim.from) * (1 - (1 - k) ** 4)
    if (before <= 0.5 && gemMix > 0.5)
      glintT0 = now
    if (k >= 1)
      gemAnim = null
  }

  let energy = 0
  if (phase === 'settled') {
    acc += dt
    let n = 0
    while (acc >= STEP_MS && n < 3) {
      energy = step()
      acc -= STEP_MS
      n++
    }
    if (n === 3)
      acc = 0
  }

  // 沒有東西在動（只剩掃光、閃光）就降到 30fps；有粒子在飛或游標在上面才逐格畫
  const idle = phase === 'settled' && !pointerOn && energy <= REST_EPSILON && gemAnim === null
  if (!idle || now - lastPaint >= IDLE_PAINT_MS) {
    paint(now, energy)
    lastPaint = now
  }

  // 閃光是常駐的（亮著三點輪流、靜止偶爾一下），所以只要這一格看得到就得留住迴圈；
  // 捲出畫面就讓它停，不在背景空轉
  const glinting = !reduced && visible && phase !== 'assembling'
  const keep = phase === 'assembling' || gemAnim !== null || (pointerOn && !reduced) || energy > REST_EPSILON || glinting
  if (keep) {
    frame = requestAnimationFrame(tick)
    return
  }
  frame = 0
  // 收工前把粒子貼齊目標，免得停在差之毫釐的位置
  for (const p of particles) {
    const [tx, ty] = targetOf(p)
    p.px = tx
    p.py = ty
    p.vx = 0
    p.vy = 0
  }
  paint(now)
}

function onPointerMove(event: PointerEvent): void {
  if (!hoverable || reduced || event.pointerType === 'touch' || !root.value)
    return
  // 桌機軌道會隨捲動 translateX，每次都要重量，不能快取
  const rect = root.value.getBoundingClientRect()
  pointerX = event.clientX - rect.left
  pointerY = event.clientY - rect.top
  pointerOn = true
  wake()
}

function onPointerLeave(): void {
  if (!pointerOn)
    return
  pointerOn = false
  wake()
}

function onGemEnter(event: PointerEvent): void {
  if (event.pointerType !== 'touch')
    hovering.value = true
}

function onGemFocus(event: FocusEvent): void {
  // 只認鍵盤焦點：滑鼠點完若留著焦點，鑽石會卡在亮著的狀態
  keyboardFocused.value = (event.target as HTMLElement).matches(':focus-visible')
}

function updateMotion(): void {
  reduced = Boolean(motionQuery?.matches)
  hoverable = Boolean(pointerQuery?.matches)
  if (reduced) {
    pointerOn = false
    if (phase !== 'settled')
      settle()
    gemAnim = null
    gemMix = gemOn.value ? 1 : 0
    paint(performance.now())
  }
}

/** 換螢幕時 DPR 會變，但 CSS 尺寸沒變、ResizeObserver 不會叫，這裡只重設 backing store */
function syncDpr(): void {
  const canvas = canvasRef.value
  const next = window.devicePixelRatio || 1
  if (!canvas || next === dpr || boxW <= 0)
    return
  dpr = next
  canvas.width = Math.round(boxW * dpr)
  canvas.height = Math.round(boxH * dpr)
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  paint(performance.now())
}

watch(() => props.drawn, maybeAssemble)

watch(gemOn, (on) => {
  if (reduced) {
    gemMix = on ? 1 : 0
    paint(performance.now())
    return
  }
  gemAnim = { from: gemMix, t0: performance.now() }
  wake()
})

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  reduced = motionQuery.matches
  hoverable = pointerQuery.matches
  motionQuery.addEventListener('change', updateMotion)
  pointerQuery.addEventListener('change', updateMotion)

  const style = getComputedStyle(document.documentElement)
  tones = [
    readToken(style, '--color-ink-500', tones[0]!),
    readToken(style, '--color-neutral-400', tones[1]!),
    readToken(style, '--color-gold-deep', tones[2]!),
    readToken(style, '--color-gold', tones[3]!),
  ]
  gemDot = readToken(style, '--color-ink-300', gemDot)
  gemInk = readToken(style, '--color-gold', gemInk)
  glintInk = readToken(style, '--color-paper', glintInk)
  glintEdge = readToken(style, '--color-gold-deep', glintEdge)

  if (root.value) {
    // observe() 會先回呼一次，初次建置就交給它
    observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box && box.width > 0)
        build(box.width, box.height)
    })
    observer.observe(root.value)
    // 桌機翻頁是 translateX 滑動 1.8 秒，滑到定位才算「看得到」，聚合等這一刻起跑。
    // 之後也一路盯著：捲出畫面就把常駐的閃光收掉，不在背景空轉
    inView = new IntersectionObserver((entries) => {
      const now = entries.some(e => e.isIntersecting)
      if (now === visible)
        return
      visible = now
      if (!visible)
        return
      maybeAssemble()
      wake()
    }, { threshold: 0.45 })
    inView.observe(root.value)
    // 完全離開畫面（一個像素都不剩）才打散，等一小段確定不是翻到一半又拉回來
    gone = new IntersectionObserver((entries) => {
      const onScreen = entries.some(e => e.isIntersecting)
      window.clearTimeout(scatterTimer)
      if (!onScreen)
        scatterTimer = window.setTimeout(scatter, SCATTER_DELAY_MS)
    }, { threshold: 0 })
    gone.observe(root.value)
  }
  window.addEventListener('resize', syncDpr)
})

onBeforeUnmount(() => {
  motionQuery?.removeEventListener('change', updateMotion)
  pointerQuery?.removeEventListener('change', updateMotion)
  window.removeEventListener('resize', syncDpr)
  observer?.disconnect()
  inView?.disconnect()
  gone?.disconnect()
  window.clearTimeout(scatterTimer)
  if (frame)
    cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    ref="root"
    class="rings relative w-full"
    @pointerenter="onPointerMove"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <canvas ref="canvasRef" class="absolute inset-0 block size-full" aria-hidden="true" />

    <!-- 無 JS：畫一張線稿頂著。canvas 沒有粒子，但輪廓、版位與下方那句描述都在 -->
    <svg v-if="!live" viewBox="0 0 100 60" class="absolute inset-0 size-full text-line" fill="none" aria-hidden="true">
      <ellipse cx="34" cy="30" rx="23.8" ry="19.5" transform="rotate(-12 34 30)" stroke="currentColor" stroke-width="0.7" />
      <ellipse cx="69" cy="32.5" rx="20" ry="16.4" transform="rotate(12 69 32.5)" stroke="currentColor" stroke-width="0.7" />
      <path d="M65.3 14.6 L73.5 14.6 L76 17.8 L69.4 23.9 L62.8 17.8 Z" transform="rotate(12 69.4 19)" stroke="currentColor" stroke-width="0.7" />
    </svg>

    <!-- 鑽石熱區：透明按鈕蓋在石頭上。滑鼠移過去、鍵盤 Tab 到、手指點一下都能點亮它，
         而且因為是 button，StoryDeck 不會把這一下當成翻頁 -->
    <button
      v-if="live"
      type="button"
      class="gem absolute rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
      :style="gemStyle"
      :aria-pressed="pinned"
      aria-label="點亮戒指上的鑽石"
      @pointerenter="onGemEnter"
      @pointerleave="hovering = false"
      @focus="onGemFocus"
      @blur="keyboardFocused = false"
      @click="pinned = !pinned"
    />

    <p class="sr-only">
      一對婚戒：左邊是素面的寬戒，右邊那只鑲著一顆鑽石。
    </p>
  </div>
</template>

<style scoped>
.rings {
  aspect-ratio: 5 / 3;
  /* 游標在戒指上換成一顆愛心（熱點放在愛心中心），配色跟戒指同一套：金填、灰描邊。
     data URI 沒辦法吃 CSS 變數，色碼是 --color-gold（#B8965A）與 --color-ink-500（#6B655C），
     動到那兩個 token 時這裡要一起改。第一版是粉色（rose-ink），戒指改成灰金雙色後新人要它跟著搭。
     觸控裝置沒有游標，這行對它無作用。 */
  cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%20viewBox%3D%22-1%20-1%2026%2026%22%3E%3Cpath%20d%3D%22M12%2021.35l-1.45-1.32C5.4%2015.36%202%2012.28%202%208.5%202%205.42%204.42%203%207.5%203c1.74%200%203.41.81%204.5%202.09C13.09%203.81%2014.76%203%2016.5%203%2019.58%203%2022%205.42%2022%208.5c0%203.78-3.4%206.86-8.55%2011.54L12%2021.35z%22%20fill%3D%22%23B8965A%22%20stroke%3D%22%236B655C%22%20stroke-width%3D%221.4%22%2F%3E%3C%2Fsvg%3E") 14 13, auto;
}
/* button 的 UA 預設游標是 default，不寫這一行，滑到鑽石上愛心就會變回箭頭 */
.gem {
  cursor: inherit;
}
</style>
