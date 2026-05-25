export type Tier = 'desktop-ultra' | 'balanced' | 'mobile-lite'

/**
 * One-shot device classification on first paint. Never re-runs.
 *
 * Heuristic order:
 *   1. coarse pointer (touch) -> mobile-lite, full stop
 *   2. fine pointer + >=8 logical cores + >=8 GB device memory -> desktop-ultra
 *   3. anything else with a fine pointer -> balanced
 *   4. SSR / unknown env -> balanced (safe middle ground; runtime detection
 *      reruns on the client after hydration via useEffect in Scene.tsx)
 */
export function detectTier(): Tier {
  const mm = typeof matchMedia !== 'undefined' ? matchMedia : undefined
  if (!mm) return 'balanced'

  if (mm('(pointer: coarse)').matches) return 'mobile-lite'

  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  const cores = nav?.hardwareConcurrency ?? 0
  // deviceMemory is a non-standard but widely-shipped hint (Chrome, Edge).
  // Missing in Safari/Firefox; treat absence as "unknown -> balanced".
  const mem = (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory ?? 0

  if (cores >= 8 && mem >= 8) return 'desktop-ultra'
  return 'balanced'
}
