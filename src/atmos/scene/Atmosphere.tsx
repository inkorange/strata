'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { Heatmap } from './Heatmap'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
      <Cells />
    </group>
  )
}
