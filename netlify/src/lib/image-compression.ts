import { createImageDataURL } from './image-utils'

/**
 * Compresses a base64 image to reduce its size for API calls
 * @param base64Data - The base64 image data
 * @param maxSizeKB - Maximum size in KB (default: 500KB)
 * @returns Promise<string> - Compressed base64 image data
 */
export async function compressImageForAPI(base64Data: string, maxSizeKB: number = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Check current size
      const currentSizeKB = Math.round(base64Data.length * 3 / 4 / 1024)
      const hasBrowserAPIs = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Image !== 'undefined'
      
      if (!hasBrowserAPIs) {
        resolve(base64Data)
        return
      }
      
      // If already small enough, return as is
      if (currentSizeKB <= maxSizeKB) {
        resolve(base64Data)
        return
      }
      
      // Create image element for processing
      const img = new Image()
      img.onload = () => {
        // Calculate compression ratio
        const compressionRatio = Math.sqrt(maxSizeKB / currentSizeKB)
        const maxWidth = img.width * compressionRatio
        const maxHeight = img.height * compressionRatio
        
        // Create canvas for resizing
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = maxHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(base64Data) // Fallback to original if canvas not available
          return
        }
        
        // Draw image on canvas with new dimensions
        ctx.drawImage(img, 0, 0, maxWidth, maxHeight)
        
        // Convert back to base64 with JPEG compression
        const compressedData = canvas.toDataURL('image/jpeg', 0.7) // 70% quality
        
        // Check if compression was effective
        const compressedSizeKB = Math.round(compressedData.length * 3 / 4 / 1024)
        
        if (compressedSizeKB <= maxSizeKB || compressedSizeKB >= currentSizeKB) {
          // Success or couldn't compress further
          resolve(compressedData)
        } else {
          // Try again with lower quality if still too large
          const canvas2 = document.createElement('canvas')
          canvas2.width = maxWidth
          canvas2.height = maxHeight
          const ctx2 = canvas2.getContext('2d')
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, maxWidth, maxHeight)
            const finalCompressed = canvas2.toDataURL('image/jpeg', 0.5) // 50% quality
            resolve(finalCompressed)
          } else {
            resolve(base64Data) // Fallback
          }
        }
      }
      
      img.onerror = () => {
        console.warn('Image compression failed, using original image')
        resolve(base64Data)
      }
      
      // Set the image source
      img.src = createImageDataURL(base64Data)
      
    } catch (error) {
      console.warn('Image compression error, using original image:', error)
      resolve(base64Data)
    }
  })
}

/**
 * Checks if an image is too large for efficient processing
 * @param base64Data - The base64 image data
 * @param thresholdKB - Size threshold in KB (default: 1000KB)
 * @returns boolean - True if image is too large
 */
export function isImageTooLarge(base64Data: string, thresholdKB: number = 1000): boolean {
  const sizeKB = Math.round(base64Data.length * 3 / 4 / 1024)
  return sizeKB > thresholdKB
}
