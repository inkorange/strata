'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'
import { ERAS_BY_ID, PLATE_COLORS, type PlateId } from '../eras'
import { type TweenedPlate, tweenPlates } from '../tweenPlates'
import { Plate } from './Plate'

const TWEEN_DURATION_MS = 5000

/**
 * R3F group that renders the seven plates when activeModule === 'tectonics'.
 * Each frame, computes the tween progress between currentEraId and
 * targetEraId, calls tweenPlates with eased progress, and passes the
 * interpolated vertices to each <Plate> child.
 *
 * When the tween completes (t >= 1), calls finishTween() so the slice can
 * commit and (if playing) advance to the next era.
 */
export function Plates() {
  const activeModule = useStore((s) => s.activeModule)
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const tweenStartedAt = useStore((s) => s.tweenStartedAt)
  const finishTween = useStore((s) => s.finishTween)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Local state of the tweened plates so we re-render each frame during a
  // transition without forcing a parent re-render.
  const [tweenedPlates, setTweenedPlates] = useState<ReadonlyArray<TweenedPlate>>(() =>
    tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1),
  )

  // When the source or target era changes (without a frame yet rendering),
  // immediately recompute the tween at t=0 so the next frame's interpolation
  // starts from the right baseline.
  useEffect(() => {
    if (targetEraId === null) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1))
    } else if (prefersReducedMotion) {
      // Skip animation entirely - snap to target.
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], 1))
      finishTween()
    }
  }, [currentEraId, targetEraId, prefersReducedMotion, finishTween])

  useFrame(() => {
    if (targetEraId === null || tweenStartedAt === null) return
    if (prefersReducedMotion) return // handled by useEffect above

    const elapsed = performance.now() - tweenStartedAt
    const raw = Math.min(elapsed / TWEEN_DURATION_MS, 1)
    // Smoothstep ease.
    const eased = raw * raw * (3 - 2 * raw)

    const source = ERAS_BY_ID[currentEraId]
    const target = ERAS_BY_ID[targetEraId]
    setTweenedPlates(tweenPlates(source, target, eased))

    if (raw >= 1) finishTween()
  })

  if (activeModule !== 'tectonics') return null

  return (
    <group>
      {tweenedPlates.map((plate) => (
        <Plate key={plate.id} vertices={plate.vertices} color={PLATE_COLORS[plate.id as PlateId]} />
      ))}
    </group>
  )
}
