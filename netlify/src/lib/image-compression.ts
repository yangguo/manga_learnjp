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
      
      // If already small enough, return as is
      if (currentSizeKB <= maxSizeKB) {
        console.log(`📏 Image size ${currentSizeKB}KB is within limit ${maxSizeKB}KB, no compression needed`)
        resolve(base64Data)
        return
      }
      
      console.log(`🗜️ Compressing image from ${currentSizeKB}KB to target ${maxSizeKB}KB...`)
      
      // Create image element for processing
      const img = new Image()
      img.onload = () => {
        // Calculate compression ratio
        const compressionRatio = Math.sqrt(maxSizeKB / currentSizeKB)
        const maxWidth = Math.floor(img.width * compressionRatio)
        const maxHeight = Math.floor(img.height * compressionRatio)
        
        console.log(`📐 Resizing from ${img.width}x${img.height} to ${maxWidth}x${maxHeight}`)
        
        // Create canvas for resizing
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = maxHeight
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn('⚠️ Canvas context not available, using original image')
          resolve(base64Data) // Fallback to original if canvas not available
          return
        }
        
        // Draw image on canvas with new dimensions
        ctx.drawImage(img, 0, 0, maxWidth, maxHeight)
        
        // Convert back to base64 with JPEG compression
        const compressedData = canvas.toDataURL('image/jpeg', 0.7) // 70% quality
        
        // Check if compression was effective
        const compressedSizeKB = Math.round(compressedData.length * 3 / 4 / 1024)
        
        console.log(`✅ Compressed image to ${compressedSizeKB}KB`)
        
        if (compressedSizeKB <= maxSizeKB || compressedSizeKB >= currentSizeKB) {
          // Success or couldn't compress further
          resolve(compressedData)
        } else {
          // Try again with lower quality if still too large
          console.log(`🔄 Still too large, trying with lower quality...`)
          const canvas2 = document.createElement('canvas')
          canvas2.width = maxWidth
          canvas2.height = maxHeight
          const ctx2 = canvas2.getContext('2d')
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, maxWidth, maxHeight)
            const finalCompressed = canvas2.toDataURL('image/jpeg', 0.5) // 50% quality
            const finalSizeKB = Math.round(finalCompressed.length * 3 / 4 / 1024)
            console.log(`✅ Final compressed image to ${finalSizeKB}KB`)
            resolve(finalCompressed)
          } else {
            console.warn('⚠️ Second compression attempt failed, using first attempt')
            resolve(compressedData) // Fallback
          }
        }
      }
      
      img.onerror = () => {
        console.warn('⚠️ Image compression failed, using original image')
        resolve(base64Data)
      }
      
      // Set the image source
      img.src = createImageDataURL(base64Data)
      
    } catch (error) {
      console.warn('⚠️ Image compression error, using original image:', error)
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
