'use client'

import { useState, useEffect } from 'react'
import { Settings, Check, Zap, Sparkles, Server, ChevronDown } from 'lucide-react'
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
    setOpenAIFormatSettings,
    modelSettings,
    setModelSettings,
    apiKeySettings,
    setAPIKeySettings,
    initializeSmartDefault
  } = useAIProviderStore()
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetch('/api/providers')
      .then(res => res.json())
      .then(data => {
        setAvailableProviders(data.providers || [])
        // Initialize smart default on first load
        initializeSmartDefault()
      })
      .catch(() => setAvailableProviders(['openai']))
  }, [initializeSmartDefault])

  const providers = [
    { id: 'openai' as AIProvider, name: 'OpenAI', icon: Zap, color: 'text-green-500' },
    { id: 'gemini' as AIProvider, name: 'Gemini', icon: Sparkles, color: 'text-blue-500' },
    { id: 'openai-format' as AIProvider, name: 'OpenAI-Compatible', icon: Server, color: 'text-purple-500' }
  ]

  // No predefined models - users must provide their own

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
          className="glass rounded-xl max-w-md w-full max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Settings className="w-4 h-4 mr-2 text-primary-500" />
              AI Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <div className="p-4 space-y-4">
              {/* Provider Selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">AI Provider</h3>
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((provider) => {
                    const Icon = provider.icon
                    const isSelected = selectedProvider === provider.id
                    const isAvailable = availableProviders.includes(provider.id)
                    
                    return (
                      <button
                        key={provider.id}
                        onClick={() => {
                          setSelectedProvider(provider.id)
                          if (provider.id === 'openai-format') {
                            setShowAdvanced(true)
                          }
                        }}
                        className={`p-3 rounded-lg border-2 transition-all text-center ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        } ${!isAvailable ? 'relative' : ''}`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-primary-500' : provider.color}`} />
                        <div className="text-xs font-medium text-gray-700">{provider.name}</div>
                        {!isAvailable && (
                          <div className="text-xs text-amber-600 mt-1">⚠ API key needed</div>
                        )}
                        {isSelected && <Check className="w-3 h-3 text-primary-500 mx-auto mt-1" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Model Configuration */}
              {selectedProvider === 'openai' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">OpenAI Configuration</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">API Key</label>
                      <input
                        type="password"
                        value={apiKeySettings.openai || ''}
                        onChange={(e) => setAPIKeySettings({ openai: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Override environment variable or configure for first-time setup
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Model</label>
                      <input
                        type="text"
                        value={modelSettings.openai.model}
                        onChange={(e) => setModelSettings({ 
                          openai: { model: e.target.value }
                        })}
                        placeholder="e.g., gpt-4o, gpt-4-turbo, gpt-4-vision-preview"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the OpenAI model name you want to use
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedProvider === 'gemini' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Gemini Configuration</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">API Key</label>
                      <input
                        type="password"
                        value={apiKeySettings.gemini || ''}
                        onChange={(e) => setAPIKeySettings({ gemini: e.target.value })}
                        placeholder="Your Gemini API key"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Override environment variable or configure for first-time setup
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Model</label>
                      <input
                        type="text"
                        value={modelSettings.gemini.model}
                        onChange={(e) => setModelSettings({ 
                          gemini: { model: e.target.value }
                        })}
                        placeholder="e.g., gemini-pro-vision, gemini-pro"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the Gemini model name you want to use
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom API Configuration */}
              {selectedProvider === 'openai-format' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">OpenAI-Compatible API</h3>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                    >
                      <ChevronDown className={`w-3 h-3 mr-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                      {showAdvanced ? 'Less' : 'More'}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">API Endpoint</label>
                      <input
                        type="url"
                        value={openaiFormatSettings.endpoint}
                        onChange={(e) => setOpenAIFormatSettings({ endpoint: e.target.value })}
                        placeholder="https://api.your-provider.com/v1"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Model Name</label>
                      <input
                        type="text"
                        value={openaiFormatSettings.model}
                        onChange={(e) => setOpenAIFormatSettings({ model: e.target.value })}
                        placeholder="gpt-4-vision-preview"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">API Key</label>
                            <input
                              type="password"
                              value={openaiFormatSettings.apiKey || ''}
                              onChange={(e) => setOpenAIFormatSettings({ apiKey: e.target.value })}
                              placeholder="sk-..."
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Leave blank if authentication not required</p>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                            <div className="font-medium mb-2">Supported Providers:</div>
                            <div className="space-y-1">
                              <div>• <strong>Ollama:</strong> http://localhost:11434/v1</div>
                              <div>• <strong>LM Studio:</strong> http://localhost:1234/v1</div>
                              <div>• <strong>Together AI:</strong> https://api.together.xyz/v1</div>
                              <div>• <strong>Anyscale:</strong> https://api.endpoints.anyscale.com/v1</div>
                              <div>• <strong>Perplexity:</strong> https://api.perplexity.ai</div>
                              <div>• <strong>Groq:</strong> https://api.groq.com/openai/v1</div>
                              <div>• Any other OpenAI-compatible API</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Status */}
              {availableProviders.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    No providers configured. Add API keys to your environment.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {selectedProvider && `Active: ${providers.find(p => p.id === selectedProvider)?.name}`}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
            >
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
