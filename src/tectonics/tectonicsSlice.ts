import type { StateCreator } from 'zustand'
import { ERAS, type Era } from './eras'

export interface TectonicsSlice {
  currentEraId: Era['id']
  targetEraId: Era['id'] | null
  tweenStartedAt: number | null
  playing: boolean

  setTargetEra: (id: Era['id']) => void
  finishTween: () => void
  startPlaythrough: () => void
  stopPlaythrough: () => void
}

function nextEraId(currentId: Era['id']): Era['id'] {
  const idx = ERAS.findIndex((e) => e.id === currentId)
  const nextIdx = (idx + 1) % ERAS.length
  const next = ERAS[nextIdx]
  return next ? next.id : (ERAS[0]?.id ?? 'pangaea')
}

export const createTectonicsSlice: StateCreator<TectonicsSlice> = (set, get) => ({
  currentEraId: 'present',
  targetEraId: null,
  tweenStartedAt: null,
  playing: false,

  setTargetEra: (id) => {
    const state = get()
    if (id === state.currentEraId && !state.playing) return
    set({ targetEraId: id, tweenStartedAt: performance.now() })
  },

  finishTween: () => {
    const state = get()
    const committed = state.targetEraId ?? state.currentEraId
    set({
      currentEraId: committed,
      targetEraId: null,
      tweenStartedAt: null,
    })
    if (state.playing) {
      // Schedule the next era. Reach back into setTargetEra via get() so the
      // tween-start guard still fires.
      get().setTargetEra(nextEraId(committed))
    }
  },

  startPlaythrough: () => {
    const state = get()
    set({ playing: true })
    if (state.targetEraId === null) {
      get().setTargetEra(nextEraId(state.currentEraId))
    }
  },

  stopPlaythrough: () => {
    set({ playing: false })
  },
})
