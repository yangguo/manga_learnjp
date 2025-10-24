// This hook is deprecated in favor of useClientPanelSegmentation
// All panel segmentation now uses client-side OpenCV.js implementation

import { useClientPanelSegmentation } from './useClientPanelSegmentation'

// Re-export the client-side hook for backward compatibility
export const usePanelSegmentation = useClientPanelSegmentation
export default useClientPanelSegmentation