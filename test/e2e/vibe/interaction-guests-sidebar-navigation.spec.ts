import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

test('從桌次規劃點左側賓客名單可進入並往返', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  await page.getByTestId('vibe-sidebar').getByRole('link', { name: '賓客名單', exact: true }).click()
  await expect(page).toHaveURL(/\/weddings\/wedding-001\/guests$/)
  await expect(page.getByTestId('guest-create'), JSON.stringify(errors)).toBeVisible()
  await page.getByTestId('vibe-sidebar').getByRole('link', { name: '桌次規劃', exact: true }).click()
  await expect(page).toHaveURL(/\/weddings\/wedding-001\/seating$/)
  await page.getByTestId('vibe-sidebar').getByRole('link', { name: '賓客名單', exact: true }).click()
  await expect(page.getByTestId('guest-create'), JSON.stringify(errors)).toBeVisible()
  expect(errors).toEqual([])
})
