import { expect, test } from '@playwright/test'

test('tier toggle persists across reload', async ({ page }) => {
  // The TierToggle now lives inside the TopNav settings popover (gear icon),
  // collapsed by default — open it before interacting.
  await page.goto('/tectonics')
  await page.getByRole('button', { name: 'Settings' }).click()
  // The TierToggle defers reading the persisted value until after its mount
  // effect (SSR-hydration guard), so give it a beat to settle before reading
  // aria-checked, which otherwise reflects the pre-hydration `null` override.
  const ultra = page.getByRole('radio', { name: 'Ultra' })
  await ultra.click()
  await expect(ultra).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })

  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute('aria-checked', 'true', {
    timeout: 10000,
  })

  // Reset to Auto so other tests don't inherit the override.
  await page.getByRole('radio', { name: 'Auto' }).click()
})
