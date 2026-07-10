'use client'

import { useSyncExternalStore } from 'react'

// Returns false on the server and during the first client render, then true
// after mount. Gate persisted-state rendering behind this so the first client
// render matches the server (empty), avoiding hydration mismatches with
// zustand persist stores that rehydrate from localStorage before hydration.
const emptySubscribe = () => () => {}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false // server snapshot (also used for the first hydrated render)
  )
}
