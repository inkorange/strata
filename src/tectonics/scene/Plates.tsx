'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'
import { CONTINENT_COLOR, ERAS_BY_ID, PLATE_COLORS, type PlateId } from '../eras'
import {
  type TweenedContinent,
  type TweenedPlate,
  tweenContinents,
  tweenPlates,
} from '../tweenPlates'
import { Continent } from './Continent'
import { Plate } from './Plate'

const TWEEN_DURATION_MS = 5000

/**
 * R3F group that renders the seven plates and seven continent landmasses when
 * activeModule === 'tectonics'. Each frame, computes the tween progress between
 * currentEraId and targetEraId, and passes interpolated vertices to each child.
 *
 * Visual layering:
 *   TectonicsOcean: radius 1.0 (dark blue ocean base)
 *   Continent fills: radius 1.003 (green-tan landmasses above ocean)
 *   Plate outlines:  radius 1.008 (colored outlines above continents)
 *
 * Pedagogically, continents show WHERE the land is; plate outlines show WHERE
 * the tectonic boundaries are — which don't match, because plates extend into
 * the surrounding oceans.
 */
export function Plates() {
  const activeModule = useStore((s) => s.activeModule)
  const currentEraId = useStore((s) => s.currentEraId)
  const targetEraId = useStore((s) => s.targetEraId)
  const tweenStartedAt = useStore((s) => s.tweenStartedAt)
  const finishTween = useStore((s) => s.finishTween)
  const prefersReducedMotion = usePrefersReducedMotion()

  const [tweenedPlates, setTweenedPlates] = useState<ReadonlyArray<TweenedPlate>>(() =>
    tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1),
  )
  const [tweenedContinents, setTweenedContinents] = useState<ReadonlyArray<TweenedContinent>>(() =>
    tweenContinents(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1),
  )

  useEffect(() => {
    if (targetEraId === null) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1))
      setTweenedContinents(tweenContinents(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1))
    } else if (prefersReducedMotion) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], 1))
      setTweenedContinents(tweenContinents(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], 1))
      finishTween()
    }
  }, [currentEraId, targetEraId, prefersReducedMotion, finishTween])

  useFrame(() => {
    if (targetEraId === null || tweenStartedAt === null) return
    if (prefersReducedMotion) return

    const elapsed = performance.now() - tweenStartedAt
    const raw = Math.min(elapsed / TWEEN_DURATION_MS, 1)
    const eased = raw * raw * (3 - 2 * raw)

    const source = ERAS_BY_ID[currentEraId]
    const target = ERAS_BY_ID[targetEraId]
    setTweenedPlates(tweenPlates(source, target, eased))
    setTweenedContinents(tweenContinents(source, target, eased))

    if (raw >= 1) finishTween()
  })

  if (activeModule !== 'tectonics') return null

  return (
    <group>
      {tweenedContinents.map((continent) => (
        <Continent key={continent.id} polygons={continent.polygons} color={CONTINENT_COLOR} />
      ))}
      {tweenedPlates.map((plate) => (
        <Plate key={plate.id} vertices={plate.vertices} color={PLATE_COLORS[plate.id as PlateId]} />
      ))}
    </group>
  )
}
