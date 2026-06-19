'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/src/lib/accessibility'
import { useStore } from '@/src/store'
import { CONTINENT_COLOR, ERAS_BY_ID, PLATE_COLORS, type PlateId } from '../eras'
import { type LandLayer, landLayers } from '../landLayers'
import { type TweenedPlate, tweenPlates } from '../tweenPlates'
import { Land } from './Land'
import { Plate } from './Plate'

const TWEEN_DURATION_MS = 5000

/**
 * R3F group that renders the seven plate outlines (vertex-morphed) and the
 * era's landmasses (crossfaded) when activeModule === 'tectonics'.
 *
 * Plates SLERP-morph between eras (matched vertex counts). Continents are real
 * per-era paleoshorelines with independent geometry, so they CROSSFADE instead:
 * during a transition the source era's land fades out while the target's fades
 * in. Each frame recomputes tween progress and pushes both to the children.
 *
 * Visual layering:
 *   TectonicsOcean: radius 1.0 (dark blue ocean base)
 *   Land fills:     radius 1.003 (paleoshoreline landmasses above ocean)
 *   Plate outlines: radius 1.008 (colored outlines above land)
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
  const [landRender, setLandRender] = useState<ReadonlyArray<LandLayer>>(() =>
    landLayers(currentEraId, null, 0),
  )

  useEffect(() => {
    if (targetEraId === null) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[currentEraId], 1))
      setLandRender(landLayers(currentEraId, null, 0))
    } else if (prefersReducedMotion) {
      setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], 1))
      setLandRender(landLayers(currentEraId, targetEraId, 1))
      finishTween()
    }
  }, [currentEraId, targetEraId, prefersReducedMotion, finishTween])

  useFrame(() => {
    if (targetEraId === null || tweenStartedAt === null) return
    if (prefersReducedMotion) return

    const elapsed = performance.now() - tweenStartedAt
    const raw = Math.min(elapsed / TWEEN_DURATION_MS, 1)
    const eased = raw * raw * (3 - 2 * raw)

    setTweenedPlates(tweenPlates(ERAS_BY_ID[currentEraId], ERAS_BY_ID[targetEraId], eased))
    setLandRender(landLayers(currentEraId, targetEraId, eased))

    if (raw >= 1) finishTween()
  })

  if (activeModule !== 'tectonics') return null

  return (
    <group>
      {landRender.map((layer) => (
        <Land
          key={layer.key}
          polygons={layer.polygons}
          color={CONTINENT_COLOR}
          opacity={layer.opacity}
        />
      ))}
      {tweenedPlates.map((plate) => (
        <Plate key={plate.id} vertices={plate.vertices} color={PLATE_COLORS[plate.id as PlateId]} />
      ))}
    </group>
  )
}
