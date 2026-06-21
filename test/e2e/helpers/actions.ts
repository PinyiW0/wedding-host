import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'

// regex 提升至 module scope，避免每次呼叫重新編譯
const CONFIRM_VERB_RE = /^(確認|確定|送出|匯出|刪除|移除|完成|恢復)/
const CONFIRM_FALLBACK_RE = /^(確認|確定|送出)/
const FEEDBACK_RE = /成功|已送出|已建立|已更新|已刪除|已恢復|已移除/

/**
 * 登入操作（對應 testAccounts 帳號）。
 * testid 約定（UI 必須實作）：login-account / login-password / login-submit
 * ⚠️ 等待條件：離開 /login 頁面（不寫死目標 URL，因為根路由可能 redirect）
 */
export async function login(page: Page, account: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.getByTestId('login-account').fill(account)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

/** USelect 操作：click 打開 → 選擇 option */
export async function selectOption(page: Page, testId: string, optionName: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: optionName }).click()
}

/** 確認彈窗：等待出現 → 點擊確認（testid 約定：confirm-modal / confirm-ok） */
export async function confirmDelete(page: Page) {
  await expect(page.getByTestId('confirm-modal')).toBeVisible()
  await page.getByTestId('confirm-ok').click()
}

/** 重設 mock 資料（測試獨立性）。在 test.beforeEach 呼叫。 */
export async function resetMockData(page: Page) {
  await page.request.post('/api/__test__/reset')
}

/** 找實體：row / article / listitem 任一形式，用語意 name 定位 */
export function findEntity(page: Page, name: string | RegExp): Locator {
  return page
    .getByRole('row', { name })
    .or(page.getByRole('article', { name }))
    .or(page.getByRole('listitem', { name }))
    .first()
}

/** 可選 confirm：dialog scope + 動詞前綴 regex */
export async function maybeConfirm(page: Page) {
  const dialog = page.getByRole('dialog')
  const hasDialog = await dialog.first().isVisible({ timeout: 2000 }).catch(() => false)
  if (hasDialog) {
    const confirm = dialog.getByRole('button', { name: CONFIRM_VERB_RE })
    if (await confirm.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await confirm.first().click()
      return
    }
  }
  const fallback = page.getByRole('button', { name: CONFIRM_FALLBACK_RE })
  if (await fallback.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await fallback.first().click()
  }
}

/** 找成功反饋（不限形式）：role=alert / status / 語意文字 */
export function getFeedbackElement(page: Page): Locator {
  return page
    .getByRole('alert')
    .or(page.getByRole('status'))
    .or(page.getByText(FEEDBACK_RE))
    .first()
}

/** API spy 包裝（path regex + method） */
export function waitForApiCall(page: Page, pathRegex: RegExp, method: string) {
  return page.waitForRequest(req => pathRegex.test(req.url()) && req.method() === method)
}
