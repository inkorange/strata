import { expect, test } from '@playwright/test'

test('Atmosphere route renders the day-cycle viewer chrome', async ({ page }) => {
  await page.goto('/atmosphere')
  await expect(page.locator('canvas')).toBeVisible()
  // Sidebar heading from AtmosphereBody.
  await expect(page.getByRole('heading', { name: 'Atmosphere' })).toBeVisible()
  // Three layer-toggle chips.
  for (const label of ['Cells', 'Temperature', 'Clouds']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible()
  }
  // Scrubber knob (role=slider).
  await expect(page.getByRole('slider')).toBeVisible()
})

test('toggling a chip flips its aria-pressed state', async ({ page }) => {
  await page.goto('/atmosphere')
  const cells = page.getByRole('button', { name: 'Cells' })
  await expect(cells).toHaveAttribute('aria-pressed', 'true')
  await cells.dispatchEvent('click')
  await expect(cells).toHaveAttribute('aria-pressed', 'false')
  await cells.dispatchEvent('click')
  await expect(cells).toHaveAttribute('aria-pressed', 'true')
})

test('Wind belts legend expands on click', async ({ page }) => {
  await page.goto('/atmosphere')
  const toggle = page.getByRole('button', { name: 'Show wind-belt legend' })
  await expect(toggle).toBeVisible()
  await toggle.dispatchEvent('click')
  // Once expanded, the three belt labels appear.
  await expect(page.getByText('Trade winds → equator')).toBeVisible()
  await expect(page.getByText('Westerlies W → E')).toBeVisible()
  await expect(page.getByText('Polar easterlies E → W')).toBeVisible()
})

test('Atmosphere scrubber and chips are not present on the hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Cells' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Temperature' })).not.toBeVisible()
})
