'use client'

import { useEffect } from 'react'
import { useWordBankStore } from '@/lib/word-bank-store'

export const useWordBankJLPTCalibration = (): void => {
  const calibrateWords = useWordBankStore(state => state.calibrateWords)
  useEffect(() => {
    if (!(useWordBankStore.persist?.hasHydrated?.() ?? false)) return
    void calibrateWords()
  }, [calibrateWords])
}
