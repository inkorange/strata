import { create } from 'zustand'
import { createTectonicsSlice, type TectonicsSlice } from '@/src/tectonics/tectonicsSlice'
import { createShellSlice, type ShellSlice } from './shellSlice'

type Store = ShellSlice &
  TectonicsSlice & {
    /** Test-only helper: flush the persist debounce synchronously. */
    __flushPersist?: () => void
  }

const STORAGE_KEY = 'strata:shell'

function readPersistedShell(): Partial<ShellSlice> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<ShellSlice>
    // Only rehydrate fields we intentionally persist; ignore stale shape.
    const out: Partial<ShellSlice> = {}
    if (parsed.tierOverride !== undefined) out.tierOverride = parsed.tierOverride
    if (parsed.activeModule !== undefined) out.activeModule = parsed.activeModule
    if (parsed.highContrast !== undefined) out.highContrast = parsed.highContrast
    return out
  } catch {
    return {}
  }
}

function persistShell(state: ShellSlice) {
  if (typeof localStorage === 'undefined') return
  const payload = {
    tierOverride: state.tierOverride,
    activeModule: state.activeModule,
    highContrast: state.highContrast,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export const useStore = create<Store>()((set, get, api) => {
  const shellSlicePart = createShellSlice(set, get, api)
  const tectonicsSlicePart = createTectonicsSlice(set, get, api)
  const rehydrated = readPersistedShell()

  return {
    ...shellSlicePart,
    ...tectonicsSlicePart,
    ...rehydrated,
    __flushPersist: () => persistShell(get() as ShellSlice),
  }
})

// Synchronous persistence: subscribe once at module load.
useStore.subscribe((state) => {
  persistShell(state as ShellSlice)
})
