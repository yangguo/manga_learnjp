'use client'

import { useState } from 'react'
import { BookOpen, Zap, Download, Star } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DemoSection() {
  const [activeDemo, setActiveDemo] = useState(0)

  const demoSteps = [
    {
      title: "Upload Your Manga",
      description: "Simply drag and drop or click to upload any manga page",
      icon: Download,
      color: "text-blue-500"
    },
    {
      title: "OCR Text Extraction", 
      description: "Our advanced OCR technology extracts Japanese text accurately",
      icon: BookOpen,
      color: "text-green-500"
    },
    {
      title: "AI-Powered Analysis",
      description: "Get detailed explanations of vocabulary and grammar patterns",
      icon: Zap,
      color: "text-purple-500"
    },
    {
      title: "Learn Effectively",
      description: "Master Japanese through real manga content with context",
      icon: Star,
      color: "text-yellow-500"
    }
  ]

  return (
    <div className="mt-16 mb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-gray-800 mb-4">How It Works</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Transform your manga reading into an interactive Japanese learning experience
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {demoSteps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
            className={`card hover:scale-105 cursor-pointer transition-all duration-300 ${
              activeDemo === index ? 'ring-2 ring-primary-400' : ''
            }`}
            onClick={() => setActiveDemo(index)}
          >
            <div className="text-center">
              <div className={`p-4 rounded-full bg-gray-50 w-16 h-16 flex items-center justify-center mx-auto mb-4`}>
                <step.icon className={`w-8 h-8 ${step.color}`} />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.2 }}
        className="mt-12 text-center"
      >
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Ready to start your Japanese learning journey?
          </h3>
          <p className="text-gray-600 mb-6">
            Upload your first manga page above and discover how easy it is to learn Japanese through the stories you love!
          </p>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <span>✨ Free to use</span>
            <span>•</span>
            <span>🔒 Privacy focused</span>
            <span>•</span>
            <span>🚀 Instant results</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
