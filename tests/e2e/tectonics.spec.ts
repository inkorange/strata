import { expect, test } from '@playwright/test'

test('Tectonics route renders plates + timeline', async ({ page }) => {
  await page.goto('/tectonics')
  await expect(page.locator('canvas')).toBeVisible()
  // Era name is in the sidebar heading; default is 'Present'.
  await expect(page.getByRole('heading', { name: 'Present' })).toBeVisible()
  // Six era markers in the timeline.
  for (const eraName of [
    'Pangaea',
    'Late Jurassic',
    'Late Cretaceous',
    'Eocene',
    'Present',
    'Future (Projected)',
  ]) {
    await expect(page.getByRole('button', { name: eraName })).toBeVisible()
  }
})

test('clicking an era marker updates the sidebar after the tween', async ({ page }) => {
  await page.goto('/tectonics')
  // dispatchEvent fires directly on the element, bypassing the Next.js
  // dev-overlay portal that sits above the page in development mode.
  await page.getByRole('button', { name: 'Pangaea' }).dispatchEvent('click')
  // Sidebar heading reflects the target era immediately (before the tween).
  await expect(page.getByRole('heading', { name: 'Pangaea' })).toBeVisible({ timeout: 8000 })
})

test('Play button toggles to Stop and back', async ({ page }) => {
  await page.goto('/tectonics')
  // dispatchEvent fires directly on the element, bypassing the Next.js
  // dev-overlay portal that sits above the page in development mode.
  await page.getByRole('button', { name: 'Start playthrough' }).dispatchEvent('click')
  // Button label updates to Stop.
  await expect(page.getByRole('button', { name: 'Stop playthrough' })).toBeVisible()
  // Clicking it again returns to Play.
  await page.getByRole('button', { name: 'Stop playthrough' }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'Start playthrough' })).toBeVisible()
})

test('Timeline is not present on the hub', async ({ page }) => {
  await page.goto('/')
  // No era markers on hub.
  await expect(page.getByRole('button', { name: 'Pangaea' })).not.toBeVisible()
})
