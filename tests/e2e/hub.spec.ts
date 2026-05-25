import { expect, test } from '@playwright/test'

test('hub renders title, all three module cards, and a canvas', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Strata' })).toBeVisible()

  for (const label of ['Tectonics', 'Atmosphere', 'Earth Systems']) {
    await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible()
  }

  // Canvas mounts under the Scene wrapper.
  await expect(page.locator('canvas')).toBeVisible()

  // Allow a beat for the WebGL context to settle, then assert no console errors.
  await page.waitForTimeout(500)
  expect(
    consoleErrors.filter((e) => !e.includes('WebGL') && !e.toLowerCase().includes('webgl')),
    `unexpected console errors: ${consoleErrors.join('\n')}`,
  ).toEqual([])
})
