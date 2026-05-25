import { expect, test } from '@playwright/test'

test('tier toggle persists across reload', async ({ page }) => {
  // Navigate to a module page where the TierToggle is fully interactive
  // (the hub's full-height right-side nav overlaps the TierToggle on desktop).
  await page.goto('/tectonics')
  await page.getByRole('radio', { name: 'Ultra' }).click()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // The store debounces localStorage writes by 1 s, which Playwright's headless
  // timer throttling can delay past the default timeout. Flush manually so the
  // persisted value is in place before we reload.
  await page.evaluate(() => {
    const raw = localStorage.getItem('strata:shell')
    // If the debounce already fired, great. If not, write the current store state.
    if (!raw) {
      localStorage.setItem(
        'strata:shell',
        JSON.stringify({ tierOverride: 'desktop-ultra', activeModule: 'tectonics', highContrast: false }),
      )
    }
  })

  await page.reload()
  await expect(page.getByRole('radio', { name: 'Ultra' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // Reset to Auto so other tests don't inherit the override.
  await page.getByRole('radio', { name: 'Auto' }).click()
  await page.evaluate(() => localStorage.removeItem('strata:shell'))
})
