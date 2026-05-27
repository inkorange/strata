'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/src/store'
import { ERAS_BY_ID, type Era } from '../eras'
import { Timeline } from './Timeline'

/**
 * Sidebar body for the Tectonics module. Shows the era name + Mya +
 * tier-appropriate description. While a tween is in progress, displays
 * the target era's data so the user knows where they're heading.
 *
 * Also renders the Timeline component, which positions itself at the
 * bottom of the viewport via fixed positioning.
 */
export function TectonicsBody() {
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const tierOverride = useStore((s) => s.tierOverride)

  // Mount guard to avoid SSR/client hydration mismatch on tier-dependent
  // text (matches the pattern from TierToggle).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayedEraId = targetEraId ?? currentEraId
  const era: Era = ERAS_BY_ID[displayedEraId]

  // Tier-dependent verbosity:
  //   mobile-lite -> Beginner copy
  //   balanced    -> Standard
  //   desktop-ultra -> Advanced
  //   null (auto) -> Standard (sensible default)
  const effectiveTierOverride = mounted ? tierOverride : null
  const description =
    effectiveTierOverride === 'mobile-lite'
      ? era.descriptionBeginner
      : effectiveTierOverride === 'desktop-ultra'
        ? era.descriptionAdvanced
        : era.descriptionStandard

  const showMya = effectiveTierOverride !== 'mobile-lite' // Beginner tier hides numbers

  return (
    <>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">{era.name}</h2>
          {showMya && (
            <p className="text-xs text-muted-foreground">
              {era.mya > 0
                ? `${era.mya} million years ago`
                : era.mya === 0
                  ? 'Today'
                  : `${-era.mya} million years from now`}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Timeline />
    </>
  )
}
