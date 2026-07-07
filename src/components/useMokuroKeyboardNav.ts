'use client'

import { useEffect, useRef } from 'react'
import {
  computeNextBlockIndex,
  resolveAction,
  shouldHandleKey,
  type KeyboardNavState
} from '@/lib/mokuro-keyboard-nav'

export interface MokuroKeyboardNavHandlers {
  selectBlock: (blockIndex: number) => void
  analyzeSelected: () => void
  goToNextPage: () => void
  goToPreviousPage: () => void
  clearSelection: () => void
  scrollAnalysisUp: () => void
  scrollAnalysisDown: () => void
}

export interface UseMokuroKeyboardNavArgs {
  handlers: MokuroKeyboardNavHandlers
  state: KeyboardNavState
}

const getTargetContext = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return null
  return {
    tagName: target.tagName,
    isContentEditable: target.isContentEditable
  }
}

// Global keyboard navigation for the Mokuro reader. Handlers and state are
// mirrored into refs so the window listener subscribes once and always reads
// the latest values without re-binding on every render.
export const useMokuroKeyboardNav = ({ handlers, state }: UseMokuroKeyboardNavArgs) => {
  const pageContainerRef = useRef<HTMLDivElement | null>(null)
  const handlersRef = useRef(handlers)
  const stateRef = useRef(state)

  useEffect(() => {
    handlersRef.current = handlers
    stateRef.current = state
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current.enabled) return
      if (!shouldHandleKey(getTargetContext(event.target))) return

      const action = resolveAction(event.key, current)
      if (!action) return

      event.preventDefault()

      const h = handlersRef.current
      switch (action) {
        case 'prev-block': {
          const next = computeNextBlockIndex(current.blockIndices, current.selectedIndex, 'prev')
          if (next !== null) h.selectBlock(next)
          break
        }
        case 'next-block': {
          const next = computeNextBlockIndex(current.blockIndices, current.selectedIndex, 'next')
          if (next !== null) h.selectBlock(next)
          break
        }
        case 'next-page':
          h.goToNextPage()
          break
        case 'prev-page':
          h.goToPreviousPage()
          break
        case 'analyze':
          h.analyzeSelected()
          break
        case 'clear':
          h.clearSelection()
          break
        case 'home':
          if (current.blockIndices.length > 0) h.selectBlock(current.blockIndices[0])
          break
        case 'end':
          if (current.blockIndices.length > 0) {
            h.selectBlock(current.blockIndices[current.blockIndices.length - 1])
          }
          break
        case 'scroll-analysis-up':
          h.scrollAnalysisUp()
          break
        case 'scroll-analysis-down':
          h.scrollAnalysisDown()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Keep the highlighted text box on the manga page in view as keyboard
  // navigation moves the selection. Scrolling follows the page image, not the
  // OCR list, so the reader's eyes stay on the manga.
  useEffect(() => {
    const selectedIndex = state.selectedIndex
    if (selectedIndex === null) return
    const container = pageContainerRef.current
    if (!container) return
    const el = container.querySelector(`[data-block-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedIndex])

  return pageContainerRef
}
