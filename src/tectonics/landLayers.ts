import { ERAS_BY_ID, type Era } from './eras'

export interface LandLayer {
  /** Stable key for React. */
  key: string
  polygons: Era['land']
  opacity: number
}

/**
 * Land render layers for the current transition. At rest (no target) returns a
 * single full-opacity layer of the current era. During a transition returns the
 * source era fading out and the target era fading in — paleoshorelines are
 * independent per era, so we crossfade rather than vertex-morph.
 */
export function landLayers(
  currentEraId: Era['id'],
  targetEraId: Era['id'] | null,
  eased: number,
): LandLayer[] {
  const current = ERAS_BY_ID[currentEraId]
  if (targetEraId === null || targetEraId === currentEraId) {
    return [{ key: currentEraId, polygons: current.land, opacity: 1 }]
  }
  const target = ERAS_BY_ID[targetEraId]
  return [
    { key: currentEraId, polygons: current.land, opacity: 1 - eased },
    { key: targetEraId, polygons: target.land, opacity: eased },
  ]
}
