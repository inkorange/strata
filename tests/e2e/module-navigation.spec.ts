import { expect, test } from '@playwright/test'

test('enter Tectonics from hub, see the module frame, return to hub', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Tectonics/ }).click()
  await expect(page).toHaveURL(/\/tectonics$/)
  await expect(page.getByRole('heading', { name: 'Present' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start playthrough' })).toBeVisible()

  await page.getByRole('link', { name: /Hub/ }).click({ force: true })
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Strata' })).toBeVisible()
})

test('direct navigation to a module page renders correctly', async ({ page }) => {
  await page.goto('/atmosphere')
  await expect(page.getByRole('heading', { name: 'Atmosphere' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
})

test('invalid module slug 404s', async ({ page }) => {
  const response = await page.goto('/not-a-module')
  expect(response?.status()).toBe(404)
})
