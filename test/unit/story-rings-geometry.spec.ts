import { describe, expect, it } from 'vitest'
import { buildRings, LEFT_RING, RIGHT_RING, stoneBounds } from '~/components/story/storyRingsGeometry'

/** 固定亂數：抖動與測試結果才可重現（元件在瀏覽器裡給的是 Math.random） */
function seeded(): () => number {
  let state = 0x2F6E2B1
  return () => {
    state = (state * 1103515245 + 12345) & 0x7FFFFFFF
    return state / 0x7FFFFFFF
  }
}

/** 世界座標（盒寬單位）換到某枚戒指的局部座標 */
function toLocal(ring: typeof LEFT_RING, u: number, v: number): [number, number] {
  const dx = u - ring.cx
  const dy = v - ring.cy
  const c = Math.cos(ring.phi)
  const s = Math.sin(ring.phi)
  return [dx * c + dy * s, -dx * s + dy * c]
}

/** 那個點落在這枚戒指的哪裡：空洞、實體，或整個在戒指外 */
function surfaceOf(ring: typeof LEFT_RING, u: number, v: number): 'hole' | 'solid' | 'out' {
  const [lx, ly] = toLocal(ring, u, v)
  const q = 1 - (lx / ring.a) ** 2
  if (q < 0)
    return 'out'
  const hOut = ring.b * Math.sqrt(q)
  if (ly < -hOut || ly > ring.d + hOut)
    return 'out'
  const aIn = ring.a - ring.t
  const bIn = ring.b - (ring.t * ring.b) / ring.a
  const qIn = 1 - (lx / aIn) ** 2
  const hIn = qIn < 0 ? -1 : bIn * Math.sqrt(qIn)
  const top = hIn >= 0 && Math.abs(ly) <= hIn
  const bottom = hIn >= 0 && Math.abs(ly - ring.d) <= hIn
  return top && bottom ? 'hole' : 'solid'
}

describe('一對婚戒的網點幾何', () => {
  it('桌機與手機寬度下，粒子數都落在耐看的區間', () => {
    for (const width of [512, 302]) {
      const geo = buildRings(width, width * 0.6, seeded())
      expect(geo.points.length).toBeGreaterThan(1800)
      expect(geo.points.length).toBeLessThan(4000)
    }
  })

  it('鑽石的變身目標與鑽石粒子一對一，沒有多也沒有少', () => {
    const geo = buildRings(512, 307, seeded())
    const gems = geo.points.filter(p => p.gem)
    expect(gems.length).toBeGreaterThan(40)
    // 每顆鑽石粒子都拿到了自己的刻面線落點（B 與 A 不同）
    const moved = gems.filter(p => Math.hypot(p.bx - p.x, p.by - p.y) > 0.001)
    expect(moved.length).toBe(gems.length)
    // 戒圈粒子的 B 就是 A：它們不變身
    for (const p of geo.points.filter(q => !q.gem)) {
      expect(p.bx).toBe(p.x)
      expect(p.by).toBe(p.y)
    }
  })

  it('空洞裡只留另一枚戒指穿過去的帶子，其餘是空的', () => {
    const width = 512
    const geo = buildRings(width, width * 0.6, seeded())
    let crossing = 0
    for (const p of geo.points) {
      const u = p.x / width
      const v = p.y / width
      const left = surfaceOf(LEFT_RING, u, v)
      const right = surfaceOf(RIGHT_RING, u, v)
      if (left !== 'hole' && right !== 'hole')
        continue
      // 落在某一圈的洞裡的粒子，一定是另一圈的帶子（兩圈交扣的地方）
      const otherIsSolid = (left === 'hole' && right === 'solid') || (right === 'hole' && left === 'solid')
      expect(otherIsSolid).toBe(true)
      crossing++
    }
    // 交扣真的有發生，不是因為一顆都沒有才通過
    expect(crossing).toBeGreaterThan(20)
  })

  it('所有粒子都留在盒子裡，離邊還有餘裕', () => {
    const width = 512
    const height = width * 0.6
    const geo = buildRings(width, height, seeded())
    for (const p of geo.points) {
      expect(p.x).toBeGreaterThan(width * 0.03)
      expect(p.x).toBeLessThan(width * 0.97)
      expect(p.y).toBeGreaterThan(height * 0.02)
      expect(p.y).toBeLessThan(height * 0.98)
    }
  })

  it('色調是雙色套印：受光面有金、暗面是墨、鑽石與爪座不沾金', () => {
    const geo = buildRings(512, 307, seeded())
    const band = geo.points.filter(p => !p.gem)
    for (const p of geo.points) {
      expect(p.tone).toBeGreaterThanOrEqual(0)
      expect(p.tone).toBeLessThanOrEqual(1)
      expect(Number.isFinite(p.ang)).toBe(true)
    }
    // 鑽石粒子是石頭不是金屬
    for (const p of geo.points.filter(q => q.gem))
      expect(p.tone).toBe(0)
    // 金色（tone ≥ 0.5）只佔一部分：有高光但不是整圈都金
    const gold = band.filter(p => p.tone >= 0.5).length / band.length
    expect(gold).toBeGreaterThan(0.08)
    expect(gold).toBeLessThan(0.6)
    // 最暗的那批（透過洞看到的遠壁與爪座）全是墨色
    for (const p of band.filter(q => q.r >= 0.2 * geo.s + 0.28 * geo.s * 0.62))
      expect(p.tone).toBe(0)
  })

  it('鑽石熱區的外框在右上角，大小點得到', () => {
    const box = stoneBounds()
    expect(box.u0).toBeGreaterThan(0.6)
    expect(box.u1).toBeLessThan(0.85)
    expect(box.v1).toBeLessThan(0.2)
    // 512 寬時熱區至少 44×44（WCAG 2.5.8 的命中框下限）
    expect((box.u1 - box.u0) * 512).toBeGreaterThanOrEqual(44)
    expect((box.v1 - box.v0) * 512).toBeGreaterThanOrEqual(44)
  })
})
