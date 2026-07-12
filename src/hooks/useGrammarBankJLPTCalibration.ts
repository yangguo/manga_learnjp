'use client'

import { useEffect } from 'react'
import { useGrammarBankStore } from '@/lib/grammar-bank-store'

export const useGrammarBankJLPTCalibration = (): void => {
  const calibrateGrammar = useGrammarBankStore(state => state.calibrateGrammar)
  useEffect(() => {
    if (!(useGrammarBankStore.persist?.hasHydrated?.() ?? false)) return
    void calibrateGrammar()
  }, [calibrateGrammar])
}
