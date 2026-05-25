'use client'

interface StubModuleBodyProps {
  moduleLabel: string
  accent: string
}

export function StubModuleBody({ moduleLabel, accent }: StubModuleBodyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-1 w-24 rounded" style={{ backgroundColor: accent }} aria-hidden />
      <h2 className="text-xl font-medium text-foreground">{moduleLabel}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Module under construction. The shell, camera dolly, tier toggle, and tutor panel around it
        are live — module simulation arrives in the next phase.
      </p>
    </div>
  )
}
