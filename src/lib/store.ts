import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIProvider, OpenAIFormatSettings, ModelSettings, APIKeySettings } from './types'

interface AIProviderState {
  selectedProvider: AIProvider
  setSelectedProvider: (provider: AIProvider) => void
  openaiFormatSettings: OpenAIFormatSettings
  setOpenAIFormatSettings: (settings: Partial<OpenAIFormatSettings>) => void
  modelSettings: ModelSettings
  setModelSettings: (settings: Partial<ModelSettings>) => void
  apiKeySettings: APIKeySettings
  setAPIKeySettings: (settings: Partial<APIKeySettings>) => void
  initializeSmartDefault: () => Promise<void>
}

export const useAIProviderStore = create<AIProviderState>()(persist(
  (set, get) => ({
    selectedProvider: 'openai',
    setSelectedProvider: (provider) => set({ selectedProvider: provider }),
    
    openaiFormatSettings: {
      endpoint: '',
      model: '',
      apiKey: ''
    },
    setOpenAIFormatSettings: (settings) => set((state) => ({
      openaiFormatSettings: { ...state.openaiFormatSettings, ...settings }
    })),
    
    modelSettings: {
      openai: { model: '' },
      gemini: { model: '' }
    },
    setModelSettings: (settings) => set((state) => ({
      modelSettings: { ...state.modelSettings, ...settings }
    })),
    
    apiKeySettings: {
      openai: '',
      gemini: ''
    },
    setAPIKeySettings: (settings) => set((state) => ({
      apiKeySettings: { ...state.apiKeySettings, ...settings }
    })),
    
    initializeSmartDefault: async () => {
      try {
        const response = await fetch('/api/providers')
        if (response.ok) {
          const data = await response.json()
          const currentProvider = get().selectedProvider
          
          // Only update if current provider is not available or is the default 'openai'
          // and the smart default is different
          if (data.default && data.default !== currentProvider && 
              (!data.providers.includes(currentProvider) || currentProvider === 'openai')) {
            console.log(`🎯 Smart default selected: ${data.default} (was: ${currentProvider})`)
            set({ selectedProvider: data.default })
          }
        }
      } catch (error) {
        console.error('Failed to fetch smart default provider:', error)
      }
    }
  }),
  {
    name: 'ai-provider-storage'
  }
))
