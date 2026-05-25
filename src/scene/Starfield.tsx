'use client'

import { Stars } from '@react-three/drei'

/**
 * Star background. drei's <Stars> generates a procedural starfield in a
 * Points cloud with subtle parallax. Cheap on every tier; no texture
 * needed. (The supplied `stars.jpg` is reserved for a future skybox
 * sphere on desktop-ultra; left out for v1 to keep the bundle lean.)
 */
export function Starfield() {
  return <Stars radius={300} depth={60} count={6000} factor={4} saturation={0} fade speed={0.25} />
}
