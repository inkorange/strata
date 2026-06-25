import { expect, test } from '@playwright/test'

test('tutor streams a reply and disables the composer while streaming', async ({ page }) => {
  // Canned streamed text response so CI never hits the real Gateway.
  await page.route('**/api/tutor', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'Mountains form where two plates collide and crumple upward.',
    })
  })

  await page.goto('/tectonics')

  // Open the tutor. dispatchEvent fires directly on the element, bypassing the
  // Next.js dev-overlay portal that sits above the page in development mode.
  await page.getByRole('button', { name: 'Ask the tutor' }).dispatchEvent('click')

  // Scope to the tutor panel so the prompt text can't collide with other UI.
  const panel = page.getByRole('complementary', { name: 'Tutor' })
  await expect(panel).toBeVisible()

  // Click a suggested prompt.
  await panel.getByRole('button', { name: 'Why do mountains form?' }).dispatchEvent('click')

  // The streamed assistant text appears.
  await expect(panel.getByText(/two plates collide/i)).toBeVisible()
})
