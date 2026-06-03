'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/src/store'
import { latLngToVec3 } from '@/src/tectonics/sphericalGeometry'
import { subsolarLatForSeason, subsolarPoint } from '@/src/atmos/solar'

const BAND_RADIUS = 1.018
const PUFF_COUNT = 110 // dense enough for adjacent soft puffs to blur into a continuous band
/** Fraction of subsolar latitude the ITCZ shifts by between seasons.
 *  The real ITCZ chases the subsolar point but lags noticeably — at
 *  solstice it sits closer to 10° than to the full 23.44°. */
const SEASONAL_ITCZ_SHIFT_FRACTION = 0.55

/** Deterministic per-puff noise in [-1, 1]. Stable across re-renders. */
function noise(seed: number): number {
  const h = Math.sin(seed * 12.9898) * 43758.5453
  return (h - Math.floor(h)) * 2 - 1
}

/**
 * Build a soft circular-gradient cloud-puff texture in a 2D canvas. The
 * radial gradient drops from opaque white at center to fully transparent
 * at the edges, so adjacent additive-blended sprites melt into each other
 * rather than reading as discrete cards.
 */
function makePuffTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return new THREE.CanvasTexture(canvas)
  }
  const cx = size / 2
  const cy = size / 2
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  // Smooth multi-stop falloff produces a softer, more diffuse cloud edge
  // than a single linear gradient.
  grad.addColorStop(0.0, 'rgba(255,255,255,1.00)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.62)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.22)')
  grad.addColorStop(0.85, 'rgba(255,255,255,0.05)')
  grad.addColorStop(1.0, 'rgba(255,255,255,0.00)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Puff {
  lng: number       // base longitude, deg
  latJitter: number // small lat offset, deg
  lngJitter: number // small lng offset, deg
  scaleW: number    // width multiplier
  scaleH: number    // height multiplier
}

/**
 * ITCZ cloud band: ~110 soft billboard sprites wrapping the equator, each
 * with a radial-gradient cloud-puff texture so additive blending makes
 * adjacent puffs melt into a continuous misty band rather than reading as
 * discrete rectangles. Per-puff lat/lng/scale jitter breaks the
 * perfectly-straight line so the band feels organic.
 *
 * Per-sprite opacity is computed from the puff's longitude proximity to the
 * subsolar longitude, scaled by the global itczBrightness(hour) envelope:
 * only the sun-facing arc of the equator shows cloud; the night side stays
 * dark.
 */
export function CloudBand() {
  const activeModule = useStore((s) => s.activeModule)
  const visible = useStore((s) => s.layers.clouds)
  const hour = useStore((s) => s.hour)
  const season = useStore((s) => s.season)

  // Texture built once on first client render.
  const puffTexture = useMemo(() => makePuffTexture(), [])

  // Per-puff descriptors with deterministic jitter so the band doesn't
  // shimmer between renders. Built once.
  const puffs = useMemo<Puff[]>(() => {
    const out: Puff[] = []
    for (let i = 0; i < PUFF_COUNT; i++) {
      out.push({
        lng: (i / PUFF_COUNT) * 360 - 180,
        latJitter: noise(i + 17.3) * 1.8,           // ±1.8° vertical
        lngJitter: noise(i + 91.7) * (360 / PUFF_COUNT) * 0.4, // ±40% of spacing
        scaleW: 0.34 + noise(i + 211.1) * 0.10,     // ~0.24–0.44 wide
        scaleH: 0.20 + noise(i + 333.3) * 0.06,     // ~0.14–0.26 tall
      })
    }
    return out
  }, [])

  const subsolarLng = useMemo(() => subsolarPoint(hour, season)[1], [hour, season])
  // ITCZ baseline latitude shifts with the subsolar point, lagged by
  // SEASONAL_ITCZ_SHIFT_FRACTION so it doesn't quite reach the tropic.
  const baseLat = subsolarLatForSeason(season) * SEASONAL_ITCZ_SHIFT_FRACTION

  // The component now mounts directly under PersistentScene's tilt frame
  // (outside the spinning earth group), so it owns its own active-module
  // guard rather than relying on a parent <Atmosphere /> check. The guards
  // come AFTER all hooks to keep React's Rules of Hooks happy.
  if (activeModule !== 'atmosphere') return null
  if (!visible) return null

  return (
    <group>
      {puffs.map((p, idx) => {
        const lng = p.lng + p.lngJitter
        const pos = latLngToVec3(baseLat + p.latJitter, lng, BAND_RADIUS)
        // Brightness is driven only by each puff's angular distance to the
        // subsolar longitude — within ±30° fully bright, fading to 0 over
        // ±60°. The previous globalBrightness multiplier zeroed out the
        // whole band for half the cycle; with the cloud band now in the
        // tilt-only frame the bright arc rotates around the equator all
        // day instead, which is what the ITCZ actually does.
        const rawDelta = Math.abs(((lng - subsolarLng + 540) % 360) - 180)
        const proximity = Math.max(0, 1 - rawDelta / 60)
        const opacity = Math.max(0, Math.min(1, proximity * 0.85))
        if (opacity < 0.01) return null
        return (
          <sprite key={idx} position={[pos.x, pos.y, pos.z]} scale={[p.scaleW, p.scaleH, 1]}>
            <spriteMaterial
              map={puffTexture}
              color="#ffffff"
              opacity={opacity}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        )
      })}
    </group>
  )
}
