'use client'

import { useState } from 'react'
import { BookOpen, Github, Heart, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import SettingsPanel from './SettingsPanel'

export default function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <>
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass border-b border-white/20 sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Manga Learn JP</h1>
                <p className="text-sm text-gray-600">漫画で日本語を学ぼう</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                title="AI Provider Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </motion.button>

              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="https://github.com"
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-5 h-5 text-gray-600" />
              </motion.a>
              
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <span>Made with</span>
                <Heart className="w-4 h-4 text-red-500 fill-current" />
                <span>for learners</span>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  )
}
