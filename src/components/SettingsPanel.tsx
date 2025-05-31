'use client'

import { useState, useEffect } from 'react'
import { Settings, Check, Zap, Sparkles, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAIProviderStore } from '@/lib/store'
import type { AIProvider } from '@/lib/types'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { 
    selectedProvider, 
    setSelectedProvider, 
    openaiFormatSettings, 
    setOpenAIFormatSettings 
  } = useAIProviderStore()
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([])
  const [showOpenAIFormatConfig, setShowOpenAIFormatConfig] = useState(false)

  useEffect(() => {
    // Check which providers are available
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => setAvailableProviders(data.providers || []))
      .catch(() => setAvailableProviders(['openai'])) // fallback
  }, [])

  const providers = [
    {
      id: 'openai' as AIProvider,
      name: 'OpenAI GPT-4',
      description: 'Advanced language model with excellent Japanese analysis',
      icon: Zap,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'gemini' as AIProvider,
      name: 'Google Gemini',
      description: 'Google\'s latest AI with strong multilingual capabilities',
      icon: Sparkles,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'openai-format' as AIProvider,
      name: 'OpenAI-Format API',
      description: 'Custom endpoint (Ollama, LM Studio, etc.) with OpenAI-compatible API',
      icon: Server,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass rounded-xl p-6 max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-primary-500" />
              AI Provider Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">
              Choose your preferred AI provider for text analysis. Both providers offer excellent Japanese language understanding.
            </p>

            {providers.map((provider) => {
              const isAvailable = availableProviders.includes(provider.id)
              const isSelected = selectedProvider === provider.id
              const Icon = provider.icon

              return (
                <motion.div
                  key={provider.id}
                  whileHover={{ scale: isAvailable ? 1.02 : 1 }}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                    ${isSelected 
                      ? `${provider.borderColor} ${provider.bgColor}` 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                    ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => {
                    if (isAvailable || provider.id === 'openai-format') {
                      setSelectedProvider(provider.id)
                      if (provider.id === 'openai-format') {
                        setShowOpenAIFormatConfig(true)
                      } else {
                        setShowOpenAIFormatConfig(false)
                      }
                    }
                  }}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${provider.bgColor} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${provider.color}`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-800">
                          {provider.name}
                          {!isAvailable && (
                            <span className="text-xs text-red-500 ml-2">(Not configured)</span>
                          )}
                        </h3>
                        {isSelected && isAvailable && (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{provider.description}</p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* OpenAI-Format Configuration */}
          <AnimatePresence>
            {selectedProvider === 'openai-format' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200"
              >
                <h3 className="font-medium text-gray-800 mb-4">OpenAI-Format API Configuration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={openaiFormatSettings.endpoint}
                      onChange={(e) => setOpenAIFormatSettings({ endpoint: e.target.value })}
                      placeholder="http://localhost:11434/v1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Full API endpoint URL (e.g., Ollama: http://localhost:11434/v1)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model Name
                    </label>
                    <input
                      type="text"
                      value={openaiFormatSettings.model}
                      onChange={(e) => setOpenAIFormatSettings({ model: e.target.value })}
                      placeholder="llava:latest"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Model name as expected by your API (e.g., llava:latest, gpt-4-vision-preview)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key (Optional)
                    </label>
                    <input
                      type="password"
                      value={openaiFormatSettings.apiKey || ''}
                      onChange={(e) => setOpenAIFormatSettings({ apiKey: e.target.value })}
                      placeholder="Leave blank if not required"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only required if your API endpoint requires authentication
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {availableProviders.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                No AI providers are configured. Please check your environment variables and ensure you have valid API keys.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="button-primary"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
