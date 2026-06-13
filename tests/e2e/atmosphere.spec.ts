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

test('Circulation legend shows three wind belts and the doldrums', async ({ page }) => {
  await page.goto('/atmosphere')
  const opener = page.getByRole('button', { name: 'Show atmospheric circulation legend' })
  const legend = page.getByRole('complementary', { name: 'Atmospheric circulation legend' })
  // The legend is portaled + client-only, so wait for it to hydrate before
  // branching: on mobile the collapsed opener appears, on desktop the panel is
  // already open. (Checking isVisible() too early raced hydration and skipped
  // the tap, leaving the legend collapsed.)
  await expect(opener.or(legend)).toBeVisible()
  if (await opener.isVisible()) {
    await opener.click()
  }
  await expect(legend).toBeVisible()
  await expect(legend.getByText('Trade winds → equator')).toBeVisible()
  await expect(legend.getByText('Westerlies W → E')).toBeVisible()
  await expect(legend.getByText('Polar easterlies E → W')).toBeVisible()
  await expect(legend.getByText(/Doldrums \(ITCZ\)/)).toBeVisible()
})

test('Atmosphere scrubber and chips are not present on the hub', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Cells' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Temperature' })).not.toBeVisible()
})
