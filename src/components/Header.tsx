'use client'

import { BookOpen, Brain, Github, Heart, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect } from 'react'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useHydrated } from '@/hooks/useHydrated'
import { useWordBankJLPTCalibration } from '@/hooks/useWordBankJLPTCalibration'
import { getReviewSummary } from '@/lib/srs'

interface HeaderProps {
  onOpenWordBank?: () => void
}

export default function Header({ onOpenWordBank }: HeaderProps) {
  useWordBankJLPTCalibration()
  const words = useWordBankStore(state => state.words)
  const reviewCards = useWordBankStore(state => state.reviewCards)
  const hydrated = useHydrated()
  const wordCount = words.length
  const reviewCount = hydrated ? getReviewSummary(words, reviewCards, new Date()).total : 0

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'word-bank-storage') void useWordBankStore.persist.rehydrate()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass border-b border-white/20"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="truncate text-base font-bold text-white sm:text-xl">Manga Learn JP</h1>
              <p className="hidden text-sm text-gray-400 sm:block">漫画で日本語を学ぼう</p>
            </div>
          </div>
          
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Link
              href="/sources"
              aria-label="JLPT data sources"
              title="JLPT data sources"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Info className="h-5 w-5" />
            </Link>
            <Link
              href="/review"
              aria-label="开始复习"
              title="开始复习"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/10 sm:px-3"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">复习</span>
              {hydrated && reviewCount > 0 ? (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                  {reviewCount}
                </span>
              ) : null}
            </Link>
            {onOpenWordBank ? (
              <button
                type="button"
                onClick={onOpenWordBank}
                aria-label="打开生词本"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/10 sm:px-3"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">生词本</span>
                {hydrated && wordCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300">
                    {wordCount}
                  </span>
                )}
              </button>
            ) : (
              <Link
                href="/words"
                aria-label="打开生词本"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/10 sm:px-3"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">生词本</span>
                {hydrated && wordCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300">
                    {wordCount}
                  </span>
                )}
              </Link>
            )}

            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="https://github.com"
              aria-label="GitHub"
              title="GitHub"
              className="hidden rounded-lg p-2 transition-colors hover:bg-white/10 lg:block"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5 text-gray-400" />
            </motion.a>
            
            <div className="hidden items-center space-x-1 text-sm text-gray-400 xl:flex">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-red-400 fill-current" />
              <span>for learners</span>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
