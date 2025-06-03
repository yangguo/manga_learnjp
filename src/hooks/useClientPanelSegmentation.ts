/**
 * React hook for client-side panel segmentation
 * Provides easy integration with React components
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { ClientPanelSegmentationService } from '@/lib/client-panel-segmentation'
import type { PanelSegmentationResult } from '@/lib/types'

interface UseClientPanelSegmentationReturn {
  segmentPanels: (imageBase64: string) => Promise<PanelSegmentationResult>
  isLoading: boolean
  error: string | null
  isAvailable: boolean
  progress: string
}

export function useClientPanelSegmentation(): UseClientPanelSegmentationReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const serviceRef = useRef<ClientPanelSegmentationService | null>(null)

  // Initialize service on first use
  const getService = useCallback(async () => {
    if (!serviceRef.current && typeof window !== 'undefined') {
      serviceRef.current = new ClientPanelSegmentationService()
    }
    return serviceRef.current
  }, [])

  const segmentPanels = useCallback(async (imageBase64: string): Promise<PanelSegmentationResult> => {
    setIsLoading(true)
    setError(null)
    setProgress('Initializing OpenCV.js...')

    try {
      const service = await getService()
      
      if (!service || !service.isAvailable()) {
        throw new Error('Client-side panel segmentation is not available in this environment')
      }

      setProgress('Processing image...')
      const result = await service.segmentPanels(imageBase64)
      
      setProgress('Segmentation complete!')
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
      setTimeout(() => setProgress(''), 2000) // Clear progress after 2 seconds
    }
  }, [getService])

  // Check availability only on client side to prevent hydration mismatch
  useEffect(() => {
    setIsAvailable(typeof window !== 'undefined')
  }, [])

  return {
    segmentPanels,
    isLoading,
    error,
    isAvailable,
    progress
  }
}