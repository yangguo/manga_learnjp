'use client'

import { BookOpen, Github, Heart, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useWordBankStore } from '@/lib/word-bank-store'
import { useHydrated } from '@/hooks/useHydrated'
import { useWordBankJLPTCalibration } from '@/hooks/useWordBankJLPTCalibration'

export default function Header() {
  useWordBankJLPTCalibration()
  const wordCount = useWordBankStore(state => state.words.length)
  const hydrated = useHydrated()
  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass border-b border-white/20"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Manga Learn JP</h1>
              <p className="text-sm text-gray-400">漫画で日本語を学ぼう</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              href="/sources"
              aria-label="JLPT data sources"
              title="JLPT data sources"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Info className="h-5 w-5" />
            </Link>
            <Link
              href="/words"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/10"
            >
              <BookOpen className="w-4 h-4" />
              <span>生词本</span>
              {hydrated && wordCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300">
                  {wordCount}
                </span>
              )}
            </Link>

            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="https://github.com"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5 text-gray-400" />
            </motion.a>
            
            <div className="flex items-center space-x-1 text-sm text-gray-400">
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
