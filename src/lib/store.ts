import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIProvider, OpenAIFormatSettings } from './types'

interface AIProviderState {
  selectedProvider: AIProvider
  setSelectedProvider: (provider: AIProvider) => void
  openaiFormatSettings: OpenAIFormatSettings
  setOpenAIFormatSettings: (settings: Partial<OpenAIFormatSettings>) => void
}

export const useAIProviderStore = create<AIProviderState>()(
  persist(
    (set) => ({
      selectedProvider: 'openai',
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      openaiFormatSettings: {
        endpoint: 'http://localhost:11434/v1',
        model: 'llava:latest'
      },
      setOpenAIFormatSettings: (settings) => 
        set((state) => ({
          openaiFormatSettings: { ...state.openaiFormatSettings, ...settings }
        })),
    }),
    {
      name: 'ai-provider-storage',
    }
  )
)
