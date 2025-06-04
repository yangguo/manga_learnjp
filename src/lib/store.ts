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
}

export const useAIProviderStore = create<AIProviderState>()(
  persist(
    (set) => ({
      selectedProvider: 'openai',
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      openaiFormatSettings: {
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4-vision-preview'
      },
      setOpenAIFormatSettings: (settings) => 
        set((state) => ({
          openaiFormatSettings: { ...state.openaiFormatSettings, ...settings }
        })),
      modelSettings: {
        openai: {
          model: 'gpt-4-vision-preview'
        },
        gemini: {
          model: 'gemini-1.5-pro'
        }
      },
      setModelSettings: (settings) =>
        set((state) => ({
          modelSettings: { ...state.modelSettings, ...settings }
        })),
      apiKeySettings: {},
      setAPIKeySettings: (settings) =>
        set((state) => ({
          apiKeySettings: { ...state.apiKeySettings, ...settings }
        })),
    }),
    {
      name: 'ai-provider-storage',
    }
  )
)
