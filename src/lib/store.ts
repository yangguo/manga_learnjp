import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIProvider } from './types'

interface AIProviderState {
  selectedProvider: AIProvider
  setSelectedProvider: (provider: AIProvider) => void
  initializeSmartDefault: () => Promise<void>
}

export const useAIProviderStore = create<AIProviderState>()(persist(
  (set, get) => ({
    selectedProvider: 'openai-format',
    setSelectedProvider: (provider) => set({ selectedProvider: provider }),

    initializeSmartDefault: async () => {
      try {
        const response = await fetch('/api/providers')
        if (response.ok) {
          const data = await response.json()
          const currentProvider = get().selectedProvider
          if (data.default && data.default !== currentProvider) {
            set({ selectedProvider: data.default })
          }
        }
      } catch (error) {
        console.error('Failed to fetch smart default provider:', error)
      }
    }
  }),
  {
    name: 'ai-provider-storage',
    version: 1,
    migrate: (persisted: unknown) => {
      // Strip API key / model settings that were removed in v1
      const s = persisted as Record<string, unknown>
      delete s.apiKeySettings
      delete s.modelSettings
      delete s.openaiFormatSettings
      return s
    }
  }
))
