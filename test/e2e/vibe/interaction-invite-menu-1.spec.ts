// Source: app/pages/invite/[weddingId].vue（喜帖桌面的選單開關）+ app/components/PublicMenu.vue
// Pattern: interaction（選單開合）+ 疊層（打開後不被桌面物件蓋住）
//
// 上線當天的缺陷（issue #166）：選單外面那層掛了淡入動畫、自成一個疊層，面板被信封、照片、日期卡整個蓋住。
// 「選單三列存在」這種檢查抓不到它——這支驗的是每一列實際點得到。

import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

// 公開三頁在正式版 build 只綁新人自己那場（nuxt.config 的 landingWeddingId），別的 ID 會 404；
// dev 不綁、任何 ID 都開得了。用這個 ID 兩種 gate（dev 與 docker）都走得通
const WEDDING_ID = 'wedding-2cf97d94'
const ROWS = ['婚紗相簿', '我們的故事', '出席回覆']

// trial 點擊只做「這一點是不是真的會點到這個元素」的檢查，不送出點擊；被別的東西蓋住會逾時失敗
async function expectHittable(target: Locator) {
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  for (const ratio of [0.25, 0.5, 0.75])
    await target.click({ trial: true, position: { x: box!.width * ratio, y: box!.height / 2 }, timeout: 5000 })
}

test.describe('vibe：喜帖桌面的選單', () => {
  // 手機尺寸：桌面物件在手機稿疊得最滿，選單三列正好落在信封、照片、日期卡的位置
  test.use({ viewport: { width: 390, height: 844 } })

  test('開場信封沒有選單；進到桌面後打開選單，三列都點得到，點出席回覆會過去', async ({ page }) => {
    await page.goto(`/invite/${WEDDING_ID}`, { waitUntil: 'networkidle' })

    const openMenu = page.getByRole('button', { name: '開啟選單' })
    await expect(openMenu).toHaveCount(0)

    await page.getByRole('button', { name: '打開喜帖' }).click()
    await expect(openMenu).toBeVisible({ timeout: 15000 })
    await openMenu.click()

    const nav = page.getByRole('navigation', { name: '網站導覽' })
    for (const label of ROWS) {
      const link = nav.getByRole('link', { name: new RegExp(label) })
      await expect(link).toBeVisible()
      await expectHittable(link)
    }

    await nav.getByRole('link', { name: /出席回覆/ }).click()
    await expect(page).toHaveURL(new RegExp(`/rsvp/public/${WEDDING_ID}`))
  })

  test('關掉選單後，桌面上的日期卡照舊點得到', async ({ page }) => {
    await page.goto(`/invite/${WEDDING_ID}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '打開喜帖' }).click()

    const openMenu = page.getByRole('button', { name: '開啟選單' })
    await expect(openMenu).toBeVisible({ timeout: 15000 })
    await openMenu.click()
    await page.getByRole('button', { name: '關閉選單' }).click()
    await expect(page.getByRole('navigation', { name: '網站導覽' })).toHaveCount(0)

    const badge = page.getByRole('link', { name: /我要參加/ })
    await expect(badge).toBeVisible()
    await badge.click({ trial: true, timeout: 5000 })
  })
})
