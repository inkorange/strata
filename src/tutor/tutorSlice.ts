import type { StateCreator } from 'zustand'

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface TutorSlice {
  tutor: {
    messages: TutorMessage[]
    /** True while a streaming response is in flight; disables the composer. */
    streaming: boolean
  }
  addTutorMessage: (m: TutorMessage) => void
  /** Append a streamed chunk to the most recent message, grown in place. */
  appendToLast: (chunk: string) => void
  setStreaming: (v: boolean) => void
  clearTutor: () => void
}

export const createTutorSlice: StateCreator<TutorSlice> = (set) => ({
  tutor: { messages: [], streaming: false },

  addTutorMessage: (m) =>
    set((s) => ({ tutor: { ...s.tutor, messages: [...s.tutor.messages, m] } })),

  appendToLast: (chunk) =>
    set((s) => {
      const msgs = s.tutor.messages
      if (msgs.length === 0) return {}
      const last = msgs[msgs.length - 1] as TutorMessage
      const updated = { ...last, content: last.content + chunk }
      return { tutor: { ...s.tutor, messages: [...msgs.slice(0, -1), updated] } }
    }),

  setStreaming: (v) => set((s) => ({ tutor: { ...s.tutor, streaming: v } })),

  clearTutor: () => set((s) => ({ tutor: { ...s.tutor, messages: [] } })),
})
