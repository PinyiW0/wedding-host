#!/usr/bin/env node
// 示範資料：把 seed 補成「一場像樣的婚禮」，給 README 演示素材與產品短片錄影用
//
// 種子資料為了 E2E 測試刻意精簡（19 組賓客、0 入座、流程表 1 列、圖片欄位全空），
// 直接錄會滿畫面空狀態。這支腳本在 reset 之後透過後台 API 補資料，不改 seed 本身。
//
// 用法（dev server 需為 open 模式）：
//   node scripts/demo-data.mjs base       [BASE_URL]   補賓客、回覆、喜餅、小物、流程、謝卡（不排桌）
//   node scripts/demo-data.mjs reception  [BASE_URL]   排完桌之後：報到約六成賓客並登記禮金
// 也可以 import { seedDemoBase, seedDemoReception } 由 capture-demo.mjs 呼叫。
//
// 圖片放 scripts/demo-assets/（AI 生成的示意圖，不含真人與文字），以 data URL 寫入。

import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEDDING_ID = 'wedding-001'

// 錄影腳本用得到的固定人物（以姓名查 guestId，因為新增賓客的 ID 是隨機的）
export const DEMO = {
  weddingId: WEDDING_ID,
  // 連結中心示範對象
  linkGuestName: '黃雅婷',
  // 接待台示範對象：reception 階段刻意留著不報到
  receptionGuestName: '呂怡君',
  // 當天流程示範角色（seed 的四個角色之一）
  roleName: '新秘',
}

function api(base) {
  return async function call(method, path, body) {
    const res = await fetch(`${base}/api/v1/weddings/${WEDDING_ID}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok)
      throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`)
    return text ? JSON.parse(text) : null
  }
}

async function dataUrl(name) {
  const buf = await readFile(resolve(HERE, 'demo-assets', `${name}.webp`))
  return `data:image/webp;base64,${Buffer.from(buf).toString('base64')}`
}

// 手繪風小花（與 seed 的 flowerSvg 同一種格式：SVG data URI，# 寫成 %23）
const PETALS = ['D98E8A', 'E8A5B8', 'F2B872', 'C9A0DC', '8FB8DE', 'E57F84', 'F4C6C0', 'B8D8A8']
const CENTERS = ['E8C46A', 'F6E3A1', 'D9A441']
function flowerSvg(i) {
  const petal = PETALS[i % PETALS.length]
  const center = CENTERS[i % CENTERS.length]
  const count = [5, 6, 8][i % 3]
  const rx = count === 8 ? 10 : 15
  let petals = ''
  for (let k = 0; k < count; k++)
    petals += `<ellipse cx='60' cy='34' rx='${rx}' ry='25' fill='%23${petal}' transform='rotate(${(360 / count) * k} 60 56)'/>`
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><path d='M60 78 Q${55 + (i % 3) * 4} 96 60 112' stroke='%237C9A6D' stroke-width='4' fill='none'/>${petals}<circle cx='60' cy='56' r='11' fill='%23${center}'/></svg>`
}

const BLESSINGS = [
  '新婚快樂，永浴愛河！',
  '祝你們白頭偕老，天天都像今天一樣開心。',
  '恭喜恭喜！一定要幸福喔。',
  '百年好合，早生貴子。',
  '看著你們一路走來，真的很替你們高興。',
  '願你們的家永遠充滿笑聲。',
  '執子之手，與子偕老。恭喜！',
  '終於等到這一天，祝福你們！',
  '新婚誌喜，甜甜蜜蜜一輩子。',
  '有情人終成眷屬，祝永遠幸福。',
]

// 新增的賓客（虛構人名）。欄位：姓名、男女方、分類、葷素、總人數、兒童椅、回覆（a 出席／d 婉拒／n 未回覆）
const G = (name, side, category, partySize, opts = {}) => ({ name, side, category, partySize, diet: 'meat', childChair: 0, rsvp: 'a', ...opts })
const NEW_GUESTS = [
  // 男方
  G('林國棟', 'groom', '親戚', 3),
  G('林秀琴', 'groom', '親戚', 2),
  G('林文雄', 'groom', '親戚', 4, { childChair: 1 }),
  G('張淑惠', 'groom', '親戚', 2, { diet: 'vegetarian' }),
  G('林建志', 'groom', '家人', 3),
  G('柯建良', 'groom', '親戚', 3),
  G('洪建宏', 'groom', '主管', 2),
  G('黃俊傑', 'groom', '朋友', 2),
  G('吳宗翰', 'groom', '朋友', 2),
  G('劉冠宇', 'groom', '朋友', 1),
  G('邱奕辰', 'groom', '朋友', 2),
  G('賴柏均', 'groom', '朋友', 4, { childChair: 1 }),
  G('徐偉倫', 'groom', '朋友', 2),
  G('紀冠霖', 'groom', '朋友', 2),
  G('蔡柏翰', 'groom', '同學', 2),
  G('楊承恩', 'groom', '同學', 1),
  G('許彥廷', 'groom', '同學', 3, { childChair: 1 }),
  G('廖子軒', 'groom', '同學', 2),
  G('蘇冠廷', 'groom', '同學', 1),
  G('藍宇翔', 'groom', '同學', 3, { childChair: 1 }),
  G('鄭信宏', 'groom', '同事', 2),
  G('謝家豪', 'groom', '同事', 1),
  G('郭志偉', 'groom', '同事', 2),
  G('溫家瑋', 'groom', '同事', 2),
  G('曾明哲', 'groom', '同事', 1, { rsvp: 'd' }),
  G('周哲維', 'groom', '同事', 1, { rsvp: 'n' }),
  // 女方
  G('陳美玲', 'bride', '親戚', 3),
  G('陳淑芬', 'bride', '親戚', 2),
  G('葉麗華', 'bride', '親戚', 4),
  G('莊雅惠', 'bride', '親戚', 2, { diet: 'vegetarian' }),
  G('陳俊宏', 'bride', '家人', 2),
  G('田淑娟', 'bride', '親戚', 3),
  G('余慧君', 'bride', '主管', 2),
  G('呂怡君', 'bride', '朋友', 2),
  G('江雅婷', 'bride', '朋友', 1),
  G('何佳穎', 'bride', '朋友', 2),
  G('游雅雯', 'bride', '朋友', 2),
  G('鍾怡安', 'bride', '朋友', 3),
  G('嚴婕妤', 'bride', '朋友', 2),
  G('傅思妤', 'bride', '朋友', 1, { rsvp: 'd' }),
  G('石曉雯', 'bride', '朋友', 2, { rsvp: 'd' }),
  G('蕭欣怡', 'bride', '同學', 2),
  G('羅詩涵', 'bride', '同學', 1),
  G('高心怡', 'bride', '同學', 3, { childChair: 1 }),
  G('戴筱涵', 'bride', '同學', 2),
  G('白靜怡', 'bride', '同學', 2),
  G('魏芷涵', 'bride', '同學', 3),
  G('潘雅筑', 'bride', '同事', 2),
  G('方婉婷', 'bride', '同事', 1),
  G('簡宜蓁', 'bride', '同事', 2),
  G('康雅琪', 'bride', '同事', 2),
  G('姚佩珊', 'bride', '同事', 1, { rsvp: 'n' }),
]

// 錄影用價錢：喜餅每款比 seed 高 200；小物既有兩項比 seed 高 20%
const CAKE = {
  經典禮盒: { price: 1400, image: 'cake-classic' },
  豪華禮盒: { price: 2000, image: 'cake-deluxe' },
  輕巧禮盒: { price: 1180, image: 'cake-petite' },
}
const GIFT_PATCH = {
  table: { unitPrice: 60, image: 'gift-table' },
  send_off: { unitPrice: 96, image: 'gift-send-off' },
}
const GIFT_NEW = [
  { category: 'second_entrance', description: '喜糖束口袋二進禮', unitPrice: 45, quantity: 140, distributionTime: '二次進場時發送', shippingFee1: 120, image: 'gift-second-entrance' },
  { category: 'game', description: '香氛蠟燭遊戲獎品', unitPrice: 320, quantity: 12, distributionTime: '敬酒前遊戲時間', shippingFee1: 80, image: 'gift-game' },
  { category: 'room_visit', description: '手工皂探房禮', unitPrice: 180, quantity: 24, distributionTime: '婚宴前親友探房', shippingFee1: 100, image: 'gift-room-visit' },
  { category: 'tea_ceremony', description: '花茶禮盒喝茶禮', unitPrice: 260, quantity: 16, distributionTime: '奉茶儀式後', shippingFee1: 100, image: 'gift-tea' },
]

// 當天流程：時間、分鐘、標題、地點、共用物品、各角色（待辦／自己要帶的）、重點、賓客可見
const RUNDOWN = [
  ['15:00', 60, '新娘梳化', '新娘房', '', { 新秘: ['新娘妝髮、白紗著裝', '梳化箱、備用髮飾、針線包'], 平面攝影師: ['拍攝梳化側寫', '相機兩台、備用電池'] }, false, false],
  ['17:00', 30, '彩排・設備確認', '宴會廳', '音響、投影、麥克風', { 總場控: ['帶新人走位、確認音樂與投影', '流程表、對講機'], 新秘: ['彩排後補妝', '補妝包'], 接待: ['佈置收禮桌', '禮金簿、簽名綢、桌卡'] }, false, false],
  ['17:30', 30, '迎賓・收禮金', '宴會廳入口', '禮金簿、簽名綢、喜糖', { 接待: ['引導簽名、收禮金、發喜餅', '報到平板、零錢袋'], 平面攝影師: ['拍攝迎賓與賓客合照', '閃燈'] }, true, true],
  ['18:00', 25, '主持開場・一進', '宴會廳', '進場音樂、手捧花', { 總場控: ['提示主持人、開門時機', ''], 平面攝影師: ['紅毯正面卡位', ''], 新秘: ['進場前整理頭紗', '髮夾、定型液'] }, true, true],
  ['18:30', 10, '開桌上菜', '宴會廳', '', { 總場控: ['通知餐廳出菜', ''] }, false, true],
  ['19:00', 30, '退場換裝', '新娘房', '第二套禮服', { 新秘: ['換晚禮服、改造型', '晚禮服、飾品盒'] }, false, false],
  ['19:30', 45, '二進・遊戲・敬酒', '宴會廳', '遊戲道具、酒水', { 總場控: ['遊戲流程與獎品發放', '遊戲獎品 12 份'], 平面攝影師: ['逐桌敬酒合照', ''], 接待: ['協助發送二進禮', '二進禮 140 份'] }, true, true],
  ['20:30', 30, '二退換裝・備送客', '新娘房', '送客禮服', { 新秘: ['換送客禮服、補妝', '送客禮服、髮飾'] }, false, false],
  ['21:00', 30, '送客・合照', '宴會廳門口', '送客禮', { 接待: ['門口發送客禮', '送客禮 150 份'], 平面攝影師: ['門口合照', ''], 總場控: ['確認場地復原與物品清點', ''] }, false, true],
]

// 桌位改成橫向排法：主桌居中靠舞台、家屬桌在兩側、其餘兩排（seed 是兩直排，16:9 畫面放不下）
// 值是桌子中心點；偶數桌在左（男方）、奇數桌在右（女方），與推薦排序的「男左女右」一致
const TABLE_CENTER = {
  'table-004': [320, 330],
  'table-002': [610, 330],
  'table-001': [900, 330],
  'table-003': [1190, 330],
  'table-005': [1480, 330],
  'table-010': [175, 630],
  'table-008': [465, 630],
  'table-006': [755, 630],
  'table-007': [1045, 630],
  'table-009': [1335, 630],
  'table-011': [1625, 630],
  'table-014': [465, 930],
  'table-012': [755, 930],
  'table-013': [1045, 930],
  'table-015': [1335, 930],
}

export async function seedDemoBase(base) {
  const call = api(base)

  // 桌位與舞台（position 是桌子外框左上角，外框寬 200）
  const layout = await call('GET', '/venue-layout')
  await call('PUT', '/venue-layout', { ...layout, stageWidth: 420, stageHeight: 130, stagePositionX: 690, stagePositionY: 20 })
  for (const [tableId, [cx, cy]] of Object.entries(TABLE_CENTER)) {
    await call('PATCH', `/tables/${tableId}`, { positionX: cx - 100, positionY: cy - 100 })
  }

  // 婚禮：人名統一（seed 的標題與新人欄位不一致），補場地資訊
  await call('PATCH', '', {
    title: '志明與春嬌的婚禮',
    groomName: '志明',
    brideName: '春嬌',
    mapLink: 'https://maps.google.com/?q=台北君悅酒店',
    parkingInfo: '飯店 B2–B4 停車場，憑喜帖享 4 小時免費停車',
    transportInfo: '捷運台北 101／世貿站 2 號出口，步行約 5 分鐘',
  })

  // 既有賓客：新郎新娘改名，全員回覆出席
  const seedGuests = await call('GET', '/guests')
  const rename = { 'guest-101': '新郎 志明', 'guest-102': '新娘 春嬌' }
  let n = 0
  for (const g of seedGuests) {
    if (rename[g.guestId])
      await call('PATCH', `/guests/${g.guestId}`, { name: rename[g.guestId] })
    await call('POST', `/guests/${g.guestId}/rsvp`, {
      attending: 'attending',
      diet: g.diet,
      plusOneCount: Math.max(0, g.partySize - 1 - g.childChairCount),
      childChairCount: g.childChairCount,
    })
    n++
  }

  // 新增賓客並送出回覆（出席者多數附祝福與小花）
  for (const [i, g] of NEW_GUESTS.entries()) {
    const created = await call('POST', '/guests', {
      name: g.name,
      side: g.side,
      diet: g.diet,
      category: g.category,
      contact: `09${String(10000000 + i * 137911).slice(0, 8)}`,
      partySize: g.partySize,
      childChairCount: g.childChair,
    })
    if (g.rsvp === 'n')
      continue
    const attending = g.rsvp === 'a'
    await call('POST', `/guests/${created.guestId}/rsvp`, {
      attending: attending ? 'attending' : 'declined',
      diet: g.diet,
      plusOneCount: Math.max(0, g.partySize - 1 - g.childChair),
      childChairCount: g.childChair,
      ...(attending && i % 5 !== 4 ? { blessing: BLESSINGS[i % BLESSINGS.length], flowerDrawing: flowerSvg(i) } : {}),
    })
    n++
  }

  // 回覆表單：花卉水彩主題（內建插畫，不需要上傳照片）
  const rsvpConfig = await call('GET', '/rsvp-config')
  await call('PUT', '/rsvp-config', { theme: 'floral', banners: [], questions: rsvpConfig.questions })

  // 喜餅：加照片、調價
  for (const t of await call('GET', '/cake-box-types')) {
    const d = CAKE[t.name]
    if (d)
      await call('PATCH', `/cake-box-types/${t.cakeBoxTypeId}`, { price: d.price, imageUrl: await dataUrl(d.image) })
  }

  // 小物：既有兩項加照片與調價，另補四類
  for (const item of await call('GET', '/gift-items')) {
    const d = GIFT_PATCH[item.category]
    if (d)
      await call('PATCH', `/gift-items/${item.giftItemId}`, { unitPrice: d.unitPrice, imageUrl: await dataUrl(d.image) })
  }
  for (const { image, ...item } of GIFT_NEW)
    await call('POST', '/gift-items', { ...item, imageUrl: await dataUrl(image) })

  // 當天流程：整表取代，所以既有列要帶著 ID 一起送回
  const roles = await call('GET', '/rundown-roles')
  const roleId = Object.fromEntries(roles.map(r => [r.name, r.roleId]))
  const existing = await call('GET', '/rundown-items')
  const rows = RUNDOWN.map(([time, durationMinutes, title, location, supplies, tasks, highlight, guestVisible]) => ({
    time,
    durationMinutes,
    title,
    location,
    supplies,
    note: '',
    highlight,
    guestVisible,
    roleTasks: Object.entries(tasks).map(([role, [task, own]]) => ({ roleId: roleId[role], task, supplies: own })),
  }))
  const items = [...existing, ...rows].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  await call('PUT', '/rundown-items', { items })

  // 謝卡範本
  await call('PUT', '/thank-you-card/template', {
    // 稱呼由謝卡頁自己加，範本只寫內文
    templateContent: '謝謝你來參加我們的婚禮。那天因為有你，才那麼完整。\n你的祝福我們都收到了，會好好放在心裡。\n\n改天一定要再約，讓我們好好請你吃頓飯。',
    templateImageUrl: await dataUrl('thankyou-hero'),
    greeting: 'With Gratitude',
    signature: '志明 & 春嬌',
    signatureDate: '2026-10-10',
  })

  return { replies: n, guests: seedGuests.length + NEW_GUESTS.length, rundown: items.length }
}

// 排完桌之後呼叫：報到約六成出席賓客並登記禮金，接待台與總覽的數字才像婚禮進行中
export async function seedDemoReception(base) {
  const call = api(base)
  const guests = (await call('GET', '/guests')).filter(g => g.rsvpAttending === 'attending' && g.name !== DEMO.receptionGuestName)
  const AMOUNTS = [1600, 2000, 2200, 2600, 3200, 3600]
  let checked = 0
  let total = 0
  for (const [i, g] of guests.entries()) {
    if (i % 5 >= 3)
      continue
    await call('POST', `/guests/${g.guestId}/check-in`)
    const amount = AMOUNTS[i % AMOUNTS.length] * (g.partySize >= 3 ? 2 : 1)
    await call('POST', `/guests/${g.guestId}/gift-money`, { amount })
    checked++
    total += amount
  }
  return { checked, total }
}

// 直接執行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [stage = 'base', base = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000'] = process.argv.slice(2)
  const run = { base: seedDemoBase, reception: seedDemoReception }[stage]
  if (!run) {
    console.error('用法：node scripts/demo-data.mjs <base|reception> [BASE_URL]')
    process.exit(1)
  }
  console.log(stage, await run(base))
}
