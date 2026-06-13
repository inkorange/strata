import { expect, test } from '@playwright/test'

test('Earth Systems route renders the carbon-sandbox chrome', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/systems')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Earth Systems' })).toBeVisible()

  // Two lever sliders + the playback scrubber expose role="slider".
  await expect(page.getByRole('slider', { name: 'Fossil-fuel emissions' })).toBeVisible()
  await expect(page.getByRole('slider', { name: /Land use/ })).toBeVisible()

  // Scenario presets.
  for (const label of ['Pre-industrial', 'Present day', 'High emissions']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }

  // Gauge panel.
  await expect(page.getByRole('complementary', { name: 'Carbon reservoir gauges' })).toBeVisible()

  await page.waitForTimeout(500)
  expect(
    consoleErrors.filter((e) => !e.toLowerCase().includes('webgl')),
    `unexpected console errors: ${consoleErrors.join('\n')}`,
  ).toEqual([])
})

test('switching scenario updates the active preset', async ({ page }) => {
  await page.goto('/systems')
  const preIndustrial = page.getByRole('button', { name: 'Pre-industrial' })
  await preIndustrial.dispatchEvent('click')
  await expect(preIndustrial).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Present day' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('Systems levers and gauges are not present on the hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('slider', { name: 'Fossil-fuel emissions' })).not.toBeVisible()
  await expect(
    page.getByRole('complementary', { name: 'Carbon reservoir gauges' }),
  ).not.toBeVisible()
})
