'use client'

import { useEffect, useRef } from 'react'
import ReviewSession from '@/components/ReviewSession'

interface ReaderReviewOverlayProps {
  open: boolean
  onClose: () => void
}

export default function ReaderReviewOverlay({ open, onClose }: ReaderReviewOverlayProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-review-title"
      tabIndex={-1}
      className="fixed inset-0 z-[70] overflow-y-auto bg-gray-950 outline-none"
    >
      <h1 id="reader-review-title" className="sr-only">词汇复习</h1>
      <div className="mx-auto min-h-screen w-full px-4 sm:px-6">
        <ReviewSession onExit={onClose} exitLabel="返回阅读" />
      </div>
    </div>
  )
}
