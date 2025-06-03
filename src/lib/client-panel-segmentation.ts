/**
 * Client-Side Panel Segmentation Service
 * Implements comic panel segmentation using OpenCV.js
 * Based on the Python implementation but runs entirely in the browser
 */

import type { PanelSegmentationResult, SegmentedPanel } from './types'

export class ClientPanelSegmentationService {
  private cv: any = null
  private isInitialized = false

  constructor() {
    // Don't initialize OpenCV in constructor to avoid SSR issues
    // It will be initialized lazily when needed
  }

  private async initializeOpenCV(): Promise<void> {
    try {
      // Check if OpenCV.js is already loaded
      if (typeof window !== 'undefined' && (window as any).cv) {
        this.cv = (window as any).cv
        this.isInitialized = true
        console.log('✅ OpenCV.js already loaded')
        return
      }

      // Load OpenCV.js dynamically
      await this.loadOpenCVScript()
      
      // Wait for OpenCV to be ready
      await new Promise<void>((resolve, reject) => {
        const checkCV = () => {
          if (typeof window !== 'undefined' && (window as any).cv && (window as any).cv.Mat) {
            this.cv = (window as any).cv
            this.isInitialized = true
            console.log('✅ OpenCV.js initialized successfully')
            resolve()
          } else {
            setTimeout(checkCV, 100)
          }
        }
        checkCV()
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (!this.isInitialized) {
            reject(new Error('OpenCV.js failed to load within 30 seconds'))
          }
        }, 30000)
      })
    } catch (error) {
      console.error('❌ Failed to initialize OpenCV.js:', error)
      throw error
    }
  }

  private loadOpenCVScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('OpenCV.js can only be loaded in browser environment'))
        return
      }

      const script = document.createElement('script')
      script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load OpenCV.js script'))
      document.head.appendChild(script)
    })
  }

  async segmentPanels(imageBase64: string): Promise<PanelSegmentationResult> {
    if (!this.isInitialized) {
      await this.initializeOpenCV()
    }

    try {
      console.log('🔍 Starting client-side panel segmentation...')
      
      // Convert base64 to image
      const img = await this.base64ToImage(imageBase64)
      const canvas = this.imageToCanvas(img)
      
      // Convert to OpenCV Mat
      const src = this.cv.imread(canvas)
      const originalHeight = src.rows
      const originalWidth = src.cols
      
      console.log(`📊 Image dimensions: ${originalWidth}x${originalHeight}`)
      
      // Remove black borders
      const { croppedMat, cropInfo } = this.removeBlackBorders(src)
      
      // Try contour-based detection first
      const contourPanels = this.detectPanelsContourBased(croppedMat)
      
      let panels: SegmentedPanel[] = []
      
      if (contourPanels.length > 1) {
        console.log(`✅ Found ${contourPanels.length} panels using contour detection`)
        panels = this.createPanelData(contourPanels, src, cropInfo, originalWidth, originalHeight)
      } else {
        console.log('🔄 Falling back to line-based detection')
        const linePanels = this.detectPanelsLineBased(croppedMat)
        panels = this.createPanelData(linePanels, src, cropInfo, originalWidth, originalHeight)
      }
      
      // Sort panels for manga reading order (right-to-left, top-to-bottom)
      panels.sort((a, b) => {
        const yDiff = a.boundingBox.y - b.boundingBox.y
        if (Math.abs(yDiff) < 50) { // Same row
          return b.boundingBox.x - a.boundingBox.x // Right to left
        }
        return yDiff // Top to bottom
      })
      
      // Update reading order
      const readingOrder = panels.map((_, index) => index + 1)
      
      // Clean up
      src.delete()
      croppedMat.delete()
      
      const result: PanelSegmentationResult = {
        panels,
        totalPanels: panels.length,
        originalImage: {
          width: originalWidth,
          height: originalHeight
        },
        readingOrder
      }
      
      console.log('✅ Client-side panel segmentation complete:', {
        totalPanels: result.totalPanels,
        readingOrder: result.readingOrder
      })
      
      return result
      
    } catch (error) {
      console.error('❌ Client-side panel segmentation failed:', error)
      throw new Error(`Panel segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private removeBlackBorders(src: any): { croppedMat: any, cropInfo: { x: number, y: number, width: number, height: number } } {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Threshold to find non-black areas
    const thresh = new this.cv.Mat()
    this.cv.threshold(gray, thresh, 10, 255, this.cv.THRESH_BINARY)
    
    // Find contours
    const contours = new this.cv.MatVector()
    const hierarchy = new this.cv.Mat()
    this.cv.findContours(thresh, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
    
    let maxArea = 0
    let maxRect = { x: 0, y: 0, width: src.cols, height: src.rows }
    
    // Find the largest contour (main content area)
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const rect = this.cv.boundingRect(contour)
      const area = rect.width * rect.height
      
      if (area > maxArea) {
        maxArea = area
        maxRect = rect
      }
      contour.delete()
    }
    
    // Add small padding
    const padding = 10
    maxRect.x = Math.max(0, maxRect.x - padding)
    maxRect.y = Math.max(0, maxRect.y - padding)
    maxRect.width = Math.min(src.cols - maxRect.x, maxRect.width + 2 * padding)
    maxRect.height = Math.min(src.rows - maxRect.y, maxRect.height + 2 * padding)
    
    // Crop the image
    const croppedMat = src.roi(new this.cv.Rect(maxRect.x, maxRect.y, maxRect.width, maxRect.height))
    
    // Clean up
    gray.delete()
    thresh.delete()
    contours.delete()
    hierarchy.delete()
    
    return {
      croppedMat,
      cropInfo: maxRect
    }
  }

  private detectPanelsContourBased(src: any): Array<{ x: number, y: number, width: number, height: number }> {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Apply Gaussian blur
    const blurred = new this.cv.Mat()
    this.cv.GaussianBlur(gray, blurred, new this.cv.Size(5, 5), 0)
    
    // Edge detection using Canny
    const edges = new this.cv.Mat()
    this.cv.Canny(blurred, edges, 50, 150)
    
    // Morphological operations to close gaps
    const kernel = this.cv.getStructuringElement(this.cv.MORPH_RECT, new this.cv.Size(3, 3))
    const dilated = new this.cv.Mat()
    this.cv.dilate(edges, dilated, kernel, new this.cv.Point(-1, -1), 2)
    
    // Find contours
    const contours = new this.cv.MatVector()
    const hierarchy = new this.cv.Mat()
    this.cv.findContours(dilated, contours, hierarchy, this.cv.RETR_EXTERNAL, this.cv.CHAIN_APPROX_SIMPLE)
    
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    const minArea = (src.rows * src.cols) * 0.01 // Minimum 1% of image area
    const maxArea = (src.rows * src.cols) * 0.8  // Maximum 80% of image area
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const rect = this.cv.boundingRect(contour)
      const area = rect.width * rect.height
      
      // Filter by area and aspect ratio
      if (area > minArea && area < maxArea && rect.width > 50 && rect.height > 50) {
        panels.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        })
      }
      contour.delete()
    }
    
    // Clean up
    gray.delete()
    blurred.delete()
    edges.delete()
    kernel.delete()
    dilated.delete()
    contours.delete()
    hierarchy.delete()
    
    return this.filterOverlappingPanels(panels)
  }

  private detectPanelsLineBased(src: any): Array<{ x: number, y: number, width: number, height: number }> {
    // Convert to grayscale
    const gray = new this.cv.Mat()
    this.cv.cvtColor(src, gray, this.cv.COLOR_RGB2GRAY)
    
    // Edge detection
    const edges = new this.cv.Mat()
    this.cv.Canny(gray, edges, 50, 150)
    
    // Detect lines using HoughLinesP
    const lines = new this.cv.Mat()
    this.cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 30, 5)
    
    const horizontalLines: Array<{ x1: number, y1: number, x2: number, y2: number }> = []
    const verticalLines: Array<{ x1: number, y1: number, x2: number, y2: number }> = []
    
    // Classify lines as horizontal or vertical
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4]
      const y1 = lines.data32S[i * 4 + 1]
      const x2 = lines.data32S[i * 4 + 2]
      const y2 = lines.data32S[i * 4 + 3]
      
      const angle = Math.abs(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI)
      
      if (angle < 10 || angle > 170) { // Horizontal line
        horizontalLines.push({ x1, y1, x2, y2 })
      } else if (angle > 80 && angle < 100) { // Vertical line
        verticalLines.push({ x1, y1, x2, y2 })
      }
    }
    
    // Create grid-based panels
    const panels = this.createGridPanels(horizontalLines, verticalLines, src.cols, src.rows)
    
    // Clean up
    gray.delete()
    edges.delete()
    lines.delete()
    
    return panels
  }

  private createGridPanels(
    horizontalLines: Array<{ x1: number, y1: number, x2: number, y2: number }>,
    verticalLines: Array<{ x1: number, y1: number, x2: number, y2: number }>,
    width: number,
    height: number
  ): Array<{ x: number, y: number, width: number, height: number }> {
    // Extract unique y-coordinates from horizontal lines
    const yCoords = [0, height]
    horizontalLines.forEach(line => {
      const y = Math.round((line.y1 + line.y2) / 2)
      if (!yCoords.includes(y)) yCoords.push(y)
    })
    yCoords.sort((a, b) => a - b)
    
    // Extract unique x-coordinates from vertical lines
    const xCoords = [0, width]
    verticalLines.forEach(line => {
      const x = Math.round((line.x1 + line.x2) / 2)
      if (!xCoords.includes(x)) xCoords.push(x)
    })
    xCoords.sort((a, b) => a - b)
    
    const panels: Array<{ x: number, y: number, width: number, height: number }> = []
    
    // Create panels from grid intersections
    for (let i = 0; i < yCoords.length - 1; i++) {
      for (let j = 0; j < xCoords.length - 1; j++) {
        const x = xCoords[j]
        const y = yCoords[i]
        const w = xCoords[j + 1] - x
        const h = yCoords[i + 1] - y
        
        // Filter out very small panels
        if (w > 50 && h > 50) {
          panels.push({ x, y, width: w, height: h })
        }
      }
    }
    
    return panels
  }

  private filterOverlappingPanels(panels: Array<{ x: number, y: number, width: number, height: number }>): Array<{ x: number, y: number, width: number, height: number }> {
    const filtered: Array<{ x: number, y: number, width: number, height: number }> = []
    
    for (const panel of panels) {
      let isOverlapping = false
      
      for (const existing of filtered) {
        const overlapX = Math.max(0, Math.min(panel.x + panel.width, existing.x + existing.width) - Math.max(panel.x, existing.x))
        const overlapY = Math.max(0, Math.min(panel.y + panel.height, existing.y + existing.height) - Math.max(panel.y, existing.y))
        const overlapArea = overlapX * overlapY
        const panelArea = panel.width * panel.height
        const existingArea = existing.width * existing.height
        
        // If overlap is more than 50% of either panel, consider it overlapping
        if (overlapArea > 0.5 * Math.min(panelArea, existingArea)) {
          isOverlapping = true
          break
        }
      }
      
      if (!isOverlapping) {
        filtered.push(panel)
      }
    }
    
    return filtered
  }

  private createPanelData(
    panelRects: Array<{ x: number, y: number, width: number, height: number }>,
    originalMat: any,
    cropInfo: { x: number, y: number, width: number, height: number },
    originalWidth: number,
    originalHeight: number
  ): SegmentedPanel[] {
    const panels: SegmentedPanel[] = []
    
    for (let i = 0; i < panelRects.length; i++) {
      const rect = panelRects[i]
      
      // Adjust coordinates back to original image space
      const origX = rect.x + cropInfo.x
      const origY = rect.y + cropInfo.y
      
      // Ensure coordinates are within bounds
      const clampedX = Math.max(0, Math.min(origX, originalWidth - 1))
      const clampedY = Math.max(0, Math.min(origY, originalHeight - 1))
      const clampedW = Math.min(rect.width, originalWidth - clampedX)
      const clampedH = Math.min(rect.height, originalHeight - clampedY)
      
      // Extract panel from original image
      const panelRoi = originalMat.roi(new this.cv.Rect(clampedX, clampedY, clampedW, clampedH))
      
      // Convert to base64
      const canvas = document.createElement('canvas')
      this.cv.imshow(canvas, panelRoi)
      const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      
      panels.push({
        id: `panel_${i}`,
        boundingBox: {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH
        },
        imageData,
        readingOrderIndex: i
      })
      
      panelRoi.delete()
    }
    
    return panels
  }

  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      
      // Handle data URL or raw base64
      if (base64.startsWith('data:')) {
        img.src = base64
      } else {
        img.src = `data:image/jpeg;base64,${base64}`
      }
    })
  }

  private imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    return canvas
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined'
  }
}