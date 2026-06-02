'use client'

import { useStore } from '@/src/store'
import { Cells } from './Cells'
import { CloudBand } from './CloudBand'
import { Heatmap } from './Heatmap'
import { HoverInspector } from './HoverInspector'
import { Sun } from './Sun'

export function Atmosphere() {
  const activeModule = useStore((s) => s.activeModule)
  if (activeModule !== 'atmosphere') return null

  return (
    <group>
      <Sun />
      <Heatmap />
      <Cells />
      <CloudBand />
      <HoverInspector />
    </group>
  )
}
