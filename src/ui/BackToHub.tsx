'use client'

import Link from 'next/link'
import { useStore } from '@/src/store'

export function BackToHub() {
  const setActiveModule = useStore((s) => s.setActiveModule)
  return (
    <Link
      href="/"
      onClick={() => setActiveModule('hub')}
      className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-foreground backdrop-blur hover:bg-card"
    >
      <span aria-hidden>←</span> Hub
    </Link>
  )
}
