import { beforeEach, describe, expect, it } from 'vitest'
import { create } from 'zustand'
import { createTutorSlice, type TutorSlice } from '@/src/tutor/tutorSlice'

function makeStore() {
  return create<TutorSlice>()((set, get, api) => createTutorSlice(set, get, api))
}

describe('tutorSlice', () => {
  let store: ReturnType<typeof makeStore>
  beforeEach(() => {
    store = makeStore()
  })

  it('starts empty and not streaming', () => {
    expect(store.getState().tutor.messages).toEqual([])
    expect(store.getState().tutor.streaming).toBe(false)
  })

  it('adds messages', () => {
    store.getState().addTutorMessage({ role: 'user', content: 'hi', ts: 1 })
    expect(store.getState().tutor.messages).toHaveLength(1)
    expect(store.getState().tutor.messages[0]?.content).toBe('hi')
  })

  it('appends chunks to the last message', () => {
    store.getState().addTutorMessage({ role: 'assistant', content: '', ts: 1 })
    store.getState().appendToLast('Hel')
    store.getState().appendToLast('lo')
    expect(store.getState().tutor.messages[0]?.content).toBe('Hello')
  })

  it('appendToLast is a no-op with no messages', () => {
    store.getState().appendToLast('x')
    expect(store.getState().tutor.messages).toEqual([])
  })

  it('sets streaming and clears messages', () => {
    store.getState().setStreaming(true)
    expect(store.getState().tutor.streaming).toBe(true)
    store.getState().addTutorMessage({ role: 'user', content: 'q', ts: 1 })
    store.getState().clearTutor()
    expect(store.getState().tutor.messages).toEqual([])
  })
})
