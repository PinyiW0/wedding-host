import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

const base = '/api/v1/weddings/wedding-001'

test('預計邀請與確認出席分開，回覆及覆寫不抹除預計人數', async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  const created = await page.request.post(`${base}/guests`, {
    data: { name: '預計五位測試', side: 'bride', diet: 'meat', category: '', contact: '', partySize: 5 },
  })
  expect(created.ok()).toBeTruthy()
  const { guestId } = await created.json()
  await page.goto('/weddings/wedding-001/rsvp', { waitUntil: 'networkidle' })
  const row = page.getByTestId(`rsvp-row-${guestId}`)
  await expect(row.locator('td').nth(4)).toHaveText('5')
  await expect(row.getByTestId('rsvp-confirmed-count')).toHaveText('待確認')
  // 訪客只確認三位；原本預計五位仍保留。
  const replied = await page.request.post(`${base}/guests/${guestId}/rsvp`, {
    data: { attending: 'attending', diet: 'meat', plusOneCount: 2, childChairCount: 0 },
  })
  expect(replied.ok()).toBeTruthy()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(row.locator('td').nth(4)).toHaveText('5')
  await expect(row.getByTestId('rsvp-confirmed-count')).toHaveText('3')
  const declined = await page.request.post(`${base}/guests/${guestId}/rsvp-override`, {
    data: { attending: 'declined', reason: '電話告知無法出席' },
  })
  expect(declined.ok()).toBeTruthy()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(row.locator('td').nth(4)).toHaveText('5')
  await expect(row.getByTestId('rsvp-confirmed-count')).toHaveText('0')
  // CSV 與表格採用同樣兩欄。
  const download = page.waitForEvent('download')
  await page.getByTestId('rsvp-export-csv').click()
  const file = await download
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!)
    chunks.push(Buffer.from(chunk))
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('預計邀請人數,確認出席人數')
  expect(csv).toMatch(/預計五位測試[^\n]*,5,0,/)
})
