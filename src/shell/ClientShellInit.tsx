'use client'

import { useEffect } from 'react'
import { useStore } from '@/src/store'
import type { ModuleFrameData } from './ModuleFrame'

interface Props {
  module: ModuleFrameData
}

export function ClientShellInit({ module }: Props) {
  const setActiveModule = useStore((s) => s.setActiveModule)
  useEffect(() => {
    setActiveModule(module.id)
    return () => setActiveModule('hub')
  }, [module.id, setActiveModule])
  return null
}
