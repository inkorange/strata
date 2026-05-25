import { expect, test } from '@playwright/test'

test('tier toggle persists across reload', async ({ page }) => {
  // Navigate to a module page where the TierToggle is fully interactive
  // (the hub's full-height right-side nav overlaps the TierToggle on desktop).
  await page.goto('/tectonics')
  await page.getByRole('radio', { name: 'Ultra' }).click()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute('aria-checked', 'true')

  // Reset to Auto so other tests don't inherit the override.
  await page.getByRole('radio', { name: 'Auto' }).click()
})
