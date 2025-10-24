/**
 * Image utility functions for handling different image formats
 */

/**
 * Detects the image format from a base64 string by examining its header
 */
export function detectImageFormat(base64Data: string): string {
  // Remove any data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '')
  
  // Get the first few bytes to check the magic numbers
  const bytes = atob(cleanBase64.substring(0, 50))
  
  // Check for PNG signature (89 50 4E 47)
  if (bytes.charCodeAt(0) === 0x89 && bytes.charCodeAt(1) === 0x50 && 
      bytes.charCodeAt(2) === 0x4E && bytes.charCodeAt(3) === 0x47) {
    return 'png'
  }
  
  // Check for JPEG signature (FF D8 FF)
  if (bytes.charCodeAt(0) === 0xFF && bytes.charCodeAt(1) === 0xD8 && bytes.charCodeAt(2) === 0xFF) {
    return 'jpeg'
  }
  
  // Check for WebP signature (RIFF ... WEBP)
  if (bytes.substring(0, 4) === 'RIFF' && bytes.substring(8, 12) === 'WEBP') {
    return 'webp'
  }
  
  // Check for GIF signature (GIF8)
  if (bytes.substring(0, 4) === 'GIF8') {
    return 'gif'
  }
  
  // Default to jpeg if we can't detect
  return 'jpeg'
}

/**
 * Gets the MIME type for an image format
 */
export function getImageMimeType(base64Data: string, format?: string): string {
  const detectedFormat = format || detectImageFormat(base64Data)
  return `image/${detectedFormat}`
}

/**
 * Creates a proper data URL with the correct MIME type
 */
export function createImageDataURL(base64Data: string, format?: string): string {
  const cleanBase64 = base64Data.replace(/^data:image\/[^;]+;base64,/, '')
  const detectedFormat = format || detectImageFormat(cleanBase64)
  return `data:image/${detectedFormat};base64,${cleanBase64}`
}

/**
 * Extracts just the base64 data from a data URL
 */
export function extractBase64FromDataURL(dataURL: string): string {
  return dataURL.replace(/^data:image\/[^;]+;base64,/, '')
}
