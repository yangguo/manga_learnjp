'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import WordBank from '@/components/WordBank'

interface WordBankDrawerProps {
  open: boolean
  onClose: () => void
  onStartReview?: () => void
}

export default function WordBankDrawer({ open, onClose, onStartReview }: WordBankDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-bank-drawer-title"
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-gray-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="word-bank-drawer-title" className="text-sm font-medium text-gray-200">收藏</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭生词本"
            title="关闭生词本"
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WordBank onStartReview={onStartReview} />
        </div>
      </aside>
    </div>
  )
}
